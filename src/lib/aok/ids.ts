import { z } from "zod";

/**
 * Path-ID validation for AOK routes (Codex/GLM-critical).
 *
 * Most Aok* ids are Prisma `cuid()` values; AokAnchor ids are service-generated
 * `crypto.randomUUID()` values. An opaque url-safe string accepts both shapes —
 * never `z.string().uuid()` (rejects cuids) and never a cuid-only regex
 * (rejects anchor UUIDs).
 */
export const opaqueIdSchema = z
  .string()
  .min(10)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

export function isValidOpaqueId(id: string): boolean {
  return opaqueIdSchema.safeParse(id).success;
}
