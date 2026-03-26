/**
 * SKB-52.5 → Updated for Option C (one-way sync)
 *
 * SKB is a DOWNSTREAM CONSUMER of experiment data.
 * It receives events from ChemELN, ExpTube, and SciSymbio Lens
 * but NEVER pushes lifecycle changes back upstream.
 *
 * Archive/restore actions in SKB are local-only — they don't
 * affect source systems. This prevents accidental cascading deletes
 * and lets the KB curate its own organization independently.
 *
 * This file is intentionally a no-op. It exists so callers don't
 * need to be updated if we later decide to add selective propagation.
 */

interface PropagateOptions {
  source: string;
  correlationId?: string;
  fields?: Record<string, string>;
}

type SyncAction = "delete" | "restore" | "update" | "purge" | "archive";

/**
 * No-op: SKB does not propagate experiment events to other platforms.
 * (Option C: one-way sync — upstream systems push to SKB, SKB never pushes back)
 */
export function propagateExperimentEvent(
  elnId: string,
  action: SyncAction,
  options: PropagateOptions
): void {
  // Option C: SKB is read-only for experiment lifecycle.
  // Archive/restore/delete in SKB is local-only.
  console.log(
    `[experimentSync] No-op: SKB does not propagate ${action} for ${elnId} (Option C — one-way sync)`
  );
}
