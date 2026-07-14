import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Structural subset of the Prisma client covering only the Aok* model
 * delegates. `Prisma.TransactionClient` (the interactive-transaction handle)
 * and the top-level `PrismaClient` are both assignable to this — so service
 * functions can accept either a `tx` (inside a transaction) or `prisma`
 * directly (plain reads that don't need transactional atomicity, e.g. search)
 * without duplicating signatures.
 */
export type AokDb = Pick<
  PrismaClient,
  | "aokSite"
  | "aokSpace"
  | "aokAsset"
  | "aokAnchor"
  | "aokKnowledge"
  | "aokVisit"
  | "aokCountLine"
>;
