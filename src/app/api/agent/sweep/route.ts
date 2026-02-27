import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { SweepService } from "@/lib/sweep/SweepService";
import { summaryProcessor } from "@/lib/sweep/summaryProcessor";
import { linkDiscoveryProcessor } from "@/lib/sweep/linkDiscovery";
import { MAX_SWEEP_BUDGET } from "@/lib/sweep/config";
import { z } from "zod";

const sweepBodySchema = z.object({
  budget: z.number().int().min(1).max(MAX_SWEEP_BUDGET).default(50),
  dryRun: z.boolean().default(false),
  autoLink: z.boolean().default(false),
});

/**
 * POST /api/agent/sweep — Trigger a sweep
 *
 * Body: { budget?: number, dryRun?: boolean, autoLink?: boolean }
 * Returns: SweepReport
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = sweepBodySchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const validationErrors = Object.entries(fieldErrors).map(([field, messages]) => ({
          field,
          message: Array.isArray(messages) ? messages.join(", ") : messages,
        }));
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid sweep parameters",
          validationErrors,
          400
        );
      }

      const { budget, dryRun, autoLink } = parsed.data;

      const sweepService = new SweepService();
      sweepService.addProcessor(summaryProcessor);
      sweepService.addProcessor(linkDiscoveryProcessor);

      const report = await sweepService.execute({
        budget,
        tenantId: ctx.tenantId,
        dryRun,
        autoLink,
      });

      return successResponse(report, {
        budget,
        dryRun,
        status: report.session.status,
      });
    } catch (err) {
      console.error("Sweep API error:", err);
      return errorResponse(
        "INTERNAL_ERROR",
        "Sweep execution failed",
        undefined,
        500
      );
    }
  }
);
