import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  prepareSpoolExtraction,
  type CaptureSpool,
  type EvidenceRecord,
  type ExtractionRequest,
} from "./evidence.ts";
import { SPOOL_DIR } from "./sediment.ts";

const SPOOL_RETRY_WINDOW = 7 * 24 * 60 * 60 * 1000;
const RETAIN_EVERY_N_TURNS = 4;
const RETAIN_OVERLAP_TURNS = 2;
const PENDING_SPOOL_STALE_MS = 60 * 60 * 1000;

interface SpoolQueueOptions {
  isDisabled(ctx: ExtensionContext): boolean;
  extractAndStore(
    ctx: ExtensionContext,
    request: ExtractionRequest,
  ): Promise<void>;
}

export class SpoolQueue {
  private readonly pendingPath: string;
  private turns: EvidenceRecord[][] = [];
  private overlap: EvidenceRecord[][] = [];
  private captureCwd: string | undefined;
  private queued: Promise<void> = Promise.resolve();

  constructor(
    private readonly options: SpoolQueueOptions,
    private readonly spoolDir = SPOOL_DIR,
  ) {
    this.pendingPath = join(spoolDir, `pending-${process.pid}.txt`);
  }

  addTurn(turn: EvidenceRecord[], ctx: ExtensionContext): void {
    if (this.options.isDisabled(ctx)) return;
    const cwd = ctx.sessionManager.getCwd();
    if (this.captureCwd !== undefined && this.captureCwd !== cwd) {
      if (this.turns.length > 0) {
        if (!this.finalize(ctx)) {
          if (this.spoolStandaloneTurn(turn, cwd)) {
            this.enqueue(() => this.drain(ctx));
          }
          return;
        }
        this.enqueue(() => this.drain(ctx));
      }
      this.overlap = [];
    }
    this.captureCwd = cwd;
    this.turns.push(turn);
    if (this.turns.length >= RETAIN_EVERY_N_TURNS) {
      if (this.finalize(ctx)) this.enqueue(() => this.drain(ctx));
    } else {
      this.writePending();
    }
  }

  finish(ctx: ExtensionContext): void {
    this.finalize(ctx);
  }

  enqueue(work: () => Promise<void>): void {
    this.queued = this.queued.then(work).catch((error) => {
      console.error("memory: background work failed", error);
    });
  }

  async drain(ctx: ExtensionContext): Promise<void> {
    if (this.options.isDisabled(ctx)) return;
    let names: string[];
    try {
      names = await readdir(this.spoolDir);
    } catch {
      return;
    }

    for (const name of names.sort()) {
      if (name.endsWith(".failed")) continue;
      const path = join(this.spoolDir, name);
      if (name.endsWith(".tmp") && !(await this.claimIsStale(path))) continue;
      if (name.startsWith("pending-") && !(await this.pendingIsStale(path))) {
        continue;
      }
      if (name.includes(".processing-") && !(await this.claimIsStale(path))) {
        continue;
      }

      const canonicalPath = path.replace(/(?:\.processing-[^.]+)+$/, "");
      const claimedPath = `${canonicalPath}.processing-${process.pid}-${Date.now()}`;
      try {
        await rename(path, claimedPath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          console.error("memory: failed to claim spool file", name, error);
        }
        continue;
      }

      try {
        const raw = await readFile(claimedPath, "utf8");
        if (raw.trim()) {
          await this.options.extractAndStore(ctx, prepareSpoolExtraction(raw));
        }
        await rm(claimedPath, { force: true });
      } catch (error) {
        console.error("memory: failed to drain spool file", name, error);
        await this.restoreOrQuarantine(claimedPath, canonicalPath, name);
      }
    }
  }

  private render(): string {
    const spool: CaptureSpool = {
      version: 3,
      turns: this.turns,
      overlapTurns: this.overlap,
      cwd: this.captureCwd,
    };
    return JSON.stringify(spool);
  }

  private spoolStandaloneTurn(turn: EvidenceRecord[], cwd: string): boolean {
    const spool: CaptureSpool = {
      version: 3,
      turns: [turn],
      overlapTurns: [],
      cwd,
    };
    try {
      this.writeAtomic(
        join(this.spoolDir, `${Date.now()}-${process.pid}-cwd.txt`),
        JSON.stringify(spool),
      );
      return true;
    } catch (error) {
      console.error("memory: failed to spool turn after cwd change", error);
      return false;
    }
  }

  private removePending(): void {
    try {
      rmSync(this.pendingPath, { force: true });
    } catch (error) {
      console.error("memory: failed to remove pending spool", error);
    }
  }

  private writePending(): void {
    try {
      this.writeAtomic(this.pendingPath, this.render());
    } catch (error) {
      console.error("memory: failed to write pending spool", error);
    }
  }

  private finalize(ctx: ExtensionContext): boolean {
    if (this.turns.length === 0) return false;
    if (this.options.isDisabled(ctx)) {
      this.turns = [];
      this.removePending();
      return false;
    }
    try {
      this.writeAtomic(
        join(this.spoolDir, `${Date.now()}-${process.pid}.txt`),
        this.render(),
      );
      this.overlap = this.turns.slice(-RETAIN_OVERLAP_TURNS);
      this.turns = [];
      this.removePending();
      return true;
    } catch (error) {
      console.error("memory: failed to spool turns", error);
      return false;
    }
  }

  private writeAtomic(path: string, content: string): void {
    mkdirSync(this.spoolDir, { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, content);
      renameSync(temporary, path);
    } finally {
      rmSync(temporary, { force: true });
    }
  }

  private async pendingIsStale(path: string): Promise<boolean> {
    try {
      return Date.now() - (await stat(path)).mtimeMs >= PENDING_SPOOL_STALE_MS;
    } catch {
      return false;
    }
  }

  private async claimIsStale(path: string): Promise<boolean> {
    try {
      return Date.now() - (await stat(path)).mtimeMs >= PENDING_SPOOL_STALE_MS;
    } catch {
      return false;
    }
  }

  private async restoreOrQuarantine(
    claimedPath: string,
    canonicalPath: string,
    name: string,
  ): Promise<void> {
    let age: number;
    try {
      age = Date.now() - (await stat(claimedPath)).mtimeMs;
    } catch {
      return;
    }
    const target =
      age > SPOOL_RETRY_WINDOW ? `${canonicalPath}.failed` : canonicalPath;
    try {
      await rename(claimedPath, target);
    } catch (error) {
      console.error("memory: failed to restore spool file", name, error);
    }
  }
}
