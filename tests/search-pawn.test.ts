// tests/analyzer.test.ts
import { expect, test } from "bun:test";

import { ProcessSession } from "./shared";

test("Interactive Analyzer E2E Flow", async () => {
  const session = ProcessSession.spawn("open-savefile");

  await session.waitFor("🔍 Search element: ");

  await session.write("p");

  await session.waitFor("📷 Ph");

  await session.write("a");

  await session.waitFor("👍 Pag");

  await session.write("w");

  await session.waitFor('👋 "hi Apaw"');

  await session.write("n");

  await session.waitFor('👋 "hi Apawn"');

  session.end(expect);
});
