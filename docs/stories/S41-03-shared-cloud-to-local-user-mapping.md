# S41-03: Shared Cloud-to-Local User Mapping Logic

**Epic**: EPIC-41 Cloud Auth Local Data
**Type**: Code
**Priority**: P0 (Required by all app stories)
**Depends on**: S41-01, S41-02
**Blocks**: S41-04, S41-05, S41-06, S41-07

## Objective

Define the reusable pattern for mapping a cloud-authenticated user to a local Supabase user. Each app will implement this pattern in its own tech stack (TypeScript for Next.js apps, JavaScript for ChemELN, Swift/Python for SciSymbioLens), but the logic is identical.

## The Mapping Algorithm

```
function mapCloudUserToLocal(cloudUser, localAdminClient):
    1. Extract email from cloudUser
    2. Look up user in local auth.users by email:
       - Call localAdminClient.auth.admin.listUsers()
       - Filter by email match
    3. If user exists locally:
       - Return the existing local user
    4. If user does NOT exist locally:
       - Create via localAdminClient.auth.admin.createUser({
           email: cloudUser.email,
           email_confirm: true,  // Skip email verification
           user_metadata: {
             full_name: cloudUser.user_metadata.full_name || cloudUser.user_metadata.name,
             avatar_url: cloudUser.user_metadata.avatar_url,
             cloud_user_id: cloudUser.id,  // Store reference to cloud ID
             provider: 'google',
           }
         })
       - Return the newly created local user
    5. Create a local session for the local user:
       - For Next.js: Set auth cookies with local session
       - For ChemELN: Use signInWithPassword or admin.generateLink
       - For iOS: Store local JWT
```

## Implementation Per Tech Stack

### Next.js Apps (KnowledgeBase, ExpTube)

**New file pattern**: `src/lib/supabase/cloud.ts` (or `lib/supabase/cloud.ts`)

```typescript
// Cloud Supabase client -- used ONLY for Google OAuth sign-in
import { createBrowserClient } from "@supabase/ssr";

export function createCloudClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_CLOUD_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY!,
    {
      // Use distinct cookie name to avoid conflicts with local Supabase session
      cookieOptions: {
        name: "sb-cloud",
      },
    }
  );
}
```

**New file pattern**: `src/lib/auth/mapCloudUser.ts` (or `lib/auth/mapCloudUser.ts`)

```typescript
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Maps a cloud-authenticated user to a local Supabase user.
 * Creates the local user if they don't exist yet.
 *
 * IMPORTANT: This runs server-side only (uses service role key).
 */
export async function mapCloudUserToLocal(cloudUser: User): Promise<User> {
  const localAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const email = cloudUser.email;
  if (!email) {
    throw new Error("Cloud user has no email address");
  }

  // Check if user already exists locally
  const { data: existingUsers } = await localAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    // Note: listUsers doesn't support email filter in all versions
    // We filter manually below
  });

  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    return existingUser;
  }

  // Create new local user
  const { data: newUser, error } = await localAdmin.auth.admin.createUser({
    email,
    email_confirm: true, // Auto-confirm since they authenticated via Google
    user_metadata: {
      full_name:
        cloudUser.user_metadata?.full_name ||
        cloudUser.user_metadata?.name ||
        null,
      avatar_url: cloudUser.user_metadata?.avatar_url || null,
      cloud_user_id: cloudUser.id,
      provider: "google",
    },
  });

  if (error) {
    // Handle race condition: user might have been created between check and create
    if (error.message?.includes("already been registered")) {
      const { data: retryUsers } = await localAdmin.auth.admin.listUsers();
      const retryUser = retryUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (retryUser) return retryUser;
    }
    throw new Error(`Failed to create local user: ${error.message}`);
  }

  return newUser.user;
}
```

### ChemELN (Vanilla JS)

The same logic implemented in `js/cloud-auth.js` using `fetch()` calls to the local Supabase Admin API (since there's no npm supabase-js in the static app -- it uses the CDN version).

### SciSymbioLens (iOS Swift + Python Backend)

- **iOS**: After `signInWithIdToken()` against cloud Supabase, send the cloud JWT to the backend
- **Backend (FastAPI)**: Verify cloud JWT, extract email, call local Supabase Admin API to find/create user, return local JWT to iOS app

## Environment Variables Required (all apps)

```env
# Cloud Supabase (auth only)
NEXT_PUBLIC_SUPABASE_CLOUD_URL=https://xysiyvrwvhngtwccouqy.supabase.co
NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY=<from S41-01 step 5>

# Local Supabase (data -- already exists)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:5434x
NEXT_PUBLIC_SUPABASE_ANON_KEY=<existing>
SUPABASE_SERVICE_ROLE_KEY=<existing local service role key>
```

## Cookie Strategy for Next.js Apps

Both cloud and local Supabase clients store auth sessions in cookies. To prevent conflicts:

| Client | Cookie prefix | Purpose |
|--------|--------------|---------|
| Cloud Supabase | `sb-xysiyvrwvhngtwccouqy-auth-token` | Temporary, during OAuth flow only |
| Local Supabase | `sb-<local-project-ref>-auth-token` | Persistent, used for all data ops |

The cloud cookie is only needed during the OAuth callback exchange. After mapping to local, the cloud session can be discarded. The callback route should:
1. Exchange the cloud auth code for a cloud session (sets cloud cookie)
2. Extract cloud user identity
3. Map to local user
4. Sign in as local user (sets local cookie)
5. Optionally: sign out of cloud session (clears cloud cookie)

## Handling Existing Local Users

Users who have previously signed in via local Google OAuth (before this change) already have entries in the local `auth.users` table with their email. The `mapCloudUserToLocal` function finds them by email and returns the existing record. Their existing UUID is preserved, so all data associations remain intact.

**Example**: User `martin.priessner@gmail.com` with local UUID `bcacfccf-9792-440c-8895-8e6e4418f91c` will be matched by email. No new user created. All experiments, videos, etc. remain linked.

## Edge Cases

1. **User changes Google email**: Mapping breaks (different email). Mitigation: Store `cloud_user_id` in metadata for future fallback matching.
2. **Same email, different providers**: If a user signed up with email/password and later tries Google OAuth, the email match finds the existing user. No conflict.
3. **Race condition on create**: Two concurrent requests for the same new user. Handled by catching "already registered" error and retrying lookup.
4. **Cloud user with no email**: Rejected with clear error. Google OAuth always provides email.

## Acceptance Criteria

- [ ] Pattern documented with code samples for each tech stack
- [ ] Existing local users are matched by email, not duplicated
- [ ] New users are created with `email_confirm: true` (no verification email)
- [ ] Cloud user metadata (name, avatar) is copied to local user
- [ ] Race conditions handled gracefully
- [ ] Service role key is used server-side only, never exposed to browser
