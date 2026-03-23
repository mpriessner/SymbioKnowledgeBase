# S41-02: Update Google Cloud Console Redirect URIs

**Epic**: EPIC-41 Cloud Auth Local Data
**Type**: Manual / Configuration
**Priority**: P0 (Prerequisite)
**Depends on**: S41-01 (need the cloud callback URL)
**Blocks**: S41-03, S41-04, S41-05, S41-06, S41-07

## Objective

Add the Supabase Cloud callback URL to the Google Cloud Console OAuth 2.0 credentials so Google will accept redirects to the cloud project.

## Background

- **Google Cloud Console**: `console.cloud.google.com`
- **OAuth Client ID**: `588839890978-dhtemct8murhd2to9fstj106u1qulgfn.apps.googleusercontent.com`
- Currently has redirect URIs for local Supabase instances (`localhost:54321`, `localhost:54331`, `localhost:54341`, `localhost:54351`)
- Need to add the cloud Supabase callback URL

## Steps

### 1. Open Google Cloud Console
- Go to: `https://console.cloud.google.com/apis/credentials`
- Select the correct project (the one containing the OAuth client ID above)

### 2. Edit the OAuth 2.0 Client ID
- Click on the OAuth 2.0 Client ID: `588839890978-...`
- Go to the **Authorized redirect URIs** section

### 3. Add Cloud Supabase Callback URI
Add this URI:
```
https://xysiyvrwvhngtwccouqy.supabase.co/auth/v1/callback
```

### 4. Add Authorized JavaScript Origins
In the **Authorized JavaScript origins** section, add:
```
https://xysiyvrwvhngtwccouqy.supabase.co
```

### 5. Keep Existing URIs
DO NOT remove existing URIs. The following should remain for backward compatibility during the transition and for local-only auth fallback:
```
http://localhost:54321/auth/v1/callback
http://127.0.0.1:54321/auth/v1/callback
http://localhost:54331/auth/v1/callback
http://127.0.0.1:54331/auth/v1/callback
http://localhost:54341/auth/v1/callback
http://127.0.0.1:54341/auth/v1/callback
http://localhost:54351/auth/v1/callback
http://127.0.0.1:54351/auth/v1/callback
```

### 6. Save and Wait for Propagation
- Click **Save**
- Google changes can take 5-30 minutes to propagate
- If you get a 500 error when testing immediately, wait and retry

## Acceptance Criteria

- [ ] `https://xysiyvrwvhngtwccouqy.supabase.co/auth/v1/callback` is in the authorized redirect URIs
- [ ] `https://xysiyvrwvhngtwccouqy.supabase.co` is in the authorized JavaScript origins
- [ ] All existing localhost redirect URIs are still present
- [ ] Changes have propagated (test by attempting a Google sign-in through the cloud project)

## Verification

After propagation, you can test by opening this URL in your browser (replace `YOUR_ANON_KEY` with the cloud anon key):
```
https://xysiyvrwvhngtwccouqy.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback
```
This should redirect to Google's sign-in page without a `redirect_uri_mismatch` error.

## Notes

- The Google OAuth Client ID is a "Web application" type -- this is correct
- The iOS app uses a separate iOS Client ID (`588839890978-mkgq67u93sqckbusgufsapr95bnl6a4c`) for native Google Sign-In, but the server client ID (web) is what Supabase validates against
- If you need to create a new OAuth client, use "Web application" type
