import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

/**
 * GET /api/pages/trash
 * Lists all soft-deleted pages for the tenant.
 * Note: Soft-delete not yet active — returns empty array.
 */
export const GET = withTenant(
  async (
    _req: NextRequest,
    _context: TenantContext,
  ) => {
    return successResponse([]);
  }
);
