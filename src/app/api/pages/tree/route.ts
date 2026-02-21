import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { getPageTree } from "@/lib/pages/getPageTree";
import type { TenantContext } from "@/types/auth";

export const GET = withTenant(
  async (_req: NextRequest, context: TenantContext) => {
    try {
      const tree = await getPageTree(context.tenantId);

      return successResponse(tree);
    } catch (error) {
      console.error("GET /api/pages/tree error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
