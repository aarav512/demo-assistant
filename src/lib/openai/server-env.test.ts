import { describe, expect, it } from "vitest";
import { normalizeApiKey } from "@/lib/openai/server-env";

describe("normalizeApiKey", () => {
  it("removes wrapping quotes and an accidental bearer prefix", () => {
    expect(normalizeApiKey("  \"sk-test-secret\"  ")).toBe("sk-test-secret");
    expect(normalizeApiKey("'sk-test-secret'")).toBe("sk-test-secret");
    expect(normalizeApiKey("Bearer sk-test-secret")).toBe("sk-test-secret");
  });

  it("treats an empty value as unusable", () => {
    expect(normalizeApiKey("   ")).toBe("");
    expect(normalizeApiKey("\"\"")).toBe("");
  });
});
