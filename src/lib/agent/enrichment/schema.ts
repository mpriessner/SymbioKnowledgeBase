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
 * W81-A2 citation shapes. The SECOND (citation) LLM pass emits, per atomic
 * claim, the chunk(s) + exact quote(s) it relied on. Chunks are referenced by
 * `chunkIndex` (a prompt-time-stable handle) — NOT the server-generated
 * SourceChunk uuid, which does not exist when the prompt is built. A
 * `contradicts` item names the EXISTING `claimId` it refutes (the CONTRADICTS
 * edge attaches to the old claim); new-body claims carry only SUPPORTS.
 */
export const citationEvidenceSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  quotedText: z.string().min(1),
  relation: z.enum(["SUPPORTS", "CONTRADICTS"]).default("SUPPORTS"),
  confidence: z.number().min(0).max(1).default(0.5),
  /** REQUIRED for a CONTRADICTS item: the existing Claim id being refuted. */
  claimId: z.string().uuid().optional(),
});

export type CitationEvidence = z.infer<typeof citationEvidenceSchema>;

export const claimCitationSchema = z.object({
  text: z.string().min(1),
  evidence: z.array(citationEvidenceSchema).default([]),
});

export type ClaimCitation = z.infer<typeof claimCitationSchema>;

/** The second-pass response: the atomic claims for ONE concept body + evidence. */
export const citationPlanSchema = z.object({
  claims: z.array(claimCitationSchema).default([]),
});

export type CitationPlan = z.infer<typeof citationPlanSchema>;

/**
 * One create/update operation the LLM wants applied. `slug` and `related_slugs`
 * are normalized (kebab-cased) BEFORE validation, mirroring the Python
 * `field_validator(mode="before")` normalizers, so a slightly off-format slug is
 * coerced rather than rejected.
 *
 * W81-A2: `claims` is an OPTIONAL versioned superset field. a71-13 fixtures that
 * omit it MUST still validate (backward compat); the enrich ENDPOINT enforces
 * "citations required" at the service layer for W81-enabled tenants, and the
 * self-repair loop must never reject a plan merely for omitting `claims`.
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
  // W81-A2 versioned superset — OPTIONAL so a71-13 fixtures without it validate.
  claims: z.array(claimCitationSchema).optional(),
});

export type ConceptAction = z.infer<typeof conceptActionSchema>;

/** Top-level JSON object the LLM must return for an ingest call. */
export const enrichmentPlanSchema = z.object({
  reasoning: z.string(),
  actions: z.array(conceptActionSchema).default([]),
});

export type EnrichmentPlan = z.infer<typeof enrichmentPlanSchema>;
