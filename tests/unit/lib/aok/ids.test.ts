import { describe, test, expect } from "vitest";
import { z } from "zod";
import { opaqueIdSchema, isValidOpaqueId } from "@/lib/aok/ids";

describe("opaqueIdSchema", () => {
  test("accepts a cuid-shaped id", () => {
    expect(isValidOpaqueId("cjld2cyuq0000t3rmniod1foy")).toBe(true);
  });

  test("accepts a UUID-shaped id (AokAnchor ids)", () => {
    expect(isValidOpaqueId("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  test("rejects ids shorter than 10 chars", () => {
    expect(isValidOpaqueId("short")).toBe(false);
  });

  test("rejects ids with disallowed characters", () => {
    expect(isValidOpaqueId("not a valid id!!")).toBe(false);
  });

  // The exact regression this schema exists to prevent — see story's
  // "never z.string().uuid()" note. A plain z.string().uuid() would reject
  // the cuid-shaped id that most Aok* models actually use.
  test("differs from z.string().uuid(), which would reject a cuid", () => {
    const cuid = "cjld2cyuq0000t3rmniod1foy";
    expect(opaqueIdSchema.safeParse(cuid).success).toBe(true);
    expect(z.string().uuid().safeParse(cuid).success).toBe(false);
  });
});
