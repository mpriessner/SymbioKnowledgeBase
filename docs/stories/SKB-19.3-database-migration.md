# Story SKB-19.3: Database Migration to Supabase

**Epic:** Epic 19 - Supabase Auth Migration
**Story ID:** SKB-19.3
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-19.2 (auth flow must be migrated first)

---

## User Story

As a developer, I want to align the database schema with Supabase Auth, So that user IDs and tenant data are consistent across Symbio apps.

---

## Acceptance Criteria

1. **Strategy: Option A (Recommended)**
   - [ ] Keep existing PostgreSQL database
   - [ ] Add Supabase Auth for authentication only
   - [ ] Update `User.id` to reference Supabase `auth.users.id` (UUID)
   - [ ] Minimal disruption, easiest migration path

2. **Prisma Schema Updates**
   - [ ] `User.id` type: `String @id` (UUID from Supabase)
   - [ ] Remove `passwordHash` field (managed by Supabase)
   - [ ] Add `supabaseId` if keeping separate IDs (NOT recommended)
   - [ ] All foreign keys referencing `User.id` remain valid

3. **Data Migration Script**
   - [ ] Script: `scripts/migrate-db-to-supabase.ts`
   - [ ] For each existing user:
     - Create Supabase auth user
     - Update Prisma `User.id` to Supabase UUID
     - Update all related records (tenants, pages, etc.) with new user ID
   - [ ] Idempotent: safe to re-run if partial failure

4. **Tenant Mapping**
   - [ ] Preserve `tenantId` in Prisma (tenant isolation remains unchanged)
   - [ ] Supabase `auth.users.id` → Prisma `User.id` → `tenantId`
   - [ ] No changes to tenant isolation logic

5. **Rollback Plan**
   - [ ] Database backup before migration
   - [ ] Script to restore from backup if migration fails
   - [ ] Document point of no return (after users start using Supabase)

6. **Alternative: Option B (Future)**
   - [ ] Full migration to Supabase PostgreSQL
   - [ ] Move all tables to Supabase database
   - [ ] Use Supabase RLS (Row-Level Security) for tenant isolation
   - [ ] More complex, deferred to later phase

---

## Technical Implementation

### Prisma Schema Changes

**File: `prisma/schema.prisma`**

```prisma
model User {
  id             String    @id // Supabase auth.users.id (UUID)
  tenantId       String    @map("tenant_id")
  email          String
  // Remove: passwordHash (managed by Supabase)
  role           Role      @default(USER)
  name           String?
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deactivatedAt  DateTime? @map("deactivated_at")

  // Relations (unchanged)
  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  apiKeys ApiKey[]
  teamspaceMembers TeamspaceMember[]
  presenceRecords PagePresence[]
  createdShareLinks PublicShareLink[]

  // Indexes (unchanged)
  @@unique([tenantId, email], map: "uq_users_email_tenant_id")
  @@index([tenantId, id], map: "idx_users_tenant_id_id")
  @@index([tenantId], map: "idx_users_tenant_id")

  @@map("users")
}
```

---

### Migration Script

**File: `scripts/migrate-db-to-supabase.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateDatabase() {
  console.log('Starting database migration to Supabase Auth...');

  const users = await prisma.user.findMany();

  for (const user of users) {
    try {
      // Create Supabase auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: crypto.randomBytes(32).toString('hex'), // Temp password
        email_confirm: true,
        user_metadata: {
          name: user.name,
          tenantId: user.tenantId,
        },
      });

      if (authError) {
        console.error(`Failed to create Supabase user for ${user.email}:`, authError);
        continue;
      }

      const supabaseId = authUser.user.id;

      // Update all related records in transaction
      await prisma.$transaction(async (tx) => {
        // Update User.id
        await tx.user.update({
          where: { id: user.id },
          data: { id: supabaseId },
        });

        // All foreign keys should cascade automatically if using UUID type
        console.log(`Migrated ${user.email} → ${supabaseId}`);
      });

      // Send password reset email
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      });

    } catch (error) {
      console.error(`Failed to migrate ${user.email}:`, error);
      // Continue with next user
    }
  }

  console.log('Migration complete!');
  console.log('All users have been sent password reset emails.');
}

migrateDatabase()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

### Migration Steps (Production)

1. **Pre-Migration**
   - Announce maintenance window to users
   - Backup entire database (`pg_dump`)
   - Verify backup can be restored

2. **Migration**
   - Run migration script: `tsx scripts/migrate-db-to-supabase.ts`
   - Monitor logs for errors
   - Verify all users migrated successfully

3. **Post-Migration**
   - Deploy new code with Supabase Auth
   - Test login with migrated user
   - Notify users to check email for password reset

4. **Rollback (if needed)**
   - Restore database from backup
   - Revert code to pre-migration version
   - Investigate errors, fix script, retry

---

## Test Scenarios

### Integration Tests

```typescript
describe('Database Migration', () => {
  it('should preserve tenant isolation after migration', async () => {
    // Create test user in tenant A
    const userA = await prisma.user.create({
      data: { email: 'a@test.com', tenantId: 'tenant-a' },
    });

    // Migrate user
    await migrateUser(userA);

    // Verify user can only access tenant A data
    const pages = await prisma.page.findMany({
      where: { tenantId: 'tenant-a' },
    });

    expect(pages.length).toBeGreaterThan(0);
  });

  it('should update all foreign keys correctly', async () => {
    const user = await prisma.user.findFirst();
    const oldId = user.id;

    await migrateUser(user);

    // Verify API keys, teamspace members, etc. reference new ID
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: user.id },
    });

    expect(apiKeys.length).toBeGreaterThan(0);
  });
});
```

---

## Dependencies

- **SKB-19.2:** Auth flow migrated, Supabase client functional

---

## Dev Notes

### UUID Compatibility

- **Current User.id:** If already UUID, migration is easier (just update values)
- **Current User.id:** If auto-increment integer, all foreign keys must be updated to UUID type

### Foreign Key Cascade

- **Prisma schema:** Ensure `onUpdate: Cascade` for all `User.id` references
- **Database constraints:** Verify PostgreSQL foreign keys have `ON UPDATE CASCADE`

### Point of No Return

- **Before migration:** Can rollback with database restore
- **After migration:** Users start logging in with Supabase → cannot rollback without data loss

---

**Last Updated:** 2026-02-22
