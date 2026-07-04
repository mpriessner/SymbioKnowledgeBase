# A70-20 — Account security completion: manage emails, 2FA, passkeys

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `EPIC-19-SUPABASE-AUTH-MIGRATION.md`; auth hub is ExpTube's local Supabase (Kong :54341) shared by several apps — MFA enrolment affects sign-in for ALL of them; coordinate before enabling.

## Problem
Settings → Account security shows three disabled buttons titled "Coming soon"
(manage email addresses, 2FA, passkeys); only password change is wired. Dead
buttons in a security section erode trust.

## Evidence
- `src/components/settings/AccountSecuritySection.tsx:68,131,161`.

## Scope
0. **Precondition — capability spike (blocking):** this repo contains ZERO MFA
   code and the feature rests entirely on ExpTube's shared self-hosted GoTrue
   having `GOTRUE_MFA_*` enabled, WebAuthn support, and a running inbucket —
   none of which SKB owns or verifies. Before committing to any AC, spike:
   query the live GoTrue version/settings, enroll a TOTP factor from a
   scratch script, and confirm email-change mails land in inbucket. Also
   verify per-user opt-in doesn't conflict with project-level AAL2
   enforcement (if AAL2 is enforced globally, opt-in semantics change).
   Re-scope the ACs to what the spike proves.
1. **2FA (TOTP)** via Supabase MFA API: enroll (QR), verify, list/unenroll
   factors; sign-in challenge flow in the login page.
2. **Passkeys**: only if the self-hosted Supabase version supports WebAuthn;
   otherwise HIDE the button (better than disabled) and note follow-up.
3. **Manage emails**: change-email flow via Supabase (verification email — needs
   the local inbucket in dev); show current identity providers.
4. Cross-app caveat documented: enabling MFA changes login UX for every app
   using the shared Supabase — gate behind a per-user opt-in only.

## Acceptance criteria
- AC1: TOTP enroll + challenge on next sign-in works against local Supabase.
- AC2: Unsupported capabilities are hidden, not disabled-with-tooltip.
- AC3: Email change round-trips via inbucket in dev.
- AC4: tsc + vitest green.

## Affected files (expected)
- `src/components/settings/AccountSecuritySection.tsx`
- login page challenge step, Supabase client helpers

## Verification
Live enroll/sign-in cycle on local stack.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** Feature hard-depends on unverified cross-repo infra (ExpTube's GoTrue MFA flags, WebAuthn, inbucket) that SKB doesn't own; per-user opt-in may conflict with AAL2 enforcement. → Blocking capability spike added as Scope 0; ACs to be re-scoped from spike results.

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback): blocking GoTrue capability spike added.
