/**
 * W81-C1 — local-model (Ollama) client for the cheap triage tier.
 *
 * The worker reaches Ollama by SERVICE NAME (`OLLAMA_BASE_URL`, e.g.
 * `http://ollama:11434` in Compose, `http://host.docker.internal:11434` in dev)
 * over the native `/api/*` endpoints. Two review-hardened rules (Codex R1):
 *
 *  1. **Model pinned by DIGEST, not a mutable tag.** `/api/show` returns the
 *     model's content digest; the resolved digest is stamped onto every finding /
 *     SourceRelevance row so a model swap is auditable and selectively
 *     recomputable. `OLLAMA_MODEL` is the human tag; `resolveModelDigest()` turns
 *     it into the immutable identity.
 *  2. **Readiness = the configured model is LOADED, not merely port-reachable.**
 *     `checkReadiness()` calls `/api/tags` and confirms the configured model is
 *     present. A reachable daemon with the model absent is NOT ready — the worker
 *     treats that exactly like "Ollama down": deterministic passes still run,
 *     model passes DEFER.
 *
 * `fetchImpl` is injectable so unit tests exercise every branch (ready, down,
 * missing-model, malformed JSON, timeout) without a live daemon.
 */

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  /** Per-request timeout (ms). Kept short — the worker never blocks on a hang. */
  timeoutMs: number;
}

export type FetchImpl = typeof fetch;

export interface Readiness {
  ready: boolean;
  /** Immutable content digest of the configured model, when resolvable. */
  modelDigest: string | null;
  reason?: string;
}

/** Thrown when a model call can't complete — the caller DEFERS, never crashes. */
export class OllamaUnavailableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

export function ollamaConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): OllamaConfig {
  return {
    baseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    model: env.OLLAMA_MODEL ?? "llama3.1:8b",
    timeoutMs: Number(env.OLLAMA_TIMEOUT_MS ?? 30_000),
  };
}

export class OllamaClient {
  private readonly fetchImpl: FetchImpl;
  private cachedDigest: string | null = null;

  constructor(
    private readonly config: OllamaConfig,
    fetchImpl?: FetchImpl
  ) {
    // Bind so a passed `fetch` keeps its `this` (undici/global fetch require it).
    this.fetchImpl = fetchImpl ?? ((...a) => fetch(...a));
  }

  get model(): string {
    return this.config.model;
  }

  private async call(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new OllamaUnavailableError(
          `Ollama ${path} returned HTTP ${res.status}`
        );
      }
      return await res.json();
    } catch (err) {
      if (err instanceof OllamaUnavailableError) throw err;
      throw new OllamaUnavailableError(
        `Ollama ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Confirm the daemon is reachable AND the configured model is loaded. Returns
   * `{ ready:false }` (never throws) for the worker's degrade path.
   */
  async checkReadiness(): Promise<Readiness> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ready: false, modelDigest: null, reason: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as {
        models?: Array<{ name?: string; model?: string; digest?: string }>;
      };
      const models = Array.isArray(data.models) ? data.models : [];
      const match = models.find(
        (m) => m.name === this.config.model || m.model === this.config.model
      );
      if (!match) {
        return {
          ready: false,
          modelDigest: null,
          reason: `model '${this.config.model}' not loaded`,
        };
      }
      const digest = match.digest ? `sha256:${match.digest.replace(/^sha256:/, "")}` : this.config.model;
      this.cachedDigest = digest;
      return { ready: true, modelDigest: digest };
    } catch (err) {
      return {
        ready: false,
        modelDigest: null,
        reason: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** The last resolved model digest (populated by checkReadiness). */
  get modelDigest(): string | null {
    return this.cachedDigest;
  }

  /**
   * Single-turn classification. Returns the raw model text. Throws
   * OllamaUnavailableError on any transport/parse failure so the caller DEFERS.
   */
  async generate(prompt: string, system?: string): Promise<string> {
    const data = (await this.call("/api/generate", {
      model: this.config.model,
      prompt,
      system,
      stream: false,
      options: { temperature: 0 },
    })) as { response?: string };
    if (typeof data.response !== "string") {
      throw new OllamaUnavailableError("Ollama /api/generate: missing response");
    }
    return data.response;
  }
}

/**
 * The narrow local-model surface the passes depend on. A test double implements
 * this without any HTTP — keeping the four passes fully unit-testable.
 */
export interface TriageModel {
  /** Immutable digest of the loaded model, or null when unresolved. */
  readonly modelDigest: string | null;
  checkReadiness(): Promise<Readiness>;
  /**
   * Yes/no/maybe on whether two texts DISAGREE (pass d), or a 0..1 relevance
   * score of a source to a concept page (pass b). Returns a normalized verdict.
   */
  generate(prompt: string, system?: string): Promise<string>;
}
