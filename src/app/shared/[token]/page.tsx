import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SharedPageContent } from "@/components/shared/SharedPageContent";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedPage({ params }: SharedPageProps) {
  const { token } = await params;

  const shareLink = await prisma.publicShareLink.findUnique({
    where: { token },
    include: {
      page: {
        include: {
          blocks: {
            where: { deletedAt: null },
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
    notFound();
  }

  const { page, createdByUser } = shareLink;

  // Extract the DOCUMENT block content for the TipTap editor
  const documentBlock = page.blocks.find((b) => b.type === "DOCUMENT");
  const editorContent = documentBlock
    ? (documentBlock.content as Record<string, unknown>)
    : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="mx-auto max-w-4xl px-8 py-12">
        {/* Shared header */}
        <div className="mb-8">
          <p className="text-sm text-[var(--text-tertiary)]">
            Shared by {createdByUser.name || "Unknown"} via{" "}
            {page.teamspace?.name || "Private"}
          </p>
          <h1 className="mt-2 text-4xl font-bold text-[var(--text-primary)]">
            {page.icon ? `${page.icon} ` : ""}
            {page.title}
          </h1>
        </div>

        {/* Read-only content */}
        {editorContent ? (
          <SharedPageContent content={editorContent} />
        ) : (
          <p className="text-[var(--text-tertiary)]">
            This page has no content.
          </p>
        )}
      </div>
    </div>
  );
}
