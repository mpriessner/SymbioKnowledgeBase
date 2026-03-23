import type {
  ChemElnConfig,
  ChemElnExperiment,
  ChemElnChemical,
  ChemElnResearcher,
  ChemElnListResponse,
  ChemElnError,
} from "./types";

export interface ListExperimentsOptions {
  page?: number;
  pageSize?: number;
  since?: string;
  researcher?: string;
  status?: string;
}

class ChemElnRequestError extends Error {
  readonly code: string;
  readonly details: string | null;
  readonly statusCode: number;

  constructor(statusCode: number, error: ChemElnError) {
    super(error.message);
    this.name = "ChemElnRequestError";
    this.code = error.code;
    this.details = error.details;
    this.statusCode = statusCode;
  }
}

export class ChemElnClient {
  private readonly config: ChemElnConfig;

  constructor(config: ChemElnConfig) {
    this.config = config;
  }

  async getExperiment(id: string): Promise<ChemElnExperiment> {
    return this.request<ChemElnExperiment>(`/experiments/${encodeURIComponent(id)}`);
  }

  async listExperiments(
    options: ListExperimentsOptions = {}
  ): Promise<ChemElnListResponse<ChemElnExperiment>> {
    const params = new URLSearchParams();
    if (options.page !== undefined) params.set("page", String(options.page));
    if (options.pageSize !== undefined) params.set("pageSize", String(options.pageSize));
    if (options.since) params.set("since", options.since);
    if (options.researcher) params.set("researcher", options.researcher);
    if (options.status) params.set("status", options.status);

    const query = params.toString();
    const path = query ? `/experiments?${query}` : "/experiments";
    return this.request<ChemElnListResponse<ChemElnExperiment>>(path);
  }

  async getChemicals(experimentId: string): Promise<ChemElnChemical[]> {
    return this.request<ChemElnChemical[]>(
      `/experiments/${encodeURIComponent(experimentId)}/chemicals`
    );
  }

  async getResearcher(name: string): Promise<ChemElnResearcher> {
    return this.request<ChemElnResearcher>(
      `/researchers/${encodeURIComponent(name)}`
    );
  }

  async listResearchers(): Promise<ChemElnResearcher[]> {
    return this.request<ChemElnResearcher[]>("/researchers");
  }

  private async request<T>(path: string, attempt = 1): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": this.config.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (attempt < this.config.retries) {
        return this.request<T>(path, attempt + 1);
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Request to ${url} timed out after ${this.config.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
      await this.sleep(delayMs);
      return this.request<T>(path, attempt);
    }

    if (!response.ok) {
      let errorBody: ChemElnError;
      try {
        errorBody = (await response.json()) as ChemElnError;
      } catch {
        errorBody = {
          code: `HTTP_${response.status}`,
          message: response.statusText,
          details: null,
        };
      }

      if (response.status >= 500 && attempt < this.config.retries) {
        return this.request<T>(path, attempt + 1);
      }

      throw new ChemElnRequestError(response.status, errorBody);
    }

    return (await response.json()) as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { ChemElnRequestError };
