import { loadFixture } from "@savefile/fixtures";

import { interactiveAnalyzer } from "../src/interactive-analyzer";

const raw = loadFixture("2025-04-04.ic");

await interactiveAnalyzer(raw, { isTest: true });
