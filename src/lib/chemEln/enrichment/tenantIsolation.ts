import { prisma } from "@/lib/db";

/**
 * Result of a single isolation check.
 */
export interface IsolationCheck {
  name: string;
  passed: boolean;
  details: string;
}

/**
 * Full report from tenant isolation verification.
 */
export interface IsolationReport {
  passed: boolean;
  checks: IsolationCheck[];
  warnings: string[];
  errors: string[];
}

/**
 * A page record with the fields needed for isolation verification.
 */
interface TenantPage {
  id: string;
  tenantId: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
}

/**
 * A page link record with source/target tenant info.
 */
interface TenantPageLink {
  id: string;
  tenantId: string;
  sourcePageId: string;
  targetPageId: string;
  sourcePage: { tenantId: string };
  targetPage: { tenantId: string };
}

/**
 * Database client interface for tenant isolation queries.
 * Abstracted to allow mocking in tests.
 */
export interface TenantIsolationDb {
  page: {
    findMany: (args: {
      where: { tenantId: string };
      select: { id: true; tenantId: true; title: true; icon: true; oneLiner: true };
    }) => Promise<TenantPage[]>;
  };
  pageLink: {
    findMany: (args: {
      where: { tenantId: string };
      include: {
        sourcePage: { select: { tenantId: true } };
        targetPage: { select: { tenantId: true } };
      };
    }) => Promise<TenantPageLink[]>;
  };
  block: {
    findMany: (args: {
      where: { tenantId: string };
      select: { id: true; tenantId: true; pageId: true; plainText: true };
    }) => Promise<Array<{ id: string; tenantId: string; pageId: string; plainText: string }>>;
  };
}

/**
 * Get ChemELN tenant ID from environment.
 *
 * @throws Error if CHEMELN_TENANT_ID not set or invalid format
 * @returns Tenant UUID
 */
export function getChemELNTenantId(): string {
  const tenantId = process.env.CHEMELN_TENANT_ID;

  if (!tenantId) {
    throw new Error(
      "CHEMELN_TENANT_ID environment variable not set. Required for multi-tenant isolation."
    );
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    throw new Error(
      `Invalid CHEMELN_TENANT_ID format: ${tenantId}. Expected UUID.`
    );
  }

  return tenantId;
}

/**
 * Return all pages belonging to a specific tenant.
 *
 * @param tenantId - Tenant UUID
 * @param db - Database client (defaults to global prisma)
 * @returns Array of pages for the tenant
 */
export async function getTenantPages(
  tenantId: string,
  db: TenantIsolationDb = prisma as unknown as TenantIsolationDb
): Promise<TenantPage[]> {
  return db.page.findMany({
    where: { tenantId },
    select: { id: true, tenantId: true, title: true, icon: true, oneLiner: true },
  });
}

/**
 * Return all page links (wikilinks) scoped to a tenant.
 *
 * @param tenantId - Tenant UUID
 * @param db - Database client (defaults to global prisma)
 * @returns Array of page links for the tenant
 */
export async function getTenantWikilinks(
  tenantId: string,
  db: TenantIsolationDb = prisma as unknown as TenantIsolationDb
): Promise<TenantPageLink[]> {
  return db.pageLink.findMany({
    where: { tenantId },
    include: {
      sourcePage: { select: { tenantId: true } },
      targetPage: { select: { tenantId: true } },
    },
  });
}

/**
 * Find any page links where source or target page belongs to a different tenant.
 *
 * @param tenantId - Tenant UUID to check
 * @param db - Database client (defaults to global prisma)
 * @returns Array of cross-tenant link violations
 */
export async function checkCrossTenantReferences(
  tenantId: string,
  db: TenantIsolationDb = prisma as unknown as TenantIsolationDb
): Promise<TenantPageLink[]> {
  const links = await getTenantWikilinks(tenantId, db);
  return links.filter(
    (link) =>
      link.sourcePage.tenantId !== tenantId ||
      link.targetPage.tenantId !== tenantId
  );
}

/**
 * Verifies multi-tenant isolation for a given tenant.
 *
 * Runs a series of checks to ensure no cross-tenant data leakage:
 * - All pages belong to the specified tenant
 * - No wikilinks cross tenant boundaries
 * - Tag namespaces are scoped to tenant
 * - Researcher information does not leak across tenants
 * - CAS numbers are checked for intra-tenant duplicates
 */
export class TenantIsolationVerifier {
  private readonly db: TenantIsolationDb;

  constructor(db?: TenantIsolationDb) {
    this.db = db ?? (prisma as unknown as TenantIsolationDb);
  }

  /**
   * Run all isolation checks for a tenant.
   *
   * @param tenantId - Tenant UUID to verify
   * @returns Isolation report with check results, warnings, and errors
   */
  async verifyIsolation(tenantId: string): Promise<IsolationReport> {
    const checks: IsolationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const pages = await getTenantPages(tenantId, this.db);

    // Check 1: All pages belong to tenant
    checks.push(this.checkPageOwnership(pages, tenantId));

    // Check 2: No cross-tenant wikilinks
    const wikilinkCheck = await this.checkWikilinkIsolation(tenantId);
    checks.push(wikilinkCheck.check);
    errors.push(...wikilinkCheck.errors);

    // Check 3: Tag namespaces scoped to tenant
    checks.push(this.checkTagNamespaceScoping(pages, tenantId));

    // Check 4: Researcher info does not leak
    const researcherCheck = this.checkResearcherIsolation(pages, tenantId);
    checks.push(researcherCheck.check);
    warnings.push(...researcherCheck.warnings);

    // Check 5: CAS number uniqueness within tenant
    const casCheck = this.checkCasNumberUniqueness(pages, tenantId);
    checks.push(casCheck.check);
    warnings.push(...casCheck.warnings);

    const passed = checks.every((c) => c.passed);

    return { passed, checks, warnings, errors };
  }

  /**
   * Verify all pages belong to the expected tenant.
   */
  private checkPageOwnership(
    pages: TenantPage[],
    tenantId: string
  ): IsolationCheck {
    const foreignPages = pages.filter((p) => p.tenantId !== tenantId);

    if (foreignPages.length === 0) {
      return {
        name: "page-ownership",
        passed: true,
        details: `All ${pages.length} pages belong to tenant ${tenantId}`,
      };
    }

    return {
      name: "page-ownership",
      passed: false,
      details: `${foreignPages.length} page(s) belong to a different tenant: ${foreignPages.map((p) => p.id).join(", ")}`,
    };
  }

  /**
   * Verify no wikilinks cross tenant boundaries.
   */
  private async checkWikilinkIsolation(
    tenantId: string
  ): Promise<{ check: IsolationCheck; errors: string[] }> {
    const crossTenantLinks = await checkCrossTenantReferences(
      tenantId,
      this.db
    );
    const linkErrors: string[] = [];

    if (crossTenantLinks.length === 0) {
      return {
        check: {
          name: "wikilink-isolation",
          passed: true,
          details: "No cross-tenant wikilinks found",
        },
        errors: linkErrors,
      };
    }

    for (const link of crossTenantLinks) {
      linkErrors.push(
        `Cross-tenant wikilink: link ${link.id} connects source tenant ${link.sourcePage.tenantId} to target tenant ${link.targetPage.tenantId}`
      );
    }

    return {
      check: {
        name: "wikilink-isolation",
        passed: false,
        details: `${crossTenantLinks.length} cross-tenant wikilink(s) detected`,
      },
      errors: linkErrors,
    };
  }

  /**
   * Verify tag namespaces (eln:, cas:, etc.) are scoped to tenant.
   * Checks that all pages with chemistry-specific tags belong to the same tenant.
   */
  private checkTagNamespaceScoping(
    pages: TenantPage[],
    tenantId: string
  ): IsolationCheck {
    const CHEM_TAG_PREFIXES = [
      "eln:",
      "cas:",
      "reaction:",
      "researcher:",
      "substrate-class:",
      "scale:",
      "challenge:",
      "quality:",
    ];

    const pagesWithChemTags = pages.filter((p) => {
      const oneLiner = p.oneLiner ?? "";
      return CHEM_TAG_PREFIXES.some((prefix) => oneLiner.includes(prefix));
    });

    const foreignTagPages = pagesWithChemTags.filter(
      (p) => p.tenantId !== tenantId
    );

    if (foreignTagPages.length === 0) {
      return {
        name: "tag-namespace-scoping",
        passed: true,
        details: `All tagged pages are scoped to tenant ${tenantId}`,
      };
    }

    return {
      name: "tag-namespace-scoping",
      passed: false,
      details: `${foreignTagPages.length} page(s) with chemistry tags belong to a different tenant`,
    };
  }

  /**
   * Check that researcher pages do not leak names/emails across tenants.
   */
  private checkResearcherIsolation(
    pages: TenantPage[],
    tenantId: string
  ): { check: IsolationCheck; warnings: string[] } {
    const researcherWarnings: string[] = [];

    const researcherPages = pages.filter(
      (p) => p.icon === "\u{1F469}\u200D\u{1F52C}" || p.title.startsWith("Dr.")
    );

    const foreignResearchers = researcherPages.filter(
      (p) => p.tenantId !== tenantId
    );

    if (foreignResearchers.length > 0) {
      for (const r of foreignResearchers) {
        researcherWarnings.push(
          `Researcher page "${r.title}" (${r.id}) belongs to tenant ${r.tenantId}, not ${tenantId}`
        );
      }

      return {
        check: {
          name: "researcher-isolation",
          passed: false,
          details: `${foreignResearchers.length} researcher page(s) leak across tenants`,
        },
        warnings: researcherWarnings,
      };
    }

    return {
      check: {
        name: "researcher-isolation",
        passed: true,
        details: `${researcherPages.length} researcher page(s) are properly scoped to tenant ${tenantId}`,
      },
      warnings: researcherWarnings,
    };
  }

  /**
   * Check CAS number uniqueness within tenant.
   * Duplicate CAS across tenants is allowed; duplicate CAS within a tenant triggers a warning.
   */
  private checkCasNumberUniqueness(
    pages: TenantPage[],
    tenantId: string
  ): { check: IsolationCheck; warnings: string[] } {
    const casWarnings: string[] = [];

    const chemicalPages = pages.filter(
      (p) =>
        p.tenantId === tenantId &&
        (p.icon === "\u2697\uFE0F" || p.title.startsWith("cas:"))
    );

    const casNumbers = new Map<string, string[]>();
    for (const page of chemicalPages) {
      const casMatch = page.title.match(
        /\b(\d{2,7}-\d{2}-\d)\b/
      );
      if (casMatch) {
        const cas = casMatch[1];
        const existing = casNumbers.get(cas) ?? [];
        existing.push(page.id);
        casNumbers.set(cas, existing);
      }
    }

    const duplicates = Array.from(casNumbers.entries()).filter(
      ([, ids]) => ids.length > 1
    );

    if (duplicates.length > 0) {
      for (const [cas, ids] of duplicates) {
        casWarnings.push(
          `Duplicate CAS ${cas} within tenant ${tenantId}: pages ${ids.join(", ")}`
        );
      }

      return {
        check: {
          name: "cas-uniqueness",
          passed: true,
          details: `${duplicates.length} duplicate CAS number(s) within tenant (warning only)`,
        },
        warnings: casWarnings,
      };
    }

    return {
      check: {
        name: "cas-uniqueness",
        passed: true,
        details: `All CAS numbers are unique within tenant ${tenantId}`,
      },
      warnings: casWarnings,
    };
  }
}
