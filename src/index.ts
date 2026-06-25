import path from "node:path";
import readline from "node:readline";

import { Savefile, type ICElement } from "savefile.js";

async function main(filePath: string) {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      console.log(
        "\x1b[31m%s\x1b[0m",
        `❌ Error: File not found at "${filePath}"`,
      );
      process.exit(1);
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log(`\nAnalyzing ${path.basename(filePath)}...`);
    const savefile = await Savefile.decode(uint8Array);

    if (!savefile) {
      throw new Error("Invalid or corrupted savefile structure.");
    }

    // --- Summary Dashboard ---
    console.log("\n=====================================");
    console.log(" ✨ INFINITE CRAFT SAVEFILE STATS ✨ ");
    console.log("=====================================\n");

    console.table({
      "Total Elements": { Count: savefile.stats.elements },
      "Total Recipes": { Count: savefile.stats.recipes },
      "First Discoveries": { Count: savefile.stats.discoveries },
    });

    const elementsList = savefile.elements;

    console.log("\n💡 Interactive Finder Active");
    console.log(
      "👉 Type to filter. Use ⬆️ / ⬇️ to select, Enter to view details, Ctrl+C to close.",
    );
    console.log(
      "\x1b[36m%s\x1b[0m",
      "-------------------------------------------------------",
    );

    let currentQuery = "";
    let selectedIndex = 0;
    let currentMatches: ICElement[] = [];
    const promptStr = "🔍 Search element: ";

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function renderSearch() {
      // 1. Reset prompt line
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      process.stdout.write(promptStr + currentQuery);

      // 2. Wipe everything below
      readline.clearScreenDown(process.stdout);

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
      const rowsUp =
        currentMatches.length === 0 ? 1 : currentMatches.length + 1;
      readline.moveCursor(process.stdout, 0, -rowsUp);
      readline.cursorTo(process.stdout, promptStr.length + currentQuery.length);
    }

    function displayElementDetails(element: ICElement) {
      // Clear prompt and lists entirely to print full record cleanly
      readline.cursorTo(process.stdout, 0);
      readline.clearScreenDown(process.stdout);

      console.log(
        `\n${element.emoji || "❓"} \x1b[1m\x1b[35m${element.text}\x1b[0m`,
      );
      if (element.discovery)
        console.log("\x1b[33m%s\x1b[0m", "🌟 FIRST DISCOVERY!");

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
        "\x1b[36m%s\x1b[0m",
        "\n-------------------------------------------------------",
      );
      console.log("👉 Type to start a new search, or press Ctrl+C to exit.");
      currentQuery = "";
      selectedIndex = 0;
      renderSearch();
    }

    // Draw initial state
    renderSearch();

    process.stdin.on("data", (key: string) => {
      // Graceful exit on Ctrl+C
      if (key === "\u0003") {
        readline.cursorTo(process.stdout, 0);
        readline.moveCursor(process.stdout, 0, 1);
        readline.clearScreenDown(process.stdout);
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
  } catch (error) {
    if (Error.isError(error)) {
      console.error(
        "\x1b[31m%s\x1b[0m",
        `❌ Failed to analyze savefile: ${error.message}`,
      );
    }
    process.exit(1);
  }
}

const filePath = Bun.argv[2];

if (!filePath) {
  console.log("\x1b[31m%s\x1b[0m", "\n❌ Error: No file specified.");
  console.log("Usage: bun open <path-to-savefile>\n");
  process.exit(1);
}

await main(filePath);
