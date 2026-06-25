// tests/analyzer.test.ts
import { expect, test } from "bun:test";

import { ProcessSession } from "./shared";

test("Interactive Analyzer E2E Flow", async () => {
  const session = ProcessSession.spawn("open-savefile");

  await session.waitFor("🔍 Search element: ");

  session.end(expect);
});
