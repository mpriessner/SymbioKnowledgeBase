/**
 * SKB-52.5: Dead Letter Queue for failed sync operations.
 *
 * Stores failed sync payloads in-memory with console logging.
 * In production, this would be backed by a database table or message queue.
 * For now, failures are logged and stored in-memory for the process lifetime.
 */

interface SyncFailureEntry {
  id: string;
  elnExperimentId: string;
  action: string;
  target: string;
  payload: unknown;
  error: string;
  correlationId: string;
  createdAt: Date;
  retryCount: number;
}

// In-memory DLQ — persists for the lifetime of the process
const dlqEntries: SyncFailureEntry[] = [];

interface EnqueueParams {
  elnExperimentId: string;
  action: string;
  target: string;
  payload: unknown;
  error: string;
  correlationId: string;
}

/**
 * Enqueue a failed sync operation for later retry.
 */
export async function enqueueSyncFailure(params: EnqueueParams): Promise<void> {
  const entry: SyncFailureEntry = {
    id: `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    elnExperimentId: params.elnExperimentId,
    action: params.action,
    target: params.target,
    payload: params.payload,
    error: params.error,
    correlationId: params.correlationId,
    createdAt: new Date(),
    retryCount: 0,
  };

  dlqEntries.push(entry);

  console.warn(
    `[syncDLQ] Enqueued failed ${params.action} for ${params.elnExperimentId} → ${params.target}: ${params.error} (${entry.id})`
  );

  // Keep DLQ bounded (max 1000 entries)
  if (dlqEntries.length > 1000) {
    dlqEntries.splice(0, dlqEntries.length - 1000);
  }
}

/**
 * Get all DLQ entries (for debugging/monitoring).
 */
export function getDlqEntries(): SyncFailureEntry[] {
  return [...dlqEntries];
}

/**
 * Get DLQ entry count.
 */
export function getDlqCount(): number {
  return dlqEntries.length;
}

/**
 * Clear all DLQ entries (after manual retry or resolution).
 */
export function clearDlq(): void {
  dlqEntries.length = 0;
}
