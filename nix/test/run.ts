import clipboardTest from "../../extensions/clipboard/test/clipboard.test.ts";
import herdrSessionNameTest from "../../extensions/herdr-session-name/test/herdr-session-name.test.ts";
import llmWikiTest from "../../extensions/llm-wiki/test/llm-wiki.test.ts";
import oracleTest from "../../extensions/oracle/test/oracle.test.ts";
import piToPiTest from "../../extensions/pi-to-PI/test/pi-to-PI.test.ts";
import sedimentMemoryTest from "../../extensions/sediment-memory/test/sediment-memory.test.ts";
import sketchTest from "../../extensions/sketch/test/sketch.test.ts";

await sedimentMemoryTest();
await clipboardTest();
await herdrSessionNameTest();
await llmWikiTest();
await oracleTest();
await piToPiTest();
await sketchTest();
