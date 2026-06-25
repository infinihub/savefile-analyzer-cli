import readline from "node:readline";

import { Savefile, type ICElement } from "savefile.js";

import type { EnvOptions } from "./shared";

function logStats(stats: Savefile["stats"]) {
  console.table({
    "Total Elements": { Count: stats.elements },
    "Total Recipes": { Count: stats.recipes },
    "First Discoveries": { Count: stats.discoveries },
  });
}

const getTerm = (env: EnvOptions) => ({
  cursorTo(x: number) {
    if (env.isTest) {
      process.stdout.write(`[CURSOR_TO:${x}]`);
    } else {
      readline.cursorTo(process.stdout, x);
    }
  },
  clearLine(dir: readline.Direction) {
    if (env.isTest) {
      process.stdout.write(`[CLEAR_LINE:${dir}]\n`);
    } else {
      readline.clearLine(process.stdout, dir);
    }
  },
  clearScreenDown() {
    if (env.isTest) {
      process.stdout.write("\n[CLEAR_SCREEN_DOWN]");
    } else {
      readline.clearScreenDown(process.stdout);
    }
  },
  moveCursor(dx: number, dy: number) {
    if (env.isTest) {
      process.stdout.write(`\n[MOVE_CURSOR:${dx},${dy}]`);
    } else {
      readline.moveCursor(process.stdout, dx, dy);
    }
  },
});

async function interactiveAnalyzer(
  raw: Uint8Array<ArrayBuffer>,
  env: EnvOptions,
) {
  const savefile = await Savefile.decode(raw);

  if (!savefile) {
    throw new Error("Invalid or corrupted savefile structure.");
  }

  // --- Summary Dashboard ---
  console.log("\n=====================================");
  console.log(" ✨ INFINITE CRAFT SAVEFILE STATS ✨ ");
  console.log("=====================================\n");

  logStats(savefile.stats);

  const elementsList = savefile.elements;

  console.log("\n💡 Interactive Finder Active");
  console.log(
    "👉 Type to filter. Use ⬆️ / ⬇️ to select, Enter to view details, Ctrl+C to close.",
  );
  console.log(
    "\x1b[36m-------------------------------------------------------\x1b[0m",
  );

  let currentQuery = "";
  let selectedIndex = 0;
  let currentMatches: ICElement[] = [];
  const promptStr = "🔍 Search element: ";

  if (!env.isTest) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  }

  const term = getTerm(env);

  function renderSearch() {
    // 1. Reset prompt line
    term.cursorTo(0);
    term.clearLine(0);
    process.stdout.write(`${promptStr}${currentQuery}`);

    // 2. Wipe everything below
    term.clearScreenDown();

    if (currentQuery.length === 0) {
      currentMatches = [];
      return;
    }

    // 3. Filter and sort matches
    currentMatches = elementsList
      .filter((el) =>
        el.text.toLowerCase().includes(currentQuery.toLowerCase()),
      )
      .sort((a, b) => a.text.length - b.text.length)
      .slice(0, 10);

    // Bound checking for array limits
    if (selectedIndex >= currentMatches.length) {
      selectedIndex = Math.max(0, currentMatches.length - 1);
    }

    // 4. Print matches with selection cursor
    if (currentMatches.length === 0) {
      process.stdout.write(`\n   \x1b[90mNo matches found.\x1b[0m`);
    } else {
      process.stdout.write(
        `\n   \x1b[90mMatches (Use ⬆️/⬇️, Enter to inspect):\x1b[0m`,
      );
      currentMatches.forEach((el, idx) => {
        const isSelected = idx === selectedIndex;
        const pointer = isSelected ? "\x1b[35m ➔ \x1b[0m" : "   ";
        const textStyle = isSelected ? "\x1b[1m\x1b[4m" : "";
        const resetStyle = "\x1b[0m";

        process.stdout.write(
          `\n${pointer}${el.emoji || "❓"} ${textStyle}${el.text}${resetStyle}`,
        );
      });
    }

    // 5. Place cursor cleanly back onto the input prompt line
    const rowsUp = currentMatches.length === 0 ? 1 : currentMatches.length + 1;
    term.moveCursor(0, -rowsUp);
    term.cursorTo(promptStr.length + currentQuery.length);
  }

  function displayElementDetails(element: ICElement) {
    // Clear prompt and lists entirely to print full record cleanly
    term.cursorTo(0);
    term.clearScreenDown();

    console.log(
      `\n${element.emoji || "❓"} \x1b[1m\x1b[35m${element.text}\x1b[0m`,
    );
    if (element.discovery) console.log("\x1b[33m🌟 FIRST DISCOVERY!\x1b[0m");

    console.log(`\nRecipes (${element.recipes.length}):`);
    if (element.recipes.length === 0) {
      console.log("   (Base starter element)");
    } else {
      element.recipes.forEach((r, idx) => {
        console.log(
          `   [${idx + 1}]  ${r.a.emoji || ""} ${r.a.text} + ${r.b.emoji || ""} ${r.b.text}`,
        );
      });
    }

    console.log(`\nUses (${element.uses.length}):`);
    if (element.uses.length === 0) {
      console.log("   (No recorded craft combinations yet)");
    } else {
      element.uses.slice(0, 15).forEach((u) => {
        console.log(
          `   + ${u.other.emoji || ""} ${u.other.text} ➔  ${u.result.emoji || ""} ${u.result.text}`,
        );
      });
      if (element.uses.length > 15) {
        console.log(
          `   ... and ${element.uses.length - 15} more combinations.`,
        );
      }
    }

    console.log(
      "\x1b[36m\n-------------------------------------------------------\x1b[0m",
    );
    console.log("👉 Type to start a new search, or press Ctrl+C to exit.");
    currentQuery = "";
    selectedIndex = 0;
    renderSearch();
  }

  // Draw initial state
  renderSearch();

  process.stdin.on("data", (chunk) => {
    const key = chunk.toString("utf8");

    // Graceful exit on Ctrl+C
    if (key === "\u0003") {
      term.cursorTo(0);
      term.moveCursor(0, 1);
      term.clearScreenDown();
      process.exit(0);
    }

    // Capture Arrow Key escape codes (\x1b[A = Up, \x1b[B = Down)
    if (key === "\u001b[A") {
      if (currentMatches.length > 0) {
        selectedIndex =
          (selectedIndex - 1 + currentMatches.length) % currentMatches.length;
      }
      renderSearch();
      return;
    }
    if (key === "\u001b[B") {
      if (currentMatches.length > 0) {
        selectedIndex = (selectedIndex + 1) % currentMatches.length;
      }
      renderSearch();
      return;
    }

    // Enter Key selects the element highlighted by the cursor
    if (key === "\r" || key === "\n") {
      const match = currentMatches[selectedIndex];
      if (match) {
        displayElementDetails(match);
      }
      return;
    }

    // Handle Backspace
    if (key === "\u007f" || key === "\b") {
      if (currentQuery.length > 0) {
        currentQuery = currentQuery.slice(0, -1);
        selectedIndex = 0; // Reset index during layout shifts
      }
    } else {
      // Absorb string input text chunks safely
      if (!key.startsWith("\x1b")) {
        currentQuery += key;
        selectedIndex = 0; // Reset focus index on active character modifications
      }
    }

    renderSearch();
  });
}

export { interactiveAnalyzer };
