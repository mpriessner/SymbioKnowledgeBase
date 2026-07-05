import { NextRequest, NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import { getShareLink } from "@/lib/pages/shareLink";
import { tiptapToMarkdown } from "@/lib/markdown/serializer";

interface ExportRouteContext {
  params: Promise<{ token: string }>;
}

/**
 * Plain-text/JSON export of a public shared page, reachable at the SAME
 * public URL as the HTML view (`GET /shared/{token}?format=json|text`) via
 * the rewrite in next.config.ts. Kept as a sibling route segment
 * (`/shared/[token]/export`) because Next.js does not allow a `route.ts`
 * and `page.tsx` to coexist at the same segment — the rewrite is what
 * makes this transparent to callers.
 *
 * This exists so QR scanners (companion + Android, a71-10) can resolve a
 * scanned SKB page's content without scraping the TipTap/React HTML that
 * `page.tsx` renders.
 *
 * Public, unauthenticated — mirrors the existing HTML view exactly. Honors
 * the same revoked/expired null-check via the shared `getShareLink` helper
 * so a dead token 404s here too, never leaking content.
 */
export async function GET(request: NextRequest, { params }: ExportRouteContext) {
  const { token } = await params;
  const shareLink = await getShareLink(token);

  if (!shareLink) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const { page } = shareLink;
  const documentBlock = page.blocks.find((b) => b.type === "DOCUMENT");
  const editorContent = documentBlock
    ? (documentBlock.content as JSONContent)
    : null;
  const markdown = editorContent
    ? tiptapToMarkdown(editorContent, { includeFrontmatter: false })
    : "";

  const format = request.nextUrl.searchParams.get("format");

  if (format === "text") {
    return new NextResponse(markdown, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json(
    {
      title: page.title,
      markdown,
      externalId: page.externalId ?? null,
    },
    { status: 200 }
  );
}
