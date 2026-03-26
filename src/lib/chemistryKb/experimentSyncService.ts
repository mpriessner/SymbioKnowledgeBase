/**
 * SKB-52.5: Outgoing Experiment Sync Service
 *
 * Propagates experiment lifecycle events from SKB to ExpTube.
 * Fire-and-forget pattern — doesn't block the caller.
 * On failure, queues to the dead letter queue for retry.
 *
 * Anti-loop: skips propagation when source is 'exptube' or 'chemeln'.
 */

import { enqueueSyncFailure } from "./syncDeadLetterQueue";

const EXPTUBE_API_URL = process.env.EXPTUBE_API_URL;
const EXPTUBE_SERVICE_ROLE_KEY = process.env.EXPTUBE_SERVICE_ROLE_KEY;
const REQUEST_TIMEOUT_MS = 15000;

interface SyncPayload {
  experiment_id: string;
  action: "delete" | "restore" | "update" | "purge";
  source: string;
  correlation_id: string;
  fields?: Record<string, string>;
}

interface PropagateOptions {
  source: string;
  correlationId?: string;
  fields?: Record<string, string>;
}

/**
 * Propagate an experiment event to ExpTube.
 * Fire-and-forget — returns immediately, logs errors.
 *
 * @param elnId - The ELN experiment ID (e.g., "EXP-2025-0001")
 * @param action - The lifecycle action
 * @param options - Source, correlation ID, and optional fields
 */
export function propagateExperimentEvent(
  elnId: string,
  action: SyncPayload["action"],
  options: PropagateOptions
): void {
  // Anti-loop: never re-propagate events that originated from external systems
  if (options.source === "exptube" || options.source === "chemeln") {
    console.log(
      `[experimentSync] Skipping propagation — source is '${options.source}' (anti-loop)`
    );
    return;
  }

  // Fire-and-forget
  doPropagate(elnId, action, options).catch((error) => {
    console.error(
      `[experimentSync] Failed to propagate ${action} for ${elnId}:`,
      error
    );
  });
}

async function doPropagate(
  elnId: string,
  action: SyncPayload["action"],
  options: PropagateOptions
): Promise<void> {
  if (!EXPTUBE_API_URL || !EXPTUBE_SERVICE_ROLE_KEY) {
    console.warn(
      "[experimentSync] ExpTube integration not configured (EXPTUBE_API_URL / EXPTUBE_SERVICE_ROLE_KEY missing)"
    );
    return;
  }

  const correlationId =
    options.correlationId || `skb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const payload: SyncPayload = {
    experiment_id: elnId,
    action,
    source: "skb",
    correlation_id: correlationId,
    ...(options.fields ? { fields: options.fields } : {}),
  };

  const url = `${EXPTUBE_API_URL}/api/sync/experiments`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EXPTUBE_SERVICE_ROLE_KEY}`,
        "X-Source": "skb",
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    console.log(
      `[experimentSync] Propagated ${action} for ${elnId} to ExpTube (${correlationId})`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[experimentSync] Failed: ${action} ${elnId} → ${message}. Queueing to DLQ.`
    );

    // Queue to dead letter queue for retry
    await enqueueSyncFailure({
      elnExperimentId: elnId,
      action,
      target: "exptube",
      payload,
      error: message,
      correlationId,
    }).catch((dlqError) => {
      console.error("[experimentSync] DLQ enqueue also failed:", dlqError);
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
