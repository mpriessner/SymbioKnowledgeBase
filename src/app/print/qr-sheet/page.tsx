"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseIdsParam,
  validateBatchIds,
  planBatchPublish,
  buildShareUrl,
  isLoopbackHost,
} from "@/lib/qrcode/qrPayload";
import {
  fetchQrPageSummary,
  publishPageForQr,
  type QrPageSummary,
  type QrPageSummaryError,
} from "@/lib/qrcode/qrPublishClient";
import { encodeQr } from "@/lib/qrcode/qrEncoder";
import { matrixToSvgDataUrl } from "@/lib/qrcode/qrSvg";
import { Button } from "@/components/ui/Button";

interface RenderedItem {
  id: string;
  title: string;
  oneLiner: string | null;
  dataUrl: string;
}

interface PublishFailure {
  title: string;
  error: string;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "invalid"; message: string }
  | { phase: "confirm"; needsConfirmation: QrPageSummary[] }
  | { phase: "publishing" }
  | { phase: "blocked"; message: string }
  | { phase: "ready"; items: RenderedItem[]; failures: PublishFailure[] };

/**
 * Printable single/batch QR sheet (a71-09 Section 3). Selection rides in via
 * `?ids=u1,u2,...` (Round 2's data-passing contract). Client component: this
 * route needs selection state and `window.print()`, neither of which a plain
 * server component can do.
 */
function QrSheetPrintPageInner() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const ids = useMemo(() => parseIdsParam(idsParam), [idsParam]);

  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirmedBatch, setConfirmedBatch] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ phase: "loading" });

      const validation = validateBatchIds(ids);
      if (!validation.ok) {
        setState({ phase: "invalid", message: validation.message });
        return;
      }

      // AC9: refuse to render/print rather than emit an unscannable QR.
      if (!baseUrl) {
        setState({
          phase: "blocked",
          message:
            "NEXT_PUBLIC_PUBLIC_BASE_URL is not configured — cannot generate a scannable QR code.",
        });
        return;
      }
      if (isLoopbackHost(`${baseUrl}/shared/placeholder`)) {
        setState({
          phase: "blocked",
          message:
            "The configured base URL resolves to localhost, which a phone camera can't reach. Configure a public host.",
        });
        return;
      }

      const summaries = await Promise.all(ids.map(fetchQrPageSummary));
      if (cancelled) return;

      const errors = summaries.filter(
        (s): s is QrPageSummaryError => "error" in s
      );
      if (errors.length > 0) {
        setState({
          phase: "blocked",
          message: `Could not load ${errors.length} of ${ids.length} page(s): ${errors
            .map((e) => e.error)
            .join("; ")}`,
        });
        return;
      }

      const pages = summaries as QrPageSummary[];
      const plan = planBatchPublish(pages);

      // AC11: exactly one grouped confirmation for the whole batch, never
      // one per private page, and never a silent skip.
      if (plan.needsConfirmation.length > 0 && !confirmedBatch) {
        setState({ phase: "confirm", needsConfirmation: plan.needsConfirmation });
        return;
      }

      setState({ phase: "publishing" });

      const tokensByPageId = new Map<string, string>();
      for (const p of plan.alreadyPublished) {
        if (p.shareToken) tokensByPageId.set(p.id, p.shareToken);
      }

      // AC14: sequential publish, accumulate errors, no parallel fire-and-forget.
      const failures: PublishFailure[] = [];
      const toPublish = [...plan.autoPublishable, ...plan.needsConfirmation];
      for (const p of toPublish) {
        const result = await publishPageForQr(p.id);
        if (cancelled) return;
        if (result.ok && result.shareToken) {
          tokensByPageId.set(p.id, result.shareToken);
        } else {
          failures.push({ title: p.title, error: result.error ?? "Unknown error" });
        }
      }

      // AC13: render every QR before the print view is usable.
      const items: RenderedItem[] = [];
      for (const p of pages) {
        const token = tokensByPageId.get(p.id);
        if (!token) continue;
        const shareUrl = buildShareUrl(baseUrl, token);
        try {
          const matrix = encodeQr(shareUrl);
          items.push({
            id: p.id,
            title: p.title,
            oneLiner: p.oneLiner,
            dataUrl: matrixToSvgDataUrl(matrix),
          });
        } catch (err) {
          failures.push({
            title: p.title,
            error: err instanceof Error ? err.message : "Failed to render QR code",
          });
        }
      }

      if (cancelled) return;
      setState({ phase: "ready", items, failures });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ids, baseUrl, confirmedBatch]);

  const handleConfirmBatch = useCallback(() => {
    setConfirmedBatch(true);
  }, []);

  if (state.phase === "loading" || state.phase === "publishing") {
    return (
      <div className="p-8 text-sm text-gray-600">
        {state.phase === "publishing" ? "Publishing pages..." : "Loading..."}
      </div>
    );
  }

  if (state.phase === "invalid" || state.phase === "blocked") {
    return (
      <div className="p-8 text-sm text-red-600" role="alert">
        {state.message}
      </div>
    );
  }

  if (state.phase === "confirm") {
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="mb-2 text-lg font-semibold">Make these pages public?</h1>
        <p className="mb-4 text-sm text-gray-600">
          {state.needsConfirmation.length} of the selected pages are private
          or restricted. Generating their QR codes will publish them — this
          will make the pages publicly viewable by anyone with the link, with
          no login required:
        </p>
        <ul className="mb-4 list-disc pl-5 text-sm">
          {state.needsConfirmation.map((p) => (
            <li key={p.id}>{p.title}</li>
          ))}
        </ul>
        <Button onClick={handleConfirmBatch}>Publish and continue</Button>
      </div>
    );
  }

  return <QrSheet items={state.items} failures={state.failures} />;
}

function QrSheet({
  items,
  failures,
}: {
  items: RenderedItem[];
  failures: PublishFailure[];
}) {
  const [acknowledgedFailures, setAcknowledgedFailures] = useState(
    failures.length === 0
  );

  // AC13: printing stays disabled until every selected QR has actually
  // rendered — geometry alone ("no clipped QR") isn't enough, the code must
  // have been drawn.
  const allRendered = items.length > 0 && items.every((item) => !!item.dataUrl);
  const canPrint = allRendered && acknowledgedFailures;

  if (failures.length > 0 && !acknowledgedFailures) {
    return (
      <div className="qr-sheet-controls mx-auto max-w-lg p-8">
        <h1 className="mb-2 text-lg font-semibold text-red-600">
          {items.length} of {items.length + failures.length} published
        </h1>
        <p className="mb-2 text-sm">These pages failed:</p>
        <ul className="mb-4 list-disc pl-5 text-sm">
          {failures.map((f, i) => (
            <li key={i}>
              {f.title}: {f.error}
            </li>
          ))}
        </ul>
        {items.length > 0 ? (
          <Button onClick={() => setAcknowledgedFailures(true)}>
            Continue with {items.length} page{items.length === 1 ? "" : "s"}
          </Button>
        ) : (
          <p className="text-sm text-gray-600">No pages to print.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          .qr-sheet-controls { display: none; }
        }
      `}</style>

      <div className="qr-sheet-controls flex items-center justify-between p-4">
        <p className="text-sm text-gray-600">
          {items.length} QR code{items.length === 1 ? "" : "s"} ready to print
          (A4).
        </p>
        <Button onClick={() => window.print()} disabled={!canPrint}>
          Print
        </Button>
      </div>

      <div
        className="grid gap-6 p-8"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(60mm, 1fr))" }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col items-center gap-1 border border-gray-300 p-3 text-center"
            style={{ breakInside: "avoid" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.dataUrl}
              alt={`QR code for ${item.title}`}
              className="h-32 w-32"
            />
            <p className="text-sm font-medium">{item.title}</p>
            {item.oneLiner && (
              <p className="text-xs text-gray-600">{item.oneLiner}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QrSheetPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-600">Loading...</div>}>
      <QrSheetPrintPageInner />
    </Suspense>
  );
}
