"use client";

import { useState } from "react";
import { usePage } from "@/hooks/usePages";
import {
  usePublishStatus,
  usePublishPage,
  useUnpublishPage,
} from "@/hooks/usePublish";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { buildShareUrl, isLoopbackHost, pageNeedsPublishConfirmation } from "@/lib/qrcode/qrPayload";
import { encodeQr } from "@/lib/qrcode/qrEncoder";
import { matrixToSvgDataUrl } from "@/lib/qrcode/qrSvg";

interface QrPanelProps {
  pageId: string;
}

type QrResult = { dataUrl: string; shareUrl: string } | { error: string };

/**
 * Builds the QR image (or an explanatory error) for a published page. A
 * plain function rather than `useMemo` — encoding a short share URL is cheap,
 * and the React Compiler already auto-memoizes the component, so no manual
 * memoization is needed here.
 */
function computeQr(
  isPublished: boolean,
  shareToken: string | null | undefined,
  baseUrl: string | undefined
): QrResult | null {
  if (!isPublished || !shareToken) return null;

  if (!baseUrl) {
    return {
      error:
        "NEXT_PUBLIC_PUBLIC_BASE_URL is not configured — cannot generate a scannable QR code.",
    };
  }

  const shareUrl = buildShareUrl(baseUrl, shareToken);
  if (isLoopbackHost(shareUrl)) {
    return {
      error:
        "The configured base URL resolves to localhost, which a phone camera can't reach. Set NEXT_PUBLIC_PUBLIC_BASE_URL to a public host.",
    };
  }

  try {
    const matrix = encodeQr(shareUrl);
    return { dataUrl: matrixToSvgDataUrl(matrix), shareUrl };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to generate QR code.",
    };
  }
}

/**
 * Inline "Get QR" panel for a page's action menu (Section 2 of the a71-09
 * story). Publishes the page via the existing, unmodified
 * `POST /api/pages/[id]/publish` route if it isn't already published, then
 * renders a QR code for `${NEXT_PUBLIC_PUBLIC_BASE_URL}/shared/${share_token}`.
 *
 * Security guard (AC8): a PRIVATE or restricted-teamspace page is never
 * auto-published silently — an explicit confirmation is required first.
 */
export function QrPanel({ pageId }: QrPanelProps) {
  const { data: pageData } = usePage(pageId);
  const { data: statusData } = usePublishStatus(pageId);
  const publishPage = usePublishPage(pageId);
  const unpublishPage = useUnpublishPage(pageId);

  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const page = pageData?.data;
  const status = statusData?.data;
  const isPublished = status?.is_published ?? false;

  const baseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;

  const qr = computeQr(isPublished, status?.share_token, baseUrl);

  // Double-mint guard (AC10): disable "Get QR" while a publish is already in
  // flight, mirroring ShareDialogPublish's existing isPending pattern.
  const isBusy = publishPage.isPending || unpublishPage.isPending;

  const handleGetQr = () => {
    if (isPublished || isBusy) return;
    if (page && pageNeedsPublishConfirmation(page)) {
      setShowPublishConfirm(true);
      return;
    }
    publishPage.mutate();
  };

  const handleConfirmPublish = () => {
    setShowPublishConfirm(false);
    publishPage.mutate();
  };

  const handleConfirmRevoke = () => {
    setShowRevokeConfirm(false);
    unpublishPage.mutate();
  };

  return (
    <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-primary)]">QR code</p>
        {!isPublished && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGetQr}
            disabled={isBusy}
          >
            {isBusy ? "Publishing..." : "Get QR"}
          </Button>
        )}
      </div>

      {isPublished && qr && "error" in qr && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {qr.error}
        </p>
      )}

      {isPublished && qr && "dataUrl" in qr && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.dataUrl}
            alt={`QR code linking to ${page?.title ?? "this page"}`}
            className="h-40 w-40 border border-[var(--border-default)] bg-white p-2"
          />
          <p className="text-xs text-[var(--text-tertiary)]">
            {page?.oneLiner ? page.oneLiner : page?.title}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                window.open(`/print/qr-sheet?ids=${pageId}`, "_blank", "noopener")
              }
            >
              Print QR
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRevokeConfirm(true)}
              disabled={isBusy}
            >
              Revoke
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        title="Make this page public?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPublishConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmPublish}>
              Publish and generate QR
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          This page is private. Generating a QR code will publish it — this
          will make the page publicly viewable by anyone with the link, with
          no login required.
        </p>
      </Modal>

      <Modal
        isOpen={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        title="Revoke public link?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRevokeConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmRevoke}>
              Revoke
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Any QR code sticker already printed for this page will stop working —
          scanning it will show a not-found page. Re-publishing later mints a
          new link and requires reprinting; the old sticker can never be
          reactivated.
        </p>
      </Modal>
    </div>
  );
}
