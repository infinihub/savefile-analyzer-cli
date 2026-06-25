// tests/shared.ts
import type { Expect } from "bun:test";

type Subprocess = Bun.Subprocess<"pipe", "pipe", "inherit">;

const testEnv = { ...process.env, NODE_ENV: "test" } as const;

class ProcessSession {
  #pendingBuffer = "";
  #reader: ReadableStreamDefaultReader<Uint8Array>;
  name: string;
  #sessionHistory = "";
  #process: Subprocess;
  #encoder = new TextEncoder();
  #decoder = new TextDecoder();

  constructor(process: Subprocess, name: string) {
    this.#process = process;
    this.#reader = process.stdout.getReader();
    this.name = name;
    void this.#startReading();
  }

  static spawn(name: string): ProcessSession {
    const process = Bun.spawn(["bun", "run", `./tests/fixture.ts`], {
      env: testEnv,
      stdin: "pipe",
      stdout: "pipe",
    });
    return new ProcessSession(process, name);
  }

  async #startReading() {
    while (true) {
      const { value, done } = await this.#reader.read();
      if (done) break;
      const text = this.#decoder.decode(value, { stream: true });
      this.#pendingBuffer += text;
      this.#sessionHistory += text;
    }
  }

  async waitFor(expectedOutput: string, timeoutMs = 4000): Promise<string> {
    const startTime = Date.now();
    while (!this.#pendingBuffer.includes(expectedOutput)) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `Timeout waiting for output phrase: "${expectedOutput}"`,
        );
      }
      await Bun.sleep(50);
    }
    const matchIndex = this.#pendingBuffer.indexOf(expectedOutput);
    const matchedSegment = this.#pendingBuffer.slice(
      0,
      matchIndex + expectedOutput.length,
    );
    this.#pendingBuffer = this.#pendingBuffer.slice(
      matchIndex + expectedOutput.length,
    );
    return matchedSegment;
  }

  async write(text: string) {
    this.#sessionHistory += `[INPUT:${text}]`;
    await this.#process.stdin.write(this.#encoder.encode(text));
  }

  codes = {
    up: new Uint8Array([27, 91, 65]),
    down: new Uint8Array([27, 91, 66]),
    right: new Uint8Array([27, 91, 67]),
    left: new Uint8Array([27, 91, 68]),
    enter: new Uint8Array([13]),
  } as const;

  async sendKey(key: keyof typeof this.codes) {
    const sequence = this.codes[key];
    this.#sessionHistory += `[INPUT_KEY:${key}]\n`;
    await this.#process.stdin.write(sequence);
  }

  end(expect: Expect) {
    expect(Bun.stripANSI(this.#sessionHistory)).toMatchSnapshot(
      `[${this.name}] [no ansi]`,
    );
    expect(this.#sessionHistory).toMatchSnapshot(`[${this.name}]`);
    this.#process.kill();
  }
}

export { ProcessSession };
