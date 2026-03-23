# S41-07: SciSymbioLens -- Dual Supabase Auth (iOS + Backend)

**Epic**: EPIC-41 Cloud Auth Local Data
**Type**: Code
**Priority**: P1
**Depends on**: S41-01, S41-02, S41-03
**Codebase**: `/Users/mpriessner/windsurf_repos/SciSymbioLens`
**Tech stack**: iOS (Swift/SwiftUI), Python FastAPI backend

## Objective

Modify SciSymbioLens to use cloud Supabase for Google Sign-In (`signInWithIdToken`) while keeping all data operations (video uploads, experiment tracking) on the local Supabase instance.

## Key Advantage: No Redirect Problem

SciSymbioLens uses **native Google Sign-In SDK** (`GIDSignIn`), not browser-based OAuth redirect. The flow is:
1. Native Google Sign-In dialog on iOS
2. Returns ID token + access token directly
3. Exchanges tokens with Supabase via `signInWithIdToken()` (direct API call, no redirect)

This means the Google Sign-In itself works remotely even with local Supabase. However, switching to cloud Supabase for auth provides:
- Shared user identity across all 4 apps
- Single `auth.users` table in the cloud for SSO

## Current Auth Architecture

### iOS App

| File | Role |
|------|------|
| `ios/.../Services/Supabase/SupabaseManager.swift` | Singleton, `signInWithGoogle()` using `signInWithIdToken` |
| `ios/.../Services/Supabase/SupabaseConfig.swift` | Reads URL/key from Info.plist |
| `ios/.../ViewModels/AuthViewModel.swift` | UI state management for auth |
| `ios/.../Views/Auth/LoginView.swift` | Login UI with Google button |
| `ios/.../Models/AuthState.swift` | Auth state enum |
| `ios/.../Services/Sync/UserSyncService.swift` | Syncs user to ChemELN |
| `Config/Debug.xcconfig` | Supabase URL, keys, Google client IDs |
| `Config/Release.xcconfig` | Production values (placeholder) |

### Backend (FastAPI)

| File | Role |
|------|------|
| `backend/app/main.py` | FastAPI app, CORS config |
| `backend/app/config.py` | Settings from `.env` |
| `backend/app/routers/token.py` | Gemini API token endpoint (no auth check) |

## Changes Required

### iOS App Changes

#### 1. Add Cloud Supabase Config to xcconfig

**File**: `ios/SciSymbioLens/Config/Debug.xcconfig`

Add:
```
// Cloud Supabase (auth only)
SUPABASE_CLOUD_URL = https:/$()/xysiyvrwvhngtwccouqy.supabase.co
SUPABASE_CLOUD_ANON_KEY = <cloud anon key from S41-01>
```

Keep existing local Supabase config:
```
// Local Supabase (data) -- via Tailscale
SUPABASE_URL = https:/$()/martins-macbook-pro.tail3a744f.ts.net:54341
SUPABASE_ANON_KEY = eyJhbGci...
```

#### 2. Update Info.plist

**File**: `ios/.../Resources/Info.plist`

Add entries:
```xml
<key>SUPABASE_CLOUD_URL</key>
<string>$(SUPABASE_CLOUD_URL)</string>

<key>SUPABASE_CLOUD_ANON_KEY</key>
<string>$(SUPABASE_CLOUD_ANON_KEY)</string>
```

#### 3. Create Cloud Supabase Config

**New file**: `ios/.../Services/Supabase/CloudSupabaseConfig.swift`

```swift
import Foundation

enum CloudSupabaseConfig {
    static var urlString: String? {
        Bundle.main.object(forInfoDictionaryKey: "SUPABASE_CLOUD_URL") as? String
    }

    static var url: URL? {
        guard let str = urlString, !str.isEmpty else { return nil }
        return URL(string: str)
    }

    static var anonKey: String? {
        Bundle.main.object(forInfoDictionaryKey: "SUPABASE_CLOUD_ANON_KEY") as? String
    }

    static var isConfigured: Bool {
        url != nil && anonKey != nil && !(anonKey?.isEmpty ?? true)
    }
}
```

#### 4. Modify SupabaseManager

**File**: `ios/.../Services/Supabase/SupabaseManager.swift`

Add a cloud client alongside the existing local client:

```swift
// Add property:
private var cloudClient: SupabaseClient?

// In init(), after local client creation:
if CloudSupabaseConfig.isConfigured {
    cloudClient = SupabaseClient(
        supabaseURL: CloudSupabaseConfig.url!,
        supabaseKey: CloudSupabaseConfig.anonKey!,
        options: .init(
            auth: .init(
                autoRefreshToken: false  // We don't persist cloud sessions
            )
        )
    )
    Logger.info("Cloud Supabase client initialized", category: .authentication)
}
```

#### 5. Modify signInWithGoogle()

**File**: `ios/.../Services/Supabase/SupabaseManager.swift`

Change `signInWithGoogle()` to use the cloud client for `signInWithIdToken`, then map to local user:

```swift
@MainActor
func signInWithGoogle() async throws -> User {
    guard let localClient = client else {
        throw AuthError.notConfigured
    }

    authState = .loading

    do {
        // Get presenting view controller
        guard let presentingVC = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow })?
                .rootViewController else {
            throw AuthError.unknown("Could not find presenting view controller")
        }

        // Configure Google Sign-In
        if let serverClientID = Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String,
           !serverClientID.isEmpty,
           let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(
                clientID: clientID,
                serverClientID: serverClientID
            )
        }

        // Perform native Google Sign-In
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingVC)

        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthError.unknown("Google Sign-In did not return an ID token")
        }
        let accessToken = result.user.accessToken.tokenString

        // Determine which Supabase to authenticate against
        let authClient = cloudClient ?? localClient

        // Exchange Google ID token with Supabase (cloud or local)
        let session = try await authClient.auth.signInWithIdToken(
            credentials: .init(
                provider: .google,
                idToken: idToken,
                accessToken: accessToken
            )
        )

        let authUser = session.user
        let email = authUser.email ?? ""

        // If we used cloud auth, map to local user
        if cloudClient != nil {
            let localUser = try await mapCloudUserToLocal(
                email: email,
                fullName: authUser.userMetadata["full_name"] as? String,
                avatarUrl: authUser.userMetadata["avatar_url"] as? String,
                cloudUserId: authUser.id.uuidString
            )

            // Sign into local Supabase
            // Use admin-generated magic link or direct sign-in
            try await signInLocalUser(email: email)
        } else {
            // Direct local auth (no cloud configured)
            currentUser = authUser
            authState = .authenticated(authUser)
        }

        Logger.info("User signed in with Google (cloud: \(cloudClient != nil))", category: .authentication)

        // Non-blocking sync to ChemELN
        Task.detached(priority: .utility) {
            await UserSyncService.shared.syncOnSignInIfNeeded(
                email: email,
                password: ""
            )
        }

        return currentUser!
    } catch {
        let authError = mapSupabaseError(error)
        currentUser = nil
        authState = .error(authError.localizedDescription)
        throw authError
    }
}

/// Map a cloud-authenticated user to the local Supabase instance
private func mapCloudUserToLocal(
    email: String,
    fullName: String?,
    avatarUrl: String?,
    cloudUserId: String
) async throws -> Bool {
    guard let localClient = client else { return false }

    // Use local Supabase admin API to find/create user
    // This requires the service role key -- stored in backend or xcconfig
    let serviceKey = SupabaseConfig.serviceRoleKey
    guard let serviceKey = serviceKey, !serviceKey.isEmpty else {
        Logger.warning("Service role key not configured, skipping cloud-to-local mapping",
                      category: .authentication)
        return false
    }

    let localUrl = SupabaseConfig.url
    let adminUrl = "\(localUrl)/auth/v1/admin/users"

    // List users to find existing
    var request = URLRequest(url: URL(string: adminUrl)!)
    request.setValue("Bearer \(serviceKey)", forHTTPHeaderField: "Authorization")
    request.setValue(serviceKey, forHTTPHeaderField: "apikey")

    let (data, _) = try await URLSession.shared.data(for: request)
    let userList = try JSONDecoder().decode(AdminUserList.self, from: data)

    let existingUser = userList.users.first {
        $0.email?.lowercased() == email.lowercased()
    }

    if existingUser != nil {
        Logger.info("Found existing local user: \(email)", category: .authentication)
        return true
    }

    // Create new local user
    var createRequest = URLRequest(url: URL(string: adminUrl)!)
    createRequest.httpMethod = "POST"
    createRequest.setValue("Bearer \(serviceKey)", forHTTPHeaderField: "Authorization")
    createRequest.setValue(serviceKey, forHTTPHeaderField: "apikey")
    createRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body: [String: Any] = [
        "email": email,
        "email_confirm": true,
        "user_metadata": [
            "full_name": fullName ?? "",
            "avatar_url": avatarUrl ?? "",
            "cloud_user_id": cloudUserId,
            "provider": "google",
        ]
    ]
    createRequest.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (_, createResp) = try await URLSession.shared.data(for: createRequest)
    let httpResp = createResp as? HTTPURLResponse

    if httpResp?.statusCode == 200 || httpResp?.statusCode == 422 {
        Logger.info("Local user created/exists: \(email)", category: .authentication)
        return true
    }

    return false
}

/// Sign into local Supabase after cloud-to-local mapping
private func signInLocalUser(email: String) async throws {
    guard let localClient = client else { return }

    // Generate magic link via admin API, then verify OTP
    let serviceKey = SupabaseConfig.serviceRoleKey ?? ""
    let localUrl = SupabaseConfig.url

    var request = URLRequest(url: URL(string: "\(localUrl)/auth/v1/admin/generate_link")!)
    request.httpMethod = "POST"
    request.setValue("Bearer \(serviceKey)", forHTTPHeaderField: "Authorization")
    request.setValue(serviceKey, forHTTPHeaderField: "apikey")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body: [String: Any] = ["type": "magiclink", "email": email]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (data, _) = try await URLSession.shared.data(for: request)
    let linkResponse = try JSONDecoder().decode(GenerateLinkResponse.self, from: data)

    if let tokenHash = linkResponse.hashedToken {
        let session = try await localClient.auth.verifyOTP(
            tokenHash: tokenHash,
            type: .magiclink
        )
        currentUser = session.user
        authState = .authenticated(session.user)
    }
}
```

#### 6. Add Supporting Types

**New file or extension**: Add `AdminUserList` and `GenerateLinkResponse` Codable types for the admin API responses.

### Backend Changes (Minimal)

The backend (`backend/app/`) currently has **no auth verification**. The token endpoint serves Gemini API keys without checking who's calling.

For this story, the backend needs **no changes** related to cloud auth. If auth verification is added later (separate story), it should verify **local** Supabase JWTs (since the iOS app will have a local session after mapping).

### Optional: Add Service Role Key to xcconfig

If not already present, add to `Debug.xcconfig`:
```
SUPABASE_SERVICE_ROLE_KEY = <local service role key>
```

And corresponding `Info.plist` entry. Update `SupabaseConfig.swift` to read it.

**Security note**: The service role key in the iOS app binary is acceptable for self-hosted development. For production distribution, the cloud-to-local mapping should happen server-side (in the FastAPI backend).

## Files Modified

### iOS
| File | Change |
|------|--------|
| `Config/Debug.xcconfig` | Add cloud URL and anon key |
| `Resources/Info.plist` | Add cloud URL and anon key entries |
| `Services/Supabase/CloudSupabaseConfig.swift` | **NEW** -- Cloud config reader |
| `Services/Supabase/SupabaseManager.swift` | Cloud client init, modified signInWithGoogle, user mapping |

### Backend
No changes required for this story.

## Files NOT Modified

| File | Why |
|------|-----|
| `Views/Auth/LoginView.swift` | UI unchanged, calls same viewModel methods |
| `ViewModels/AuthViewModel.swift` | Calls same `signInWithGoogle()` on manager |
| `Services/Sync/UserSyncService.swift` | ChemELN sync unchanged |
| `backend/app/*` | No auth verification currently, no change needed |

## Testing

### Local (Simulator)
1. Build and run in Xcode with Debug.xcconfig
2. Tap "Continue with Google"
3. Native Google Sign-In dialog appears
4. After signing in, verify user is authenticated
5. Verify cloud user mapped to local user
6. Test video recording + upload to local Supabase storage

### Remote (Physical Device via Tailscale)
1. Phone connected to Tailscale
2. Build with Tailscale URLs in xcconfig
3. Google sign-in should work (native SDK, no redirect)
4. Video upload should work (goes to local Supabase via Tailscale)

### Email/Password
1. Sign in with email/password -- should use local Supabase directly
2. No cloud involvement

## Rollback

Remove `SUPABASE_CLOUD_URL` and `SUPABASE_CLOUD_ANON_KEY` from xcconfig. `CloudSupabaseConfig.isConfigured` returns false, `cloudClient` is nil, `signInWithGoogle` uses local client directly (existing behavior).

## Acceptance Criteria

- [ ] Google Sign-In authenticates against cloud Supabase
- [ ] Cloud user mapped to local user by email
- [ ] Local session established after mapping
- [ ] Video uploads go to local Supabase storage
- [ ] ChemELN user sync still works
- [ ] Falls back to local auth when cloud not configured
- [ ] Works in simulator (localhost/Tailscale)
- [ ] Works on physical device (Tailscale)
