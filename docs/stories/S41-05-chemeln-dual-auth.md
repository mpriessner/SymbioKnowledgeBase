# S41-05: ChemELN (ET_ELN) -- Dual Supabase Auth

**Epic**: EPIC-41 Cloud Auth Local Data
**Type**: Code
**Priority**: P1
**Depends on**: S41-01, S41-02, S41-03
**Codebase**: `/Users/mpriessner/windsurf_repos/ET_ELN`
**Tech stack**: Vanilla JavaScript SPA, Node.js serve.js, Supabase JS CDN

## Objective

Modify ChemELN to use cloud Supabase for Google OAuth while keeping all data operations (experiments, projects, procedures) on the local Supabase instance.

## Current Auth Architecture

| File | Role |
|------|------|
| `js/supabase-client.js` | Singleton Supabase client (CDN-loaded), handles signIn/signUp/signInWithGoogle |
| `js/config.js` | Reads `window.__ENV__` for Supabase URL/keys |
| `js/app.js` | Login handlers, auth state listener, app boot |
| `index.html` | Login form HTML, Google sign-in button |
| `serve.js` | HTTP server, injects env vars, rewrites URLs for remote access |
| `supabase/functions/_shared/auth-middleware.ts` | JWT validation for edge functions |

### Key Difference from Next.js Apps

ChemELN is a **static SPA** with no server-side rendering. Auth is entirely client-side:
- No `/auth/callback` route -- Supabase SDK handles redirect + session via `onAuthStateChange`
- `signInWithOAuth` redirects to Google, then back to `window.location.origin`
- Supabase SDK auto-detects the token in the URL fragment and fires `SIGNED_IN` event
- Session stored in `localStorage` (not cookies)

## Changes Required

### 1. Add Environment Variables

Add to `.env`:
```env
# Cloud Supabase (auth only) -- from S41-01
SUPABASE_CLOUD_URL=https://xysiyvrwvhngtwccouqy.supabase.co
SUPABASE_CLOUD_ANON_KEY=<cloud anon key>

# Local Supabase (data) -- already exists
# SUPABASE_URL=http://localhost:54331
# SUPABASE_ANON_KEY=<existing>
# SUPABASE_SERVICE_KEY=<existing>
```

### 2. Update serve.js to Inject Cloud Variables

**File**: `serve.js`

In the `generateEnvScript()` function (~line 85), add the cloud variables to the `safeEnv` object:

```javascript
// ADD these two lines to safeEnv:
SUPABASE_CLOUD_URL: env.SUPABASE_CLOUD_URL || process.env.SUPABASE_CLOUD_URL || '',
SUPABASE_CLOUD_ANON_KEY: env.SUPABASE_CLOUD_ANON_KEY || process.env.SUPABASE_CLOUD_ANON_KEY || '',
```

**Important**: Do NOT add cloud URLs to the remote URL rewriting block. The cloud URL is already a public HTTPS URL -- it doesn't need rewriting.

### 3. Update config.js

**File**: `js/config.js`

Add cloud config properties (~line 63):

```javascript
// Cloud Supabase (auth only)
SUPABASE_CLOUD_URL: ENV.SUPABASE_CLOUD_URL || '',
SUPABASE_CLOUD_ANON_KEY: ENV.SUPABASE_CLOUD_ANON_KEY || '',
```

### 4. Create Cloud Auth Module

**New file**: `js/cloud-auth.js`

```javascript
/**
 * Cloud Supabase Authentication
 *
 * Handles Google OAuth via the cloud Supabase project.
 * After cloud auth succeeds, maps the user to the local Supabase instance.
 */
const CloudAuth = (function() {
  let _cloudClient = null;

  function init() {
    const url = CONFIG.SUPABASE_CLOUD_URL;
    const key = CONFIG.SUPABASE_CLOUD_ANON_KEY;

    if (!url || !key) {
      console.log('[CloudAuth] Not configured, Google OAuth will use local Supabase');
      return false;
    }

    _cloudClient = supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        storageKey: 'sb-cloud-auth', // Distinct from local session storage key
      },
    });

    console.log('[CloudAuth] Initialized with cloud Supabase');
    return true;
  }

  function isConfigured() {
    return _cloudClient !== null;
  }

  /**
   * Initiate Google OAuth via cloud Supabase.
   * Redirects the browser to Google, then back to the app.
   */
  async function signInWithGoogle() {
    if (!_cloudClient) {
      throw new Error('Cloud auth not configured');
    }

    const { data, error } = await _cloudClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });

    return { data, error };
  }

  /**
   * After returning from Google OAuth, check for a cloud session
   * and map the cloud user to a local user.
   */
  async function handleRedirectAndMapUser() {
    if (!_cloudClient) return null;

    // Check if there's a cloud session (from OAuth redirect)
    const { data: { session } } = await _cloudClient.auth.getSession();

    if (!session || !session.user) {
      return null; // No cloud session -- not a cloud OAuth redirect
    }

    const cloudUser = session.user;
    console.log('[CloudAuth] Cloud user authenticated:', cloudUser.email);

    // Map to local user
    const localUser = await _mapToLocalUser(cloudUser);

    // Sign out of cloud session (no longer needed)
    await _cloudClient.auth.signOut();

    return localUser;
  }

  /**
   * Find or create a matching user in the local Supabase instance.
   * Uses the service role key to call the admin API.
   */
  async function _mapToLocalUser(cloudUser) {
    const localUrl = CONFIG.SUPABASE_URL;
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY;

    if (!serviceKey || serviceKey === 'your-service-key-here') {
      throw new Error('Local service role key not configured');
    }

    const email = cloudUser.email;

    // Check if user exists locally
    const listResp = await fetch(`${localUrl}/auth/v1/admin/users`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });

    if (listResp.ok) {
      const { users } = await listResp.json();
      const existing = users.find(
        u => u.email && u.email.toLowerCase() === email.toLowerCase()
      );
      if (existing) {
        console.log('[CloudAuth] Found existing local user:', email);
        // Sign in locally using the existing user
        await _signInLocalUser(email);
        return existing;
      }
    }

    // Create new local user
    const createResp = await fetch(`${localUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: cloudUser.user_metadata?.full_name
            || cloudUser.user_metadata?.name || null,
          avatar_url: cloudUser.user_metadata?.avatar_url || null,
          cloud_user_id: cloudUser.id,
          provider: 'google',
        },
      }),
    });

    if (!createResp.ok) {
      const err = await createResp.json().catch(() => ({}));
      // User might already exist (race condition)
      if (createResp.status === 422 || createResp.status === 409) {
        console.log('[CloudAuth] User already exists (race), signing in');
        await _signInLocalUser(email);
        return null;
      }
      throw new Error(`Failed to create local user: ${err.msg || err.message}`);
    }

    const newUser = await createResp.json();
    console.log('[CloudAuth] Created new local user:', email);
    await _signInLocalUser(email);
    return newUser;
  }

  /**
   * Sign into local Supabase using admin-generated magic link.
   * This sets the local session in localStorage.
   */
  async function _signInLocalUser(email) {
    const localUrl = CONFIG.SUPABASE_URL;
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY;

    // Generate a magic link
    const resp = await fetch(`${localUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: 'magiclink',
        email,
      }),
    });

    if (!resp.ok) {
      console.error('[CloudAuth] Failed to generate local magic link');
      return;
    }

    const linkData = await resp.json();

    // Use the local Supabase client to verify the OTP
    const localClient = SupabaseClient.getClient();
    if (linkData.hashed_token) {
      await localClient.auth.verifyOtp({
        type: 'magiclink',
        token_hash: linkData.hashed_token,
      });
    }
  }

  return {
    init,
    isConfigured,
    signInWithGoogle,
    handleRedirectAndMapUser,
  };
})();
```

### 5. Update index.html

**File**: `index.html`

Add the cloud auth script before `app.js`:

```html
<script src="js/cloud-auth.js"></script>
```

### 6. Update app.js Boot Sequence

**File**: `js/app.js`

Modify the `boot()` method to:
1. Initialize cloud auth
2. Check for cloud OAuth redirect on page load
3. If cloud user found, proceed to authenticated state

```javascript
async boot() {
    console.log('ChemELN v' + this.version + ' booting...');
    this._setupLoginHandlers();

    // Initialize cloud auth (for Google OAuth)
    CloudAuth.init();

    // Check for cloud OAuth redirect (returning from Google)
    const cloudUser = await CloudAuth.handleRedirectAndMapUser();
    if (cloudUser) {
      // Cloud OAuth completed, local session established
      const user = await SupabaseClient.getCurrentUser();
      if (user) {
        this._onAuthenticated(user);
        return;
      }
    }

    // Normal boot: check existing local session
    const user = await SupabaseClient.getCurrentUser();
    if (user) {
      this._onAuthenticated(user);
    } else {
      this._showLogin();
    }

    // Listen for local auth state changes
    SupabaseClient.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this._onAuthenticated(session.user);
      } else if (event === 'SIGNED_OUT') {
        this._showLogin();
      }
    });
}
```

### 7. Update Google Sign-In Handler

**File**: `js/app.js` or `js/supabase-client.js`

Modify `_handleGoogleSignIn` (app.js ~line 80):

```javascript
async _handleGoogleSignIn() {
    // Use cloud auth if configured, otherwise fall back to local
    if (CloudAuth.isConfigured()) {
      const { error } = await CloudAuth.signInWithGoogle();
      if (error) {
        this._showLoginError(error.message || error);
      }
      // Browser will redirect to Google, then back here
      // CloudAuth.handleRedirectAndMapUser() runs on page load
    } else {
      const { error } = await SupabaseClient.signInWithGoogle();
      if (error) {
        this._showLoginError(error);
      }
    }
}
```

### 8. Update serve.js URL Rewriting (No Change Needed for Cloud URLs)

The existing remote URL rewriting in `serve.js` only rewrites `SUPABASE_URL`, `EXPTUBE_API_URL`, and `EXPTUBE_SUPABASE_URL`. The cloud Supabase URL does NOT need rewriting because it's already a public HTTPS URL. No changes needed here.

## Files Modified

| File | Change |
|------|--------|
| `js/cloud-auth.js` | **NEW** -- Cloud auth module |
| `js/config.js` | Add cloud config properties |
| `js/app.js` | Boot checks for cloud redirect, Google handler uses cloud |
| `serve.js` | Inject cloud env vars into HTML |
| `index.html` | Add `<script src="js/cloud-auth.js">` |
| `.env` | Add cloud URL and anon key |

## Files NOT Modified

| File | Why |
|------|-----|
| `js/supabase-client.js` | Local client unchanged, email/password auth unchanged |
| `js/db.js` | Database operations use local client, unchanged |
| `supabase/functions/_shared/auth-middleware.ts` | Edge functions validate local JWTs, unchanged |

## Testing

### Local
1. Start ChemELN: `cd ET_ELN && node serve.js`
2. Open `http://localhost:3001`
3. Click "Sign in with Google" -- redirects to cloud Supabase then Google
4. After Google auth, returns to app with local session
5. Create experiment -- saved to local Supabase (port 54331)
6. Sign in with email/password -- works as before (local only)

### Remote (Tailscale)
1. From phone/laptop on Tailscale
2. Open `https://martins-macbook-pro.tail3a744f.ts.net:3001`
3. Google sign-in should work (cloud URL is public)
4. Note: serve.js rewrites `SUPABASE_URL` for remote access (data queries go through Tailscale)

## Rollback

Remove or empty `SUPABASE_CLOUD_URL` from `.env`. `CloudAuth.init()` returns false, and `CloudAuth.isConfigured()` returns false, so the Google button falls back to `SupabaseClient.signInWithGoogle()` (local auth).

## Acceptance Criteria

- [ ] Google OAuth uses cloud Supabase
- [ ] Email/password auth uses local Supabase (unchanged)
- [ ] Cloud user is mapped to local user by email
- [ ] Existing local users are reused
- [ ] Local session established after cloud auth
- [ ] Experiments and projects save to local Supabase
- [ ] Works locally (localhost:3001)
- [ ] Works remotely (Tailscale)
- [ ] ExpTube user sync (`_syncUserToExpTube`) still works for email/password signups
- [ ] Falls back to local auth when cloud not configured
