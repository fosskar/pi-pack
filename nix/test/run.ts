import clipboardTest from "../../extensions/clipboard/test/clipboard.test.ts";
import llmWikiTest from "../../extensions/llm-wiki/test/llm-wiki.test.ts";
import oracleTest from "../../extensions/oracle/test/oracle.test.ts";
import piToPiTest from "../../extensions/pi-to-PI/test/pi-to-PI.test.ts";
import sketchTest from "../../extensions/sketch/test/sketch.test.ts";

await clipboardTest();
await llmWikiTest();
await oracleTest();
await piToPiTest();
await sketchTest();
