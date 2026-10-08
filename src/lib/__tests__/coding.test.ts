import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clients", () => ({
  codeInterpreter: { execute: vi.fn() },
}));

import { codeInterpreter } from "@/lib/clients";
import { runPython } from "../coding";

const execute = vi.mocked(codeInterpreter.execute);

describe("runPython", () => {
  beforeEach(() => {
    execute.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "dir").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes code and session id and maps outputs and errors", async () => {
    execute.mockResolvedValue({
      data: {
        session_id: "session-1",
        status: "completed",
        outputs: [{ type: "stdout", data: "42" }],
        errors: [{ message: "warning" }],
      },
    } as never);

    await expect(runPython("print(42)", "session-1")).resolves.toEqual({
      session_id: "session-1",
      status: "completed",
      outputs: [{ type: "stdout", data: "42" }],
      errors: [{ message: "warning" }],
    });
    expect(execute).toHaveBeenCalledWith({
      code: "print(42)",
      language: "python",
      session_id: "session-1",
    });
  });

  it("uses safe defaults when response fields are missing", async () => {
    execute.mockResolvedValue({ data: {} } as never);

    await expect(runPython("pass")).resolves.toEqual({
      session_id: null,
      status: "unknown",
      outputs: [],
    });
    expect(execute).toHaveBeenCalledWith({ code: "pass", language: "python" });
  });

  it("returns an error result when the interpreter throws", async () => {
    execute.mockRejectedValue(new Error("interpreter unavailable"));

    await expect(runPython("pass")).resolves.toEqual({
      status: "error",
      error_message: "interpreter unavailable",
      session_id: null,
      outputs: [],
    });
  });

  it("does not forward supplied files to the interpreter", async () => {
    execute.mockResolvedValue({ data: { outputs: [] } } as never);

    await runPython("pass", undefined, [
      { name: "data.csv", encoding: "utf8", content: "a\n1" },
    ]);

    expect(execute).toHaveBeenCalledWith({ code: "pass", language: "python" });
  });
});
