import { z } from "zod";

/**
 * Scopes that can be granted to an API key. New keys default to least-privilege
 * `["read"]` (audit S11) unless `write` is explicitly requested.
 */
export const apiKeyScopeSchema = z.array(z.enum(["read", "write"]));

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  scopes: apiKeyScopeSchema.default(["read"]),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
