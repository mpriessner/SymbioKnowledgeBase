import { prisma } from "@/lib/db";

/**
 * Looks up a public share link by token, honoring the same
 * revoked/expired null-check used by the HTML shared-page view
 * (src/app/shared/[token]/page.tsx) and its plain-text/JSON export
 * sibling (src/app/shared/[token]/export/route.ts).
 *
 * Returns null for an unknown, revoked, or expired token so both
 * callers 404 identically rather than each re-implementing (and
 * potentially drifting on) the same check.
 */
export async function getShareLink(token: string) {
  const shareLink = await prisma.publicShareLink.findUnique({
    where: { token },
    include: {
      page: {
        include: {
          blocks: {
            orderBy: { position: "asc" },
          },
          teamspace: { select: { name: true } },
        },
      },
      createdByUser: { select: { name: true } },
    },
  });

  if (
    !shareLink ||
    shareLink.revokedAt !== null ||
    shareLink.expiresAt < new Date()
  ) {
    return null;
  }

  return shareLink;
}
