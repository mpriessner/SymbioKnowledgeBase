import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * POST /api/settings/password — Change user password
 * 
 * Uses Supabase Auth to update the user's password.
 * If currentPassword is provided, it will first verify the current password.
 */
export const POST = withTenant(
  async (req: NextRequest, _ctx: TenantContext) => {
    try {
      const body = await req.json();
      const parsed = changePasswordSchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const firstMessage =
          Object.values(fieldErrors).flat()[0] || "Invalid request body";
        return errorResponse(
          "VALIDATION_ERROR",
          firstMessage,
          undefined,
          400
        );
      }

      const { currentPassword, newPassword } = parsed.data;

      // Get Supabase client with user session
      const supabase = await createClient();

      if (!supabase) {
        return errorResponse(
          "SERVICE_UNAVAILABLE",
          "Authentication service is not available",
          undefined,
          503
        );
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return errorResponse(
          "UNAUTHORIZED",
          "Not authenticated",
          undefined,
          401
        );
      }

      // If user has existing password, verify current password first
      // Check if user signed up with email (has password)
      const hasEmailProvider = user.identities?.some(
        (identity) => identity.provider === "email"
      );

      if (hasEmailProvider && currentPassword) {
        // Verify current password by attempting to sign in
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: currentPassword,
        });

        if (verifyError) {
          return errorResponse(
            "INVALID_PASSWORD",
            "Current password is incorrect",
            undefined,
            400
          );
        }
      }

      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error("Password update error:", updateError);

        // Handle common Supabase errors
        if (updateError.message.includes("same password")) {
          return errorResponse(
            "SAME_PASSWORD",
            "New password must be different from current password",
            undefined,
            400
          );
        }

        if (updateError.message.includes("weak")) {
          return errorResponse(
            "WEAK_PASSWORD",
            "Password is too weak. Use a stronger password.",
            undefined,
            400
          );
        }

        return errorResponse(
          "UPDATE_FAILED",
          "Failed to update password. Please try again.",
          undefined,
          500
        );
      }

      return successResponse({ success: true });
    } catch (error) {
      console.error("POST /api/settings/password error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
