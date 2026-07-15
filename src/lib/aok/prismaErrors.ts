import { Prisma } from "@/generated/prisma/client";

/** True for a unique-constraint violation (Postgres P2002 via Prisma). */
export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}
