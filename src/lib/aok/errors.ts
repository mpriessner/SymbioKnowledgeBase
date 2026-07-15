/**
 * Typed service-layer errors for the AOK (Anchored-Object Knowledge) API.
 *
 * Every message on this class is written to be read aloud by a voice agent
 * (Codex-critical: "all error responses are speakable sentences"). Routes
 * catch `AokServiceError` and translate it directly into the dual-envelope
 * `{ ok:false, error:<message> }` body via `aokError()` — see response.ts.
 */
export class AokServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AokServiceError";
  }
}

export function notFoundError(what: string): AokServiceError {
  return new AokServiceError(404, `That ${what} could not be found.`);
}

/** Child writes (knowledge/count/visit/anchor mint or bind) against a non-active asset. */
export function retiredAssetError(): AokServiceError {
  return new AokServiceError(409, "That object is retired.");
}

export function validationError(message: string): AokServiceError {
  return new AokServiceError(400, message);
}

/**
 * Generic 500 fallbacks (GLM-critical handler safety): every AOK route
 * wraps its handler body in try/catch so an unexpected throw never escapes
 * as a bare Next.js 500 — it always comes back as this speakable envelope.
 */
export const GENERIC_WRITE_ERROR = "Something went wrong saving that — try again.";
export const GENERIC_READ_ERROR = "Something went wrong looking that up — try again.";
