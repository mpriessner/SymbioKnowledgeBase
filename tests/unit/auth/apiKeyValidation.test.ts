import { describe, it, expect } from "vitest";
import { createApiKeySchema } from "@/lib/validation/apiKeys";

describe("createApiKeySchema", () => {
  it("accepts valid key name", () => {
    const result = createApiKeySchema.safeParse({
      name: "Lab Companion Agent",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createApiKeySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createApiKeySchema.safeParse({
      name: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from name", () => {
    const result = createApiKeySchema.safeParse({ name: "  My Key  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("My Key");
    }
  });

  it("rejects missing name field", () => {
    const result = createApiKeySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
