import type { SpaceType, GeneralAccess } from "@/types/page";

export interface QrPageSummary {
  id: string;
  title: string;
  oneLiner: string | null;
  spaceType: SpaceType;
  generalAccess: GeneralAccess;
  isPublished: boolean;
  shareToken: string | null;
}

export interface QrPageSummaryError {
  id: string;
  error: string;
}

/**
 * Loads what the QR print flow needs for one page: title/one-liner (for the
 * printed label) and current publish state (to decide whether it needs
 * publishing, and whether that requires the private-page confirmation).
 * Reuses the existing `GET /api/pages/[id]` and `GET /api/pages/[id]/publish`
 * routes unmodified — no new server endpoint.
 */
export async function fetchQrPageSummary(
  pageId: string
): Promise<QrPageSummary | QrPageSummaryError> {
  try {
    const [pageRes, publishRes] = await Promise.all([
      fetch(`/api/pages/${pageId}`),
      fetch(`/api/pages/${pageId}/publish`),
    ]);

    if (!pageRes.ok) {
      return { id: pageId, error: `Page not found (status ${pageRes.status})` };
    }

    const pageBody = await pageRes.json();
    const page = pageBody.data;

    let isPublished = false;
    let shareToken: string | null = null;
    if (publishRes.ok) {
      const publishBody = await publishRes.json();
      isPublished = Boolean(publishBody.data?.is_published);
      shareToken = publishBody.data?.share_token ?? null;
    }

    return {
      id: page.id,
      title: page.title,
      oneLiner: page.oneLiner ?? null,
      spaceType: page.spaceType,
      generalAccess: page.generalAccess ?? "INVITED_ONLY",
      isPublished,
      shareToken,
    };
  } catch (err) {
    return {
      id: pageId,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export interface PublishForQrResult {
  pageId: string;
  ok: boolean;
  shareToken?: string;
  error?: string;
}

/**
 * Calls the existing, unmodified `POST /api/pages/[id]/publish` route for a
 * batch member. Correctly treats 200 (idempotent re-publish) and 201 (first
 * publish) as success via `res.ok`, matching `usePublishPage`'s check —
 * never hand-rolls a `=== 200` comparison (that would misclassify a first
 * publish as a failure).
 */
export async function publishPageForQr(pageId: string): Promise<PublishForQrResult> {
  try {
    const res = await fetch(`/api/pages/${pageId}/publish`, { method: "POST" });
    if (!res.ok) {
      let message = `Failed to publish (status ${res.status})`;
      try {
        const body = await res.json();
        if (body?.error?.message) message = body.error.message;
      } catch {
        // Response body wasn't JSON — keep the generic status-based message.
      }
      return { pageId, ok: false, error: message };
    }
    const body = await res.json();
    return { pageId, ok: true, shareToken: body?.data?.share_token };
  } catch (err) {
    return {
      pageId,
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
