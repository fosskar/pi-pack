import extensionTests from "./extensions.test.ts";
import memoryTest from "./memory.test.ts";

memoryTest();
await extensionTests();
