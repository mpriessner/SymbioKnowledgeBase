import type {
  RawExperimentData,
  FetcherOptions,
  FetcherResult,
  TransformedExperiment,
  FetcherStats,
} from "./fetcherTypes";
import { transformExperiment } from "./experimentTransformer";
import type { ChemElnListResponse } from "./types";

export interface ChemElnClient {
  fetchExperiments(options?: {
    page?: number;
    pageSize?: number;
    dateRange?: { start: string; end: string };
    researcher?: string;
    status?: string;
  }): Promise<ChemElnListResponse<RawExperimentData>>;
}

async function fetchPage(
  client: ChemElnClient,
  options: FetcherOptions,
  page: number
): Promise<ChemElnListResponse<RawExperimentData>> {
  return client.fetchExperiments({
    page,
    pageSize: options.pageSize ?? 50,
    dateRange: options.dateRange,
    researcher: options.researcher,
    status: options.status,
  });
}

export async function fetchAndTransformExperiments(
  client: ChemElnClient,
  options: FetcherOptions = {}
): Promise<FetcherResult> {
  const experiments: TransformedExperiment[] = [];
  const stats: FetcherStats = {
    total: 0,
    transformed: 0,
    skipped: 0,
    errors: 0,
  };

  const pageSize = options.pageSize ?? 50;
  let currentPage = options.page ?? 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchPage(client, options, currentPage);
    stats.total = response.total;

    for (const raw of response.data) {
      try {
        const transformed = transformExperiment(raw);
        experiments.push(transformed);
        stats.transformed++;
      } catch (error) {
        stats.errors++;
      }
    }

    const fetchedSoFar = currentPage * pageSize;
    hasMore = fetchedSoFar < response.total;
    currentPage++;
  }

  stats.skipped = stats.total - stats.transformed - stats.errors;

  return { experiments, stats };
}
