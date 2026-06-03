import { describe, it, expect } from "vitest";
import { bufferFile } from "./fileBuffer";

describe("bufferFile", () => {
  it("preserves name, type and byte content", async () => {
    const original = new File(["hello world"], "note.txt", { type: "text/plain" });
    const buffered = await bufferFile(original);
    expect(buffered).toBeInstanceOf(File);
    expect(buffered.name).toBe("note.txt");
    expect(buffered.type).toBe("text/plain");
    const bytes = await buffered.arrayBuffer();
    expect(new TextDecoder().decode(bytes)).toBe("hello world");
  });

  it("returns a detached copy backed by its own bytes, not the picked File", async () => {
    const original = new File(["abc"], "a.bin", { type: "application/octet-stream" });
    const buffered = await bufferFile(original);
    expect(buffered).not.toBe(original);
    expect(buffered.size).toBe(original.size);
  });
});
