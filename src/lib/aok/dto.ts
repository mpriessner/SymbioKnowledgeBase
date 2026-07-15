/**
 * Wire-format DTO mappers (Codex-critical): snake_case field names,
 * ISO-8601 UTC timestamp strings, JSON numbers for quantities (Prisma
 * `Float` — NOT `Decimal`, which would serialize as a string).
 */
import type { Prisma } from "@/generated/prisma/client";

type AokKnowledgeRow = Prisma.AokKnowledgeGetPayload<Record<string, never>>;
type AokVisitRow = Prisma.AokVisitGetPayload<Record<string, never>>;
type AokCountLineRow = Prisma.AokCountLineGetPayload<Record<string, never>>;
type AokAnchorRow = Prisma.AokAnchorGetPayload<Record<string, never>>;

export function knowledgeToDto(k: AokKnowledgeRow) {
  return {
    id: k.id,
    asset_id: k.assetId,
    kind: k.kind,
    text: k.text,
    review_status: k.reviewStatus,
    source: k.source,
    created_at: k.createdAt.toISOString(),
    updated_at: k.updatedAt.toISOString(),
  };
}

/** Trimmed shape used inside the asset card's `knowledge` list (newest 5, approved-only). */
export function knowledgeToCardDto(k: AokKnowledgeRow) {
  return {
    id: k.id,
    kind: k.kind,
    text: k.text,
    created_at: k.createdAt.toISOString(),
  };
}

export function visitToDto(v: AokVisitRow) {
  return {
    id: v.id,
    asset_id: v.assetId,
    reason: v.reason,
    outcome: v.outcome,
    notes: v.notes,
    worker_label: v.workerLabel,
    created_at: v.createdAt.toISOString(),
    updated_at: v.updatedAt.toISOString(),
  };
}

/** Trimmed shape used inside the asset card's `last_visits` list (newest 3). */
export function visitToCardDto(v: AokVisitRow) {
  return {
    id: v.id,
    reason: v.reason,
    outcome: v.outcome,
    notes: v.notes,
    created_at: v.createdAt.toISOString(),
  };
}

export function countLineToDto(c: AokCountLineRow) {
  return {
    id: c.id,
    asset_id: c.assetId,
    counted_qty: c.countedQty,
    unit: c.unit,
    expected_qty: c.expectedQty,
    delta: c.delta,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function anchorToDto(a: AokAnchorRow) {
  return {
    id: a.id,
    payload: a.payload,
    status: a.status,
    asset_id: a.assetId,
  };
}

/** Trimmed shape used inside the asset card's `anchors` list. */
export function anchorToCardDto(a: AokAnchorRow) {
  return {
    id: a.id,
    payload: a.payload,
    status: a.status,
  };
}
