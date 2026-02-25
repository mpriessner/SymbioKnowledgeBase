import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SharedPageContent } from "@/components/shared/SharedPageContent";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

async function getShareLink(token: string) {
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
    return null;
  }

  return shareLink;
}

export async function generateMetadata({
  params,
}: SharedPageProps): Promise<Metadata> {
  const { token } = await params;
  const shareLink = await getShareLink(token);

  if (!shareLink) {
    return { title: "Page not found" };
  }

  const { page, allowIndexing } = shareLink;
  const title = page.title || "Untitled";

  // Extract first paragraph text for description
  const paragraphBlock = page.blocks.find((b) => b.type === "PARAGRAPH");
  const description = paragraphBlock
    ? String((paragraphBlock.content as Record<string, unknown>)?.text ?? "")
        .slice(0, 160)
    : `Shared page: ${title}`;

  return {
    title,
    description,
    robots: allowIndexing
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
    },
  };
}

export default async function SharedPage({ params }: SharedPageProps) {
  const { token } = await params;
  const shareLink = await getShareLink(token);

  if (!shareLink) {
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

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-[var(--border-default)]">
          <p className="text-xs text-[var(--text-tertiary)]">
            Built with{" "}
            <span className="font-medium text-[var(--text-secondary)]">
              SymbioKnowledgeBase
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
