/**
 * User Migration Script: Prisma → Supabase Auth
 *
 * This script migrates existing users from the Prisma users table to Supabase Auth.
 * For each user:
 * 1. Creates a Supabase auth user with a temporary password
 * 2. Updates the Prisma User.id to match the Supabase auth.users.id
 * 3. Sends a password reset email so users can set their own password
 *
 * Prerequisites:
 * - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 * - DATABASE_URL must point to the PostgreSQL database
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-supabase.ts
 *
 * This script is idempotent — it skips users that already exist in Supabase.
 */

import { PrismaClient } from "../src/generated/prisma";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import "dotenv/config";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MigrationResult {
  email: string;
  success: boolean;
  oldId: string;
  newId?: string;
  error?: string;
}

async function migrateUsers(): Promise<void> {
  console.log("Starting user migration to Supabase Auth...\n");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      tenantId: true,
      role: true,
    },
  });

  console.log(`Found ${users.length} users to migrate.\n`);

  const results: MigrationResult[] = [];

  for (const user of users) {
    try {
      // Check if user already exists in Supabase
      const { data: existingUsers } =
        await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email === user.email
      );

      if (existingUser) {
        // User already in Supabase — just update Prisma ID if needed
        if (existingUser.id !== user.id) {
          await prisma.$executeRawUnsafe(
            `UPDATE users SET id = $1 WHERE id = $2`,
            existingUser.id,
            user.id
          );
          console.log(
            `[UPDATED] ${user.email}: ${user.id} → ${existingUser.id} (already in Supabase)`
          );
        } else {
          console.log(`[SKIP] ${user.email}: already migrated`);
        }
        results.push({
          email: user.email,
          success: true,
          oldId: user.id,
          newId: existingUser.id,
        });
        continue;
      }

      // Create Supabase auth user with temp password
      const tempPassword = randomBytes(32).toString("hex");
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
          },
        });

      if (authError) {
        console.error(`[FAIL] ${user.email}: ${authError.message}`);
        results.push({
          email: user.email,
          success: false,
          oldId: user.id,
          error: authError.message,
        });
        continue;
      }

      const supabaseId = authUser.user.id;

      // Update Prisma User.id to Supabase UUID using raw SQL
      // (Prisma doesn't support updating @id fields directly)
      await prisma.$executeRawUnsafe(
        `UPDATE users SET id = $1 WHERE id = $2`,
        supabaseId,
        user.id
      );

      // Send password reset email
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
      });

      console.log(`[OK] ${user.email}: ${user.id} → ${supabaseId}`);
      results.push({
        email: user.email,
        success: true,
        oldId: user.id,
        newId: supabaseId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`[FAIL] ${user.email}: ${message}`);
      results.push({
        email: user.email,
        success: false,
        oldId: user.id,
        error: message,
      });
    }
  }

  // Summary
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Migration complete: ${succeeded} succeeded, ${failed} failed`);

  if (failed > 0) {
    console.log("\nFailed users:");
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${r.email}: ${r.error}`));
  }

  console.log(
    "\nAll migrated users will receive a password reset email."
  );
}

migrateUsers()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
