import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  generateText: vi.fn(),
  generateId: vi.fn(() => "id1"),
  togetherAISDKClient: vi.fn((model: string) => model),
  startSpan: vi.fn(() => ({ id: "span" })),
  logEvent: vi.fn(),
  serializeError: vi.fn((error: unknown) => ({ message: String(error) })),
  endSpan: vi.fn(),
}));

vi.mock("@/lib/clients", () => ({
  redis: { get: mocks.redisGet, set: mocks.redisSet },
  togetherAISDKClient: mocks.togetherAISDKClient,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  generateId: mocks.generateId,
}));

vi.mock("../braintrust", () => ({
  startBraintrustSpan: mocks.startSpan,
  logBraintrustEvent: mocks.logEvent,
  serializeBraintrustError: mocks.serializeError,
  endAndFlushBraintrustSpanAfterResponse: mocks.endSpan,
}));

import { createChat, loadChat, saveNewMessage } from "../chat-store";

describe("chat storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for missing and invalid stored values", async () => {
    mocks.redisGet.mockResolvedValueOnce(null).mockResolvedValueOnce("{bad");

    await expect(loadChat("missing")).resolves.toBeNull();
    await expect(loadChat("invalid")).resolves.toBeNull();
    expect(mocks.redisGet).toHaveBeenNthCalledWith(1, "chat:missing");
  });

  it("parses strings and accepts already deserialized values", async () => {
    const chat = { messages: [], csvHeaders: null, csvRows: null, csvFileUrl: null, title: "A" };
    mocks.redisGet.mockResolvedValueOnce(JSON.stringify(chat)).mockResolvedValueOnce(chat);

    await expect(loadChat("string")).resolves.toEqual(chat);
    await expect(loadChat("object")).resolves.toBe(chat);
  });

  it("appends a message while preserving an existing chat", async () => {
    const chat = {
      messages: [{ id: "m1", role: "user", content: "first" }],
      csvHeaders: ["value"],
      csvRows: [{ value: "1" }],
      csvFileUrl: "data.csv",
      title: "Existing",
    };
    mocks.redisGet.mockResolvedValue(chat);
    const message = { id: "m2", role: "assistant", content: "second" } as never;

    await saveNewMessage({ id: "abc", message });

    expect(mocks.redisSet).toHaveBeenCalledWith(
      "chat:abc",
      JSON.stringify({ ...chat, messages: [...chat.messages, message] })
    );
  });

  it("appends safely when an existing chat has no messages field", async () => {
    const chat = {
      csvHeaders: ["value"],
      csvRows: [],
      csvFileUrl: "data.csv",
      title: "Existing",
    };
    mocks.redisGet.mockResolvedValue(chat);
    const message = { id: "m1", role: "user", content: "hello" } as never;

    await saveNewMessage({ id: "abc", message });

    expect(mocks.redisSet).toHaveBeenCalledWith(
      "chat:abc",
      JSON.stringify({ ...chat, messages: [message] })
    );
  });

  it("creates a chat containing only the new message when none exists", async () => {
    mocks.redisGet.mockResolvedValue(null);
    const message = { id: "m1", role: "user", content: "hello" } as never;

    await saveNewMessage({ id: "new", message });

    expect(mocks.redisSet).toHaveBeenCalledWith(
      "chat:new",
      JSON.stringify({
        messages: [message],
        csvHeaders: null,
        csvRows: null,
        csvFileUrl: null,
        title: null,
      })
    );
  });

  it("stores a new chat with the generated title and prefixed key", async () => {
    mocks.generateText.mockResolvedValue({
      text: "My Title",
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });

    await expect(
      createChat({
        userQuestion: "What changed?",
        csvHeaders: ["value"],
        csvRows: [{ value: "1" }],
        csvFileUrl: "data.csv",
      })
    ).resolves.toBe("id1");

    expect(mocks.redisSet).toHaveBeenCalledOnce();
    const [key, json] = mocks.redisSet.mock.calls[0];
    expect(key).toBe("chat:id1");
    expect(JSON.parse(json)).toMatchObject({
      title: "My Title",
      messages: [],
      csvHeaders: ["value"],
      csvRows: [{ value: "1" }],
      csvFileUrl: "data.csv",
    });
    expect(mocks.endSpan).toHaveBeenCalledOnce();
  });

  it("stores nothing and still closes the span when title generation fails", async () => {
    mocks.generateText.mockRejectedValue(new Error("model unavailable"));

    await expect(
      createChat({
        userQuestion: "Question",
        csvHeaders: ["value"],
        csvRows: [],
        csvFileUrl: "data.csv",
      })
    ).rejects.toThrow("model unavailable");
    expect(mocks.redisSet).not.toHaveBeenCalled();
    expect(mocks.endSpan).toHaveBeenCalledOnce();
  });
});
