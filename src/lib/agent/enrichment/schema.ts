/**
 * Zod schemas mirroring `llm-wiki-builder`'s `okf_models.py`
 * `ConceptAction`/`EnrichmentPlan` exactly. The LLM's JSON response is validated
 * against these; a failure drives the self-repair retry in `enrichmentAgent.ts`.
 */

import { z } from "zod";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Turn an arbitrary string into an OKF-safe kebab-case slug (mirrors `slugify`). */
export function slugify(text: string): string {
  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

/**
 * One create/update operation the LLM wants applied. `slug` and `related_slugs`
 * are normalized (kebab-cased) BEFORE validation, mirroring the Python
 * `field_validator(mode="before")` normalizers, so a slightly off-format slug is
 * coerced rather than rejected.
 */
export const conceptActionSchema = z.object({
  action: z.enum(["create", "update"]),
  slug: z
    .string()
    .transform(slugify)
    .refine((s) => SLUG_RE.test(s), { message: "invalid slug" }),
  type: z.string().default("concept"),
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).default([]),
  body_markdown: z.string().min(1),
  related_slugs: z
    .array(z.string())
    .default([])
    .transform((arr) => arr.map(slugify)),
  aliases: z.array(z.string()).default([]),
  change_note: z.string().default(""),
});

export type ConceptAction = z.infer<typeof conceptActionSchema>;

/** Top-level JSON object the LLM must return for an ingest call. */
export const enrichmentPlanSchema = z.object({
  reasoning: z.string(),
  actions: z.array(conceptActionSchema).default([]),
});

export type EnrichmentPlan = z.infer<typeof enrichmentPlanSchema>;
