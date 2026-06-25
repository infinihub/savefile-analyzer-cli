import path from "node:path";

import { interactiveAnalyzer } from "./interactive-analyzer";
import type { EnvOptions } from "./shared";

export async function analyzeSavefile(filePath: string, env: EnvOptions) {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      console.log(`\x1b[31m❌ Error: File not found at "${filePath}"\x1b[0m`);
      process.exit(1);
    }

    console.log(`\nAnalyzing ${path.basename(filePath)}...`);

    await interactiveAnalyzer(await file.bytes(), env);
  } catch (error) {
    if (Error.isError(error)) {
      console.error(
        `\x1b[31m❌ Failed to analyze savefile: ${error.message}\x1b[0m`,
      );
    }
    process.exit(1);
  }
}

export async function run(env: EnvOptions) {
  const filePath = Bun.argv[2];

  if (!filePath) {
    console.log("\x1b[31m\n❌ Error: No file specified.\x1b[0m");
    console.log("Usage: bun open <path-to-savefile>\n");
    process.exit(1);
  }

  await analyzeSavefile(filePath, env);
}

if (import.meta.main) {
  await run({ isTest: false });
}
