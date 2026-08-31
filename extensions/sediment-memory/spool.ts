import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  private readonly pendingPath = join(SPOOL_DIR, `pending-${process.pid}.txt`);
  private turns: EvidenceRecord[][] = [];
  private overlap: EvidenceRecord[][] = [];
  private queued: Promise<void> = Promise.resolve();

  constructor(private readonly options: SpoolQueueOptions) {}

  getRecallTurns(): EvidenceRecord[][] {
    return [...this.overlap, ...this.turns];
  }

  addTurn(turn: EvidenceRecord[], ctx: ExtensionContext): void {
    if (this.options.isDisabled(ctx)) return;
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
      names = await readdir(SPOOL_DIR);
    } catch {
      return;
    }

    for (const name of names.sort()) {
      if (name.endsWith(".failed")) continue;
      const path = join(SPOOL_DIR, name);
      if (name.startsWith("pending-") && !(await this.pendingIsStale(path))) {
        continue;
      }
      try {
        const raw = await readFile(path, "utf8");
        if (raw.trim()) {
          await this.options.extractAndStore(ctx, prepareSpoolExtraction(raw));
        }
        await rm(path, { force: true });
      } catch (error) {
        console.error("memory: failed to drain spool file", name, error);
        await this.quarantineIfExpired(path, name);
      }
    }
  }

  private render(): string {
    const spool: CaptureSpool = {
      version: 2,
      turns: this.turns,
      overlapTurns: this.overlap,
    };
    return JSON.stringify(spool);
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
      mkdirSync(SPOOL_DIR, { recursive: true });
      writeFileSync(this.pendingPath, this.render());
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
      mkdirSync(SPOOL_DIR, { recursive: true });
      writeFileSync(
        join(SPOOL_DIR, `${Date.now()}-${process.pid}.txt`),
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

  private async pendingIsStale(path: string): Promise<boolean> {
    try {
      return Date.now() - (await stat(path)).mtimeMs >= PENDING_SPOOL_STALE_MS;
    } catch {
      return false;
    }
  }

  private async quarantineIfExpired(path: string, name: string): Promise<void> {
    let age: number;
    try {
      age = Date.now() - (await stat(path)).mtimeMs;
    } catch {
      return;
    }
    if (age <= SPOOL_RETRY_WINDOW) return;
    try {
      await rename(path, `${path}.failed`);
    } catch (error) {
      console.error("memory: failed to quarantine spool file", name, error);
    }
  }
}
