/**
 * W81-A2 single-transaction apply: page body + DocumentVersion + Claim +
 * ClaimEvidence + audit + ledger commit in ONE `prisma.$transaction`, or none
 * (AC6). A quote-gate/FK/version failure rolls back the whole write — never a
 * live body without provenance.
 *
 * Why NOT reuse applyPlan / createDocumentVersion (GLM R2):
 *  - `createDocumentVersion()` self-opens its own transaction and takes no
 *    tx-client, so nesting it makes the uncommitted Page invisible to its
 *    connection → FK violation on DocumentVersion.pageId. This module inlines the
 *    version write on the apply `tx`, re-implementing computeTextDiff, the
 *    `max+1` next-version with a P2002 retry on @@unique([pageId, version]), and
 *    DEFERS retention pruning to AFTER commit (pruning is cleanup, not atomicity;
 *    and it must skip claim-referenced versions — see versioning.pruneOldVersions).
 *  - Wikilinks / search index / aggregation refresh use the global prisma client
 *    and cannot see uncommitted rows either, so they are ALSO deferred to
 *    post-commit side effects.
 *
 * `Source`+`SourceChunk` are an idempotent PRE-STEP OUTSIDE this transaction
 * (A1 Sources are immutable/dedup-idempotent — an orphan is harmless GC-able raw
 * data; a live page without provenance is the hazard the tx protects). Apply
 * resolves the model's `chunkIndex` → persisted `SourceChunk.id` within
 * `(tenantId, sourceId)` here, because the LLM cannot know the server uuid at
 * prompt-build time.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AgentContext } from "@/lib/agent/auth";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { extractPlainText } from "@/lib/search/indexer";
import { computeTextDiff } from "@/lib/livingDocs/diff";
import { pruneOldVersions } from "@/lib/livingDocs/versioning";
import {
  matchQuote,
  quoteShaFor,
  computeClaimKey,
  computeAnchorTextSha,
} from "@/lib/provenance/quoteMatch";
import {
  degradeAction,
  findDangling,
  findDuplicateWarning,
} from "./applyPlan";
import {
  conceptExternalId,
  gatherConceptPages,
  type GatheredConcept,
} from "./conceptsIndex";
import type { ConceptAction, ClaimCitation } from "./schema";

export interface ApplyWithCitationsOptions {
  conceptsCategoryId: string;
  targetCategoryId?: string;
  allowedParentIds: Set<string>;
  correlationId?: string | null;
  /** The immutable Source persisted in the pre-step; chunks resolve within it. */
  sourceId: string | null;
  /** Ledger idempotency: written INSIDE the tx (AC6). */
  contentHash: string;
  sourceName: string;
  /** Service-layer flag: reject a plan whose applied concepts carry no claims. */
  citationsRequired?: boolean;
}

export interface AppliedClaimSummary {
  pageId: string;
  slug: string;
  claims: number;
  evidence: { exact: number; fuzzy: number; unverified: number; contradicts: number };
}

export interface ApplyWithCitationsResult {
  applied: ConceptAction[];
  warnings: string[];
  affectedPageIds: string[];
  claimSummaries: AppliedClaimSummary[];
}

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

function buildConceptProps(
  action: ConceptAction,
  prior: GatheredConcept | undefined
): Prisma.InputJsonValue {
  const today = new Date().toISOString().slice(0, 10);
  const aliases = Array.from(
    new Set([...(prior?.aliases ?? []), ...action.aliases])
  );
  let type = action.type || "concept";
  if (prior?.type === "person" && type === "concept") type = "person";
  return {
    type,
    tags: action.tags,
    aliases,
    firstSeen: prior?.firstSeen ?? today,
    lastSeen: today,
  };
}

/** Inline, tx-scoped next-version write (replaces createDocumentVersion). */
async function writeVersionOnTx(
  tx: Prisma.TransactionClient,
  pageId: string,
  tenantId: string,
  content: Prisma.InputJsonValue,
  plainText: string,
  changeNotes: string | undefined
): Promise<string> {
  const latest = await tx.documentVersion.findFirst({
    where: { pageId, tenantId },
    orderBy: { version: "desc" },
    select: { version: true, plainText: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;
  let diffFromPrev: Prisma.InputJsonValue | undefined;
  if (latest) {
    diffFromPrev = JSON.parse(
      JSON.stringify(computeTextDiff(latest.plainText, plainText))
    ) as Prisma.InputJsonValue;
  }
  const created = await tx.documentVersion.create({
    data: {
      pageId,
      tenantId,
      version: nextVersion,
      content,
      plainText,
      changeType: "AI_SUGGESTED",
      changeSource: "enrichment-engine",
      changeNotes: changeNotes ?? null,
      diffFromPrev: diffFromPrev ?? undefined,
    },
    select: { id: true },
  });
  return created.id;
}

/** Resolve/create the concept page + DOCUMENT block on the tx; returns page id. */
async function resolveConceptPageOnTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  action: ConceptAction,
  parentId: string,
  allowedParentIds: Set<string>,
  warnings: string[]
): Promise<string | null> {
  const externalId = conceptExternalId(action.slug);
  let pageId: string | null = null;

  if (action.action === "update") {
    const target = await tx.page.findFirst({
      where: { tenantId, externalId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!target) {
      pageId = null; // degrade to create
    } else if (!target.parentId || !allowedParentIds.has(target.parentId)) {
      warnings.push(
        `update to "${action.slug}" rejected: target is outside the Concepts subtree`
      );
      return null;
    } else {
      pageId = target.id;
    }
  }

  if (pageId === null) {
    try {
      const maxPos = await tx.page.aggregate({
        where: { tenantId, parentId },
        _max: { position: true },
      });
      const created = await tx.page.create({
        data: {
          tenantId,
          externalId,
          title: action.title,
          oneLiner: action.description,
          parentId,
          spaceType: "TEAM",
          position: (maxPos._max.position ?? -1) + 1,
        },
        select: { id: true },
      });
      await tx.block.create({
        data: {
          tenantId,
          pageId: created.id,
          type: "DOCUMENT",
          content: {} as Prisma.InputJsonValue,
          position: 0,
        },
      });
      pageId = created.id;
    } catch (err) {
      if (isP2002(err)) {
        const winner = await tx.page.findFirst({
          where: { tenantId, externalId, deletedAt: null },
          select: { id: true },
        });
        if (!winner) throw err;
        pageId = winner.id;
      } else {
        throw err;
      }
    }
  }
  return pageId;
}

/**
 * Persist the claims + evidence for ONE concept on the tx. SUPPORTS evidence
 * attaches to the NEW claim; a CONTRADICTS item attaches to the EXISTING claim
 * it names (validated tenant-consistent inside the tx) — never to the new claim.
 */
async function persistClaimsOnTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  pageId: string,
  versionId: string,
  claims: ClaimCitation[],
  chunkByIndex: Map<number, { id: string; text: string }>,
  warnings: string[],
  summary: AppliedClaimSummary
): Promise<void> {
  for (const claim of claims) {
    const claimKey = computeClaimKey(pageId, claim.text, versionId);
    const anchorTextSha = computeAnchorTextSha(claim.text);

    // Idempotent claim identity: same (tenantId, claimKey) collapses on retry.
    let claimId: string;
    const existingClaim = await tx.claim.findUnique({
      where: { tenantId_claimKey: { tenantId, claimKey } },
      select: { id: true },
    });
    if (existingClaim) {
      claimId = existingClaim.id;
    } else {
      try {
        const created = await tx.claim.create({
          data: {
            tenantId,
            pageId,
            text: claim.text,
            claimKey,
            anchorTextSha,
            documentVersionId: versionId,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        claimId = created.id;
      } catch (err) {
        if (!isP2002(err)) throw err;
        const winner = await tx.claim.findUnique({
          where: { tenantId_claimKey: { tenantId, claimKey } },
          select: { id: true },
        });
        if (!winner) throw err;
        claimId = winner.id;
      }
    }
    summary.claims++;

    for (const ev of claim.evidence) {
      const chunk = chunkByIndex.get(ev.chunkIndex);
      if (!chunk) {
        warnings.push(
          `evidence for "${claim.text.slice(0, 40)}…" references unknown chunkIndex ${ev.chunkIndex} — skipped`
        );
        continue;
      }

      if (ev.relation === "CONTRADICTS") {
        // Attaches to the EXISTING claim it refutes, validated tenant-consistent.
        if (!ev.claimId) {
          warnings.push(
            `CONTRADICTS evidence without a target claimId — skipped (never attached to the new claim)`
          );
          continue;
        }
        const target = await tx.claim.findFirst({
          where: { id: ev.claimId, tenantId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!target) {
          warnings.push(
            `CONTRADICTS target claim ${ev.claimId} not found in tenant — skipped`
          );
          continue;
        }
        const gate = matchQuote(ev.quotedText, chunk.text);
        const quoteSha256 = quoteShaFor(gate, target.id, chunk.id);
        await insertEvidence(tx, {
          tenantId,
          claimId: target.id,
          chunkId: chunk.id,
          gate,
          quoteSha256,
          relation: "CONTRADICTS",
          confidence: ev.confidence,
        });
        summary.evidence.contradicts++;
        if (gate.state === "EXACT") summary.evidence.exact++;
        else if (gate.state === "FUZZY") summary.evidence.fuzzy++;
        else summary.evidence.unverified++;
        continue;
      }

      // SUPPORTS → attaches to the new claim.
      const gate = matchQuote(ev.quotedText, chunk.text);
      const quoteSha256 = quoteShaFor(gate, claimId, chunk.id);
      await insertEvidence(tx, {
        tenantId,
        claimId,
        chunkId: chunk.id,
        gate,
        quoteSha256,
        relation: "SUPPORTS",
        confidence: ev.confidence,
      });
      if (gate.state === "EXACT") summary.evidence.exact++;
      else if (gate.state === "FUZZY") summary.evidence.fuzzy++;
      else summary.evidence.unverified++;
    }
  }
}

async function insertEvidence(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    claimId: string;
    chunkId: string;
    gate: ReturnType<typeof matchQuote>;
    quoteSha256: string;
    relation: "SUPPORTS" | "CONTRADICTS";
    confidence: number;
  }
): Promise<void> {
  try {
    await tx.claimEvidence.create({
      data: {
        tenantId: args.tenantId,
        claimId: args.claimId,
        chunkId: args.chunkId,
        matchedText: args.gate.matchedText,
        quoteSha256: args.quoteSha256,
        chunkCharStart: args.gate.chunkCharStart,
        chunkCharEnd: args.gate.chunkCharEnd,
        relation: args.relation,
        validationState: args.gate.state,
        confidence: args.confidence,
      },
    });
  } catch (err) {
    // Idempotent retry key @@unique([claimId, chunkId, quoteSha256]) — a repeat
    // of the exact same evidence collapses to a no-op.
    if (!isP2002(err)) throw err;
  }
}

/** The full apply performed on a single tx client (throws → caller rolls back). */
export async function applyPlanWithCitationsTx(
  tx: Prisma.TransactionClient,
  ctx: AgentContext,
  actions: ConceptAction[],
  options: ApplyWithCitationsOptions,
  existing: GatheredConcept[]
): Promise<ApplyWithCitationsResult> {
  const tenantId = ctx.tenantId;
  const parentId = options.targetCategoryId ?? options.conceptsCategoryId;
  if (!options.allowedParentIds.has(parentId)) {
    throw new Error(
      "Enrichment write target is outside the allowlisted Concepts subtree"
    );
  }

  // Resolve chunkIndex → persisted SourceChunk within (tenantId, sourceId).
  const chunkByIndex = new Map<number, { id: string; text: string }>();
  if (options.sourceId) {
    const chunks = await tx.sourceChunk.findMany({
      where: { tenantId, sourceId: options.sourceId },
      select: { id: true, chunkIndex: true, text: true },
    });
    for (const c of chunks) chunkByIndex.set(c.chunkIndex, { id: c.id, text: c.text });
  }

  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  const existingSlugs = new Set(bySlug.keys());
  const plannedSlugs = new Set(actions.map((a) => a.slug));

  const warnings: string[] = [];
  const applied: ConceptAction[] = [];
  const affectedPageIds: string[] = [];
  const claimSummaries: AppliedClaimSummary[] = [];

  for (const raw of actions) {
    const action = degradeAction(raw, existingSlugs);

    const dangling = findDangling(action, existingSlugs, plannedSlugs);
    if (dangling.length > 0) {
      warnings.push(`${action.slug} links to unknown concepts: ${dangling.join(", ")}`);
    }
    const dup = findDuplicateWarning(action, existing);
    if (dup) warnings.push(dup);

    if (options.citationsRequired && (!action.claims || action.claims.length === 0)) {
      // Service-layer "citations required": skip an uncited concept rather than
      // write a live body without provenance.
      warnings.push(
        `"${action.slug}" skipped: citations required but none were produced`
      );
      continue;
    }

    const pageId = await resolveConceptPageOnTx(
      tx,
      tenantId,
      action,
      parentId,
      options.allowedParentIds,
      warnings
    );
    if (pageId === null) continue;

    // Write the body + metadata on the tx.
    const { content } = markdownToTiptap(action.body_markdown);
    const tiptap = content as unknown as Prisma.InputJsonValue;
    await tx.block.updateMany({
      where: { pageId, tenantId, type: "DOCUMENT" },
      data: { content: tiptap },
    });
    await tx.page.update({
      where: { id: pageId },
      data: { title: action.title, oneLiner: action.description },
    });
    await tx.$executeRaw`
      UPDATE "pages"
      SET "properties" = jsonb_set(
        COALESCE("properties", '{}'::jsonb),
        '{concept}',
        ${JSON.stringify(buildConceptProps(action, bySlug.get(action.slug)))}::jsonb,
        true
      )
      WHERE "id" = ${pageId} AND "tenant_id" = ${tenantId}
    `;

    const plainText = extractPlainText(
      content as unknown as Parameters<typeof extractPlainText>[0]
    );
    const versionId = await writeVersionOnTx(
      tx,
      pageId,
      tenantId,
      tiptap,
      plainText,
      action.change_note || undefined
    );

    // Claims + evidence (quote-gated) on the SAME tx.
    const summary: AppliedClaimSummary = {
      pageId,
      slug: action.slug,
      claims: 0,
      evidence: { exact: 0, fuzzy: 0, unverified: 0, contradicts: 0 },
    };
    if (action.claims && action.claims.length > 0) {
      await persistClaimsOnTx(
        tx,
        tenantId,
        pageId,
        versionId,
        action.claims,
        chunkByIndex,
        warnings,
        summary
      );
    }
    claimSummaries.push(summary);

    // Audit row on the tx (AC6 — audit is part of the atomic write).
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: ctx.userId ?? null,
        apiKeyId: ctx.apiKeyId ?? null,
        action: action.action,
        resource: "page",
        resourceId: pageId,
        details: {
          slug: action.slug,
          title: action.title,
          source: "enrichment-engine",
          claims: summary.claims,
        } as Prisma.InputJsonValue,
      },
    });

    applied.push(action);
    affectedPageIds.push(pageId);
  }

  // Ledger write INSIDE the tx (AC6) — idempotent on @@unique([tenantId, hash]).
  try {
    await tx.ingestLedgerEntry.create({
      data: {
        tenantId,
        contentHash: options.contentHash,
        sourceName: options.sourceName,
        planSummary: null,
        actionCount: applied.length,
      },
    });
  } catch (err) {
    if (!isP2002(err)) throw err;
  }

  return { applied, warnings, affectedPageIds, claimSummaries };
}

/**
 * Open the single apply transaction with a P2002 retry (a version collision on
 * @@unique([pageId, version]) recomputes inside a fresh tx). Retention pruning
 * runs AFTER commit (deferred cleanup that must skip claim-referenced versions).
 */
export async function applyPlanWithCitations(
  ctx: AgentContext,
  actions: ConceptAction[],
  options: ApplyWithCitationsOptions
): Promise<ApplyWithCitationsResult> {
  const tenantId = ctx.tenantId;
  // Read-only context gather (safe outside the tx).
  const existing = await gatherConceptPages(tenantId, options.conceptsCategoryId);

  const runOnce = () =>
    prisma.$transaction((tx) =>
      applyPlanWithCitationsTx(tx, ctx, actions, options, existing)
    );

  let result: ApplyWithCitationsResult;
  try {
    result = await runOnce();
  } catch (err) {
    if (isP2002(err)) {
      result = await runOnce();
    } else {
      throw err;
    }
  }

  // Deferred, post-commit cleanup (never part of atomicity; claim-referenced
  // versions are skipped by pruneOldVersions).
  for (const pid of result.affectedPageIds) {
    try {
      await prisma.$transaction((tx) => pruneOldVersions(tx, pid, tenantId));
    } catch (err) {
      console.error("[applyPlanWithCitations] prune skipped:", err);
    }
  }

  return result;
}
