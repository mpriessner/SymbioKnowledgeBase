import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  TenantIsolationVerifier,
  getChemELNTenantId,
  getTenantPages,
  getTenantWikilinks,
  checkCrossTenantReferences,
  type TenantIsolationDb,
  type IsolationReport,
} from "@/lib/chemEln/enrichment/tenantIsolation";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

/**
 * Create a mock database client for tenant isolation tests.
 * All query methods return configurable data arrays.
 */
function createMockDb(overrides?: {
  pages?: Array<{
    id: string;
    tenantId: string;
    title: string;
    icon: string | null;
    oneLiner: string | null;
  }>;
  pageLinks?: Array<{
    id: string;
    tenantId: string;
    sourcePageId: string;
    targetPageId: string;
    sourcePage: { tenantId: string };
    targetPage: { tenantId: string };
  }>;
  blocks?: Array<{
    id: string;
    tenantId: string;
    pageId: string;
    plainText: string;
  }>;
}): TenantIsolationDb {
  const pages = overrides?.pages ?? [];
  const pageLinks = overrides?.pageLinks ?? [];
  const blocks = overrides?.blocks ?? [];

  return {
    page: {
      findMany: async (args: { where: { tenantId: string } }) => {
        return pages.filter((p) => p.tenantId === args.where.tenantId);
      },
    },
    pageLink: {
      findMany: async (args: { where: { tenantId: string } }) => {
        return pageLinks.filter((l) => l.tenantId === args.where.tenantId);
      },
    },
    block: {
      findMany: async (args: { where: { tenantId: string } }) => {
        return blocks.filter((b) => b.tenantId === args.where.tenantId);
      },
    },
  };
}

/**
 * Helper to create a page fixture.
 */
function makePage(
  id: string,
  tenantId: string,
  title: string,
  icon: string | null = null,
  oneLiner: string | null = null
) {
  return { id, tenantId, title, icon, oneLiner };
}

/**
 * Helper to create a page link fixture.
 */
function makeLink(
  id: string,
  tenantId: string,
  sourcePageId: string,
  targetPageId: string,
  sourceTenantId: string,
  targetTenantId: string
) {
  return {
    id,
    tenantId,
    sourcePageId,
    targetPageId,
    sourcePage: { tenantId: sourceTenantId },
    targetPage: { tenantId: targetTenantId },
  };
}

describe("getChemELNTenantId", () => {
  const originalEnv = process.env.CHEMELN_TENANT_ID;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CHEMELN_TENANT_ID = originalEnv;
    } else {
      delete process.env.CHEMELN_TENANT_ID;
    }
  });

  it("should return tenant ID from environment", () => {
    process.env.CHEMELN_TENANT_ID = TENANT_A;
    expect(getChemELNTenantId()).toBe(TENANT_A);
  });

  it("should throw if CHEMELN_TENANT_ID not set", () => {
    delete process.env.CHEMELN_TENANT_ID;
    expect(() => getChemELNTenantId()).toThrow(
      "CHEMELN_TENANT_ID environment variable not set"
    );
  });

  it("should throw if CHEMELN_TENANT_ID is not a valid UUID", () => {
    process.env.CHEMELN_TENANT_ID = "not-a-uuid";
    expect(() => getChemELNTenantId()).toThrow(
      "Invalid CHEMELN_TENANT_ID format"
    );
  });

  it("should accept uppercase UUID", () => {
    process.env.CHEMELN_TENANT_ID = TENANT_A.toUpperCase();
    expect(getChemELNTenantId()).toBe(TENANT_A.toUpperCase());
  });
});

describe("getTenantPages", () => {
  it("should return only pages for the specified tenant", async () => {
    const db = createMockDb({
      pages: [
        makePage("p1", TENANT_A, "Page A1"),
        makePage("p2", TENANT_A, "Page A2"),
        makePage("p3", TENANT_B, "Page B1"),
      ],
    });

    const result = await getTenantPages(TENANT_A, db);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.tenantId === TENANT_A)).toBe(true);
  });

  it("should return empty array if tenant has no pages", async () => {
    const db = createMockDb({ pages: [] });
    const result = await getTenantPages(TENANT_A, db);
    expect(result).toHaveLength(0);
  });
});

describe("getTenantWikilinks", () => {
  it("should return only links for the specified tenant", async () => {
    const db = createMockDb({
      pageLinks: [
        makeLink("l1", TENANT_A, "p1", "p2", TENANT_A, TENANT_A),
        makeLink("l2", TENANT_B, "p3", "p4", TENANT_B, TENANT_B),
      ],
    });

    const result = await getTenantWikilinks(TENANT_A, db);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("l1");
  });
});

describe("checkCrossTenantReferences", () => {
  it("should return empty array when all links are within tenant", async () => {
    const db = createMockDb({
      pageLinks: [
        makeLink("l1", TENANT_A, "p1", "p2", TENANT_A, TENANT_A),
        makeLink("l2", TENANT_A, "p2", "p3", TENANT_A, TENANT_A),
      ],
    });

    const result = await checkCrossTenantReferences(TENANT_A, db);
    expect(result).toHaveLength(0);
  });

  it("should detect cross-tenant target link", async () => {
    const db = createMockDb({
      pageLinks: [
        makeLink("l1", TENANT_A, "p1", "p2", TENANT_A, TENANT_B),
      ],
    });

    const result = await checkCrossTenantReferences(TENANT_A, db);
    expect(result).toHaveLength(1);
    expect(result[0].targetPage.tenantId).toBe(TENANT_B);
  });

  it("should detect cross-tenant source link", async () => {
    const db = createMockDb({
      pageLinks: [
        makeLink("l1", TENANT_A, "p1", "p2", TENANT_B, TENANT_A),
      ],
    });

    const result = await checkCrossTenantReferences(TENANT_A, db);
    expect(result).toHaveLength(1);
    expect(result[0].sourcePage.tenantId).toBe(TENANT_B);
  });
});

describe("TenantIsolationVerifier", () => {
  describe("verifyIsolation — all checks pass", () => {
    it("should return passed=true for properly isolated data", async () => {
      const db = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Suzuki Coupling Experiment", "\u{1F9EA}", "eln:EXP-001"),
          makePage("p2", TENANT_A, "Palladium Catalyst", "\u2697\uFE0F", "cas:7440-05-3"),
          makePage("p3", TENANT_A, "Dr. Smith", "\u{1F469}\u200D\u{1F52C}", "researcher:smith"),
        ],
        pageLinks: [
          makeLink("l1", TENANT_A, "p1", "p2", TENANT_A, TENANT_A),
          makeLink("l2", TENANT_A, "p1", "p3", TENANT_A, TENANT_A),
        ],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      expect(report.passed).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.checks).toHaveLength(5);
      expect(report.checks.every((c) => c.passed)).toBe(true);
    });
  });

  describe("verifyIsolation — cross-tenant wikilinks", () => {
    it("should detect cross-tenant wikilinks and fail", async () => {
      const db = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Experiment A", "\u{1F9EA}"),
        ],
        pageLinks: [
          makeLink("l1", TENANT_A, "p1", "p-foreign", TENANT_A, TENANT_B),
        ],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      expect(report.passed).toBe(false);
      const wikilinkCheck = report.checks.find(
        (c) => c.name === "wikilink-isolation"
      );
      expect(wikilinkCheck?.passed).toBe(false);
      expect(wikilinkCheck?.details).toContain("1 cross-tenant wikilink");
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors[0]).toContain("Cross-tenant wikilink");
    });
  });

  describe("verifyIsolation — CAS number handling", () => {
    it("should allow duplicate CAS across different tenants", async () => {
      const dbA = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Palladium (7440-05-3)", "\u2697\uFE0F"),
        ],
        pageLinks: [],
      });

      const dbB = createMockDb({
        pages: [
          makePage("p2", TENANT_B, "Palladium (7440-05-3)", "\u2697\uFE0F"),
        ],
        pageLinks: [],
      });

      const verifierA = new TenantIsolationVerifier(dbA);
      const reportA = await verifierA.verifyIsolation(TENANT_A);
      expect(reportA.passed).toBe(true);

      const verifierB = new TenantIsolationVerifier(dbB);
      const reportB = await verifierB.verifyIsolation(TENANT_B);
      expect(reportB.passed).toBe(true);
    });

    it("should warn on duplicate CAS within the same tenant", async () => {
      const db = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Palladium (7440-05-3)", "\u2697\uFE0F"),
          makePage("p2", TENANT_A, "Palladium Catalyst (7440-05-3)", "\u2697\uFE0F"),
        ],
        pageLinks: [],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      // Duplicate CAS within tenant is a warning, not a failure
      expect(report.passed).toBe(true);
      const casCheck = report.checks.find((c) => c.name === "cas-uniqueness");
      expect(casCheck?.passed).toBe(true);
      expect(casCheck?.details).toContain("duplicate CAS");
      expect(report.warnings.some((w) => w.includes("7440-05-3"))).toBe(true);
    });
  });

  describe("verifyIsolation — researcher isolation", () => {
    it("should pass when all researchers belong to tenant", async () => {
      const db = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Dr. Smith", "\u{1F469}\u200D\u{1F52C}"),
          makePage("p2", TENANT_A, "Dr. Jones", "\u{1F469}\u200D\u{1F52C}"),
        ],
        pageLinks: [],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      const researcherCheck = report.checks.find(
        (c) => c.name === "researcher-isolation"
      );
      expect(researcherCheck?.passed).toBe(true);
      expect(researcherCheck?.details).toContain("2 researcher page(s)");
    });
  });

  describe("verifyIsolation — tag namespace scoping", () => {
    it("should pass when all tagged pages belong to tenant", async () => {
      const db = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Experiment 1", "\u{1F9EA}", "eln:EXP-001"),
          makePage("p2", TENANT_A, "Chemical X", "\u2697\uFE0F", "cas:123-45-6"),
        ],
        pageLinks: [],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      const tagCheck = report.checks.find(
        (c) => c.name === "tag-namespace-scoping"
      );
      expect(tagCheck?.passed).toBe(true);
    });
  });

  describe("report generation", () => {
    it("should generate a complete report with all five checks", async () => {
      const db = createMockDb({
        pages: [],
        pageLinks: [],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      expect(report.checks).toHaveLength(5);
      const checkNames = report.checks.map((c) => c.name);
      expect(checkNames).toContain("page-ownership");
      expect(checkNames).toContain("wikilink-isolation");
      expect(checkNames).toContain("tag-namespace-scoping");
      expect(checkNames).toContain("researcher-isolation");
      expect(checkNames).toContain("cas-uniqueness");
    });

    it("should collect errors and warnings separately", async () => {
      const db = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Palladium (7440-05-3)", "\u2697\uFE0F"),
          makePage("p2", TENANT_A, "Palladium Reuse (7440-05-3)", "\u2697\uFE0F"),
        ],
        pageLinks: [
          makeLink("l1", TENANT_A, "p1", "p-ext", TENANT_A, TENANT_B),
        ],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      expect(report.passed).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it("should include details in each check", async () => {
      const db = createMockDb({
        pages: [
          makePage("p1", TENANT_A, "Test Page"),
        ],
        pageLinks: [],
      });

      const verifier = new TenantIsolationVerifier(db);
      const report = await verifier.verifyIsolation(TENANT_A);

      for (const check of report.checks) {
        expect(check.name).toBeTruthy();
        expect(typeof check.passed).toBe("boolean");
        expect(check.details).toBeTruthy();
      }
    });
  });
});
