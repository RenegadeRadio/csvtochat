import { describe, expect, it } from "vitest";

import { cn, extractCodeFromText, formatLLMTimestamp } from "../utils";

describe("extractCodeFromText", () => {
  it("returns trimmed code from the first python fenced block", () => {
    const text = "before\n```python\n print('first') \n```\n```python\nsecond\n```";

    expect(extractCodeFromText(text)).toBe("print('first')");
  });

  it("returns null when no python fenced block exists", () => {
    expect(extractCodeFromText("```js\nconsole.log('no')\n```")).toBeNull();
  });
});

describe("utility helpers", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2 text-red-500", "px-4")).toBe("text-red-500 px-4");
  });

  it("formats a timestamp as a readable date and time", () => {
    const formatted = formatLLMTimestamp("2026-04-08T18:17:50Z");

    expect(formatted).toMatch(/Apr 8/);
    expect(formatted).toMatch(/(AM|PM)/);
  });
});
