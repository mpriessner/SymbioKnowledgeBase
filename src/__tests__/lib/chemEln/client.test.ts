import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChemElnClient, ChemElnRequestError } from "@/lib/chemEln/client";
import type { ChemElnConfig } from "@/lib/chemEln/types";

const TEST_CONFIG: ChemElnConfig = {
  baseUrl: "https://chemeln.example.com/api",
  apiKey: "test-api-key-123",
  timeout: 5000,
  retries: 3,
};

function mockFetchResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const sampleExperiment = {
  id: "EXP-001",
  title: "Suzuki Coupling Test",
  researcher: { name: "Jane Doe", email: "jane@lab.org", department: "Organic Chemistry" },
  date: "2026-03-15",
  status: "completed" as const,
  reaction_type: "suzuki-coupling",
  chemicals: [
    {
      name: "Phenylboronic acid",
      cas_number: "98-80-6",
      molecular_weight: 121.93,
      role: "reagent" as const,
      amount: 1.5,
      unit: "mmol",
    },
  ],
  procedure: "Standard Suzuki coupling procedure",
  results: "Product isolated in good yield",
  yield: 85.2,
  notes: "Reaction ran smoothly",
};

describe("ChemElnClient", () => {
  let client: ChemElnClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new ChemElnClient(TEST_CONFIG);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getExperiment", () => {
    it("should fetch an experiment by id", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(sampleExperiment));

      const result = await client.getExperiment("EXP-001");

      expect(result).toEqual(sampleExperiment);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://chemeln.example.com/api/experiments/EXP-001",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ "X-API-Key": "test-api-key-123" }),
        })
      );
    });

    it("should encode special characters in experiment id", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(sampleExperiment));

      await client.getExperiment("EXP/001");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("EXP%2F001"),
        expect.anything()
      );
    });
  });

  describe("listExperiments", () => {
    const listResponse = {
      data: [sampleExperiment],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    it("should list experiments with default options", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(listResponse));

      const result = await client.listExperiments();

      expect(result).toEqual(listResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://chemeln.example.com/api/experiments",
        expect.anything()
      );
    });

    it("should pass pagination parameters", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(listResponse));

      await client.listExperiments({ page: 2, pageSize: 50 });

      const calledUrl = (fetchSpy.mock.calls[0] as [string])[0];
      expect(calledUrl).toContain("page=2");
      expect(calledUrl).toContain("pageSize=50");
    });

    it("should pass filter parameters", async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(listResponse));

      await client.listExperiments({
        since: "2026-01-01",
        researcher: "Jane Doe",
        status: "completed",
      });

      const calledUrl = (fetchSpy.mock.calls[0] as [string])[0];
      expect(calledUrl).toContain("since=2026-01-01");
      expect(calledUrl).toContain("researcher=Jane+Doe");
      expect(calledUrl).toContain("status=completed");
    });
  });

  describe("getChemicals", () => {
    it("should fetch chemicals for an experiment", async () => {
      const chemicals = sampleExperiment.chemicals;
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(chemicals));

      const result = await client.getChemicals("EXP-001");

      expect(result).toEqual(chemicals);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://chemeln.example.com/api/experiments/EXP-001/chemicals",
        expect.anything()
      );
    });
  });

  describe("getResearcher", () => {
    it("should fetch a researcher by name", async () => {
      const researcher = sampleExperiment.researcher;
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(researcher));

      const result = await client.getResearcher("Jane Doe");

      expect(result).toEqual(researcher);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("researchers/Jane%20Doe"),
        expect.anything()
      );
    });
  });

  describe("listResearchers", () => {
    it("should fetch all researchers", async () => {
      const researchers = [sampleExperiment.researcher];
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(researchers));

      const result = await client.listResearchers();

      expect(result).toEqual(researchers);
    });
  });

  describe("error handling", () => {
    it("should throw ChemElnRequestError on 404", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse(
          { code: "NOT_FOUND", message: "Experiment not found", details: null },
          { status: 404 }
        )
      );

      await expect(client.getExperiment("NONEXISTENT")).rejects.toThrow(
        ChemElnRequestError
      );

      try {
        fetchSpy.mockResolvedValueOnce(
          mockFetchResponse(
            { code: "NOT_FOUND", message: "Experiment not found", details: null },
            { status: 404 }
          )
        );
        await client.getExperiment("NONEXISTENT");
      } catch (err) {
        expect(err).toBeInstanceOf(ChemElnRequestError);
        const reqErr = err as ChemElnRequestError;
        expect(reqErr.statusCode).toBe(404);
        expect(reqErr.code).toBe("NOT_FOUND");
      }
    });

    it("should handle non-JSON error responses", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 502,
          statusText: "Bad Gateway",
        })
      );

      // With retries=3, it will retry on 5xx. Mock remaining attempts.
      fetchSpy.mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 502,
          statusText: "Bad Gateway",
        })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 502,
          statusText: "Bad Gateway",
        })
      );

      await expect(client.getExperiment("EXP-001")).rejects.toThrow(
        ChemElnRequestError
      );
    });
  });

  describe("retry logic", () => {
    it("should retry on 500 errors up to config.retries times", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse(
          { code: "INTERNAL", message: "Server error", details: null },
          { status: 500 }
        )
      );
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse(
          { code: "INTERNAL", message: "Server error", details: null },
          { status: 500 }
        )
      );
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(sampleExperiment));

      const result = await client.getExperiment("EXP-001");

      expect(result).toEqual(sampleExperiment);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("should throw after exhausting retries on 500", async () => {
      for (let i = 0; i < 3; i++) {
        fetchSpy.mockResolvedValueOnce(
          mockFetchResponse(
            { code: "INTERNAL", message: "Server error", details: null },
            { status: 500 }
          )
        );
      }

      await expect(client.getExperiment("EXP-001")).rejects.toThrow(
        ChemElnRequestError
      );
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("should retry on network errors", async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
      fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(sampleExperiment));

      const result = await client.getExperiment("EXP-001");

      expect(result).toEqual(sampleExperiment);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("should throw network error after exhausting retries", async () => {
      for (let i = 0; i < 3; i++) {
        fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
      }

      await expect(client.getExperiment("EXP-001")).rejects.toThrow(
        "fetch failed"
      );
    });

    it("should not retry on 4xx errors (except 429)", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse(
          { code: "BAD_REQUEST", message: "Invalid id", details: null },
          { status: 400 }
        )
      );

      await expect(client.getExperiment("bad")).rejects.toThrow(
        ChemElnRequestError
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("rate limiting", () => {
    it("should respect 429 responses with retry-after header", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ code: "RATE_LIMITED", message: "Too many requests", details: null }),
        {
          status: 429,
          headers: { "retry-after": "1", "Content-Type": "application/json" },
        }
      );
      fetchSpy.mockResolvedValueOnce(rateLimitResponse);
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(sampleExperiment));

      const result = await client.getExperiment("EXP-001");

      expect(result).toEqual(sampleExperiment);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("should use default delay when retry-after header is missing", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ code: "RATE_LIMITED", message: "Too many requests", details: null }),
        { status: 429 }
      );
      fetchSpy.mockResolvedValueOnce(rateLimitResponse);
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(sampleExperiment));

      const result = await client.getExperiment("EXP-001");

      expect(result).toEqual(sampleExperiment);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
