# Bidirectional sync — SKB backflow to notebook and ExpTube

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-04
- **Status:** draft
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** Phase 2, depends on [a71-01-notebook-joins-sync-mesh](./2026-07-04-a71-01-notebook-joins-sync-mesh.md) and [a71-02-content-sync-fill-scaffolds](./2026-07-04-a71-02-content-sync-fill-scaffolds.md) (this story only backflows the `## KB Notes` section those stories establish). MUST link `2026-07-03-a70-06-sync-tenant-binding-timing-safe-key.md` — the outbound relay this story adds shares the exact `SYNC_SERVICE_KEY`/tenant-binding surface that story hardens; implement this story's auth against whatever a70-06 lands as, not the pre-hardening state. The SymbioKnowledgeBase working tree has uncommitted A70 changes at time of writing — confirm they're merged or explicitly rebase against them before starting. Feeds the verification loop in [a71-07-synchronized-dummy-data](./2026-07-04-a71-07-synchronized-dummy-data.md).

## Problem / motivation
SKB's sync receiver is explicitly documented, in its own route file, as one-way: *"Applies changes locally without re-propagating to the source platform"* (`src/app/api/sync/experiments/route.ts` header comment). This is formalized further by SKB-52.12, which establishes ExpTube as sole source of truth for experiment lifecycle — SKB never writes back. That doctrine was correct when SKB was a pure mirror. It stops being correct once [a71-02](./2026-07-04-a71-02-content-sync-fill-scaffolds.md) gives SKB pages a `## KB Notes` section that only humans edit directly in SKB — today, anything a scientist writes there is trapped: it never reaches the notebook or ExpTube, so it's invisible to anyone working from those surfaces, and a future `create`/`update` lifecycle sync could even risk clobbering it if the section-ownership discipline from a71-02 isn't respected everywhere.

**This story explicitly supersedes SKB-52.12's one-way doctrine** for one narrow case: content originating in SKB's `## KB Notes` section, and only for pages carrying an `externalId` (i.e. pages already part of the sync mesh — private, unsynced SKB pages are never affected).

## Proposed change
Add an outbound relay from SKB, triggered on `## KB Notes` edits, flowing SKB → ExpTube hub → notebook (extending the ingest-token surface with a new sync-flavored endpoint) and SKB → ExpTube hub → ExpTube's own experiment row (if a "KB notes" concept is added there — flagged, not built in this story).

**1. Trigger.** Hook the page-save path for Chemistry KB → Experiments pages (wherever SKB's page editor persists a Tiptap doc — the same write path `content_update` reads from in a71-02) with a diff check: if the saved doc's `## KB Notes` subtree changed since the last save, and the page has a non-null `externalId`, enqueue an outbound relay. Do this as a debounced background job (same 30s-coalescing pattern as a71-02's notebook push) rather than a synchronous call in the request path, so page saves stay fast.

**2. Outbound payload**, POSTed to the ExpTube hub (`EXPTUBE_API_URL` + `/api/sync/experiments`, i.e. the *inbound* route ExpTube already exposes for ChemELN/mobile — SKB becomes a new caller of it):
```json
{
  "eln_experiment_id": "EXP-2025-0001",
  "action": "content_update",
  "source": "skb",
  "correlation_id": "uuid",
  "content": {
    "section": "kb_notes",
    "markdown": "<= 50_000 chars",
    "generated_at": "2026-07-04T12:00:00Z"
  }
}
```
ExpTube's hub-inbound route (`app/api/sync/experiments/route.ts`) must add `source: "skb"` handling: relay `kb_notes` content onward to notebook (new endpoint, see below) and optionally store it against the ExpTube experiment row (out of scope here — flag for ExpTube-side story).

**3. Notebook-side ingest.** The notebook's existing inbound surface (`_require_ingest_token`, `backend/app.py:3832`) is built for phone-originated captures and requires `X-Source-Device: phone` + `X-Capture-Timestamp` replay-window headers (see e.g. the `/documents`, `/protocol-from-text`, ingest-photo/video/audio routes clustered around `app.py:3937-4662`). A server-to-server sync call from ExpTube is neither a phone nor time-sensitive in the same replay-window sense, so it needs a **sync variant**: a new endpoint `POST /api/experiments/{experiment_id}/sync-content` authenticated by the same per-experiment/workspace ingest-token minting flow (`app.py:3397`/`:3428`) but gated by a distinct `_require_sync_token()` check that (a) does not require the phone-specific headers, (b) does still replay-guard on `correlation_id` (dedupe, not timestamp-window) to make retries idempotent, and (c) writes the incoming markdown into a new `kb_notes.md` file alongside `wiki.md` in the experiment folder — **never** into `wiki.md` itself, since that file is regenerated wholesale by the notebook's own LLM summarization and would silently destroy the KB Notes content on the next regeneration. Surface `kb_notes.md` content back into the notebook UI as a distinct, clearly-labeled "Notes from Knowledge Base" panel (read display is in scope; a notebook-side editable-and-push-back-up loop for this specific file is out of scope — see below).

**4. Loop guards.** ExpTube's anti-loop for lifecycle events is real and double-layered — verified: the hub-inbound route guards each SKB relay with `if (body.source !== 'skb')` (e.g. `app/api/sync/experiments/route.ts` ~L205, L228), and `skb-sync-service.ts` *also* early-returns on `if (options.source === 'skb')` inside each `sync*ToSKB` (~L113/141/168/192). **However**, this skip only covers the existing lifecycle actions. The `content_update`/`kb_notes` relay this story adds is **greenfield in the hub**: the hub currently rejects `content_update` outright (action allowlist ~L90 → HTTP 422 `"Unknown action"`) and has **no** SKB-content or notebook relay at all. So "mirror the existing skip" is aspirational, not literal — the new `content_update` case must implement its own source-tagging and skb-skip from scratch, matching the lifecycle pattern. Concretely:
- SKB tags outbound relays `source: "skb"`.
- ExpTube's hub must add a `content_update` case that, on receiving `source: "skb"`, relays only to the notebook sync-content endpoint and does **not** call any `sync*ToSKB` — reusing the `body.source !== 'skb'` guard shape the lifecycle cases already use (there is no pre-existing content relay to "mirror," so this is new code following the existing convention).
- Notebook, on receiving a sync-content push, must **not** treat it as a local edit that re-triggers a71-02's `on_notebook_write` → outbound content-sync path (i.e. writing `kb_notes.md` is explicitly exempted from whatever hook fires the a71-02 debounced push).
- Any relay carrying a `correlation_id` already seen (dedupe cache, TTL matching the debounce window plus a safety margin, e.g. 5 minutes) is dropped rather than relayed again.

**5. Timeouts and partial-failure handling across the two-hop relay.** Give each leg of the SKB → hub → notebook relay its own bounded timeout (e.g. 10s per hop, matching the fire-and-forget convention already used elsewhere in this batch) — the story's debounce window (30s) bounds *how often* a relay fires, not how long any single HTTP call is allowed to hang. If the hub accepts the SKB request but its subsequent relay to the notebook's `sync-content` endpoint fails (notebook unreachable, non-2xx, timeout), the hub must not report success back to SKB as if the full chain completed — it should either retry the notebook leg with the same DLQ-style fallback a71-01 already establishes for lifecycle events, or return a clear partial-failure status so SKB (and a human debugging the chain) can tell the KB Notes edit did not reach the notebook. Silently dropping this leg reintroduces exactly the kind of invisible one-way loss this story exists to close.

## Affected repos & files
**SymbioKnowledgeBase:**
- Page-save path (wherever the Tiptap doc persists — same location a71-02's read side touches) — add `## KB Notes` diff detection + debounced relay job.
- `src/lib/sync/kbNotesRelay.ts` — new file: diff detection, payload construction, outbound POST to ExpTube hub, dedupe cache.
- Config: `EXPTUBE_HUB_URL` (may already exist as `EXPTUBE_API_URL`, reuse if so), outbound service key.

**chatbot-notebook-transparency-prototype-ui:**
- `backend/app.py` — new `POST /api/experiments/{experiment_id}/sync-content` route + `_require_sync_token()` auth helper (sibling to `_require_ingest_token` at `:3832`, not a modification of it — the phone-capture surface must stay untouched).
- Experiment folder gains `kb_notes.md` (new file type, alongside `notebook.ipynb`, `wiki.md`, `media/`, `audit.jsonl`).
- UI: a read-only "Notes from Knowledge Base" panel wherever `wiki.md`'s content is currently surfaced.
- `backend/tools.py` — ensure `kb_notes.md` writes bypass the `on_notebook_write` hook used for outbound content sync (or explicitly filter it out downstream).

**ExpTube (flagged, not built here):**
- `app/api/sync/experiments/route.ts` — accept `source: "skb"` for `content_update`/`kb_notes`; relay to notebook's new sync-content endpoint; skip re-relaying to SKB for this source (anti-loop).

## Out of scope
- Two-way editable sync of `kb_notes.md` back up to SKB from the notebook (this story is SKB → notebook one-directional for this specific section; a genuine round-trip editor is a future story once usage patterns are observed).
- Conflict resolution UI — policy is latest-wins with an audit trail (below), no merge UI.
- Storing `kb_notes` content against the ExpTube experiment row itself (flagged for ExpTube-side follow-up).

## Conflict policy
Latest-wins by `generated_at`/save-timestamp, same as a71-02's stale-guard. Every applied write is appended to an audit trail: SKB-side, a `PageSyncSectionState`-adjacent log entry (extends a71-02's model); notebook-side, an append to `audit.jsonl` (the experiment's existing hash-chained ledger) so the KB-notes push has the same tamper-evidence as every other notebook mutation. Explicit call-out: a71-02 established that `wiki.md` regeneration **overwrites** its owned sections wholesale on every LLM run — this story's `kb_notes.md` is a **separate file** specifically so that regeneration cadence never has a chance to touch KB-authored content. Do not attempt to merge KB Notes text into the LLM-generated wiki narrative; keep them visually and physically distinct.

## Acceptance criteria
1. Editing `## KB Notes` on an SKB page with a non-null `externalId` produces exactly one outbound relay after the debounce window, even across multiple rapid saves.
2. Editing any other section of the same page produces **no** outbound relay (the diff check is scoped to the `## KB Notes` subtree only).
3. A page with `externalId: null` (never synced) never triggers a relay regardless of edits.
4. ExpTube's hub, on receiving `source: "skb"`, relays to the notebook sync-content endpoint and does not call any `sync*ToSKB` function for that event (verified via a test double asserting zero calls).
5. The notebook's new `sync-content` endpoint rejects requests missing the sync token, and rejects requests carrying the phone-only headers as a no-op path (they simply aren't required, not that their presence causes failure) — verified it does NOT share `_require_ingest_token`'s replay-window logic.
6. `kb_notes.md` is written for the correct experiment and never mutates `wiki.md`.
7. A repeated relay with an already-seen `correlation_id` within the dedupe TTL is dropped at the receiving end without a second write.
8. Writing `kb_notes.md` does not trigger a71-02's outbound `on_notebook_write` content-sync path (no ping-pong between SKB and notebook).

## Verification plan
- Unit test for the KB-Notes diff detector: edit-in-section vs edit-outside-section, using the same Tiptap fixtures as a71-02's `contentMerge.ts` tests.
- Integration test simulating the full hop: SKB relay → mocked ExpTube hub → mocked notebook sync-content endpoint; assert payload shape and headers at each hop.
- `curl` example against the notebook sync-content endpoint directly (bypassing ExpTube, for isolated testing):
  ```bash
  curl -X POST http://localhost:8000/api/experiments/<uuid>/sync-content \
    -H "Authorization: Bearer $NOTEBOOK_SYNC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"section":"kb_notes","markdown":"## KB Notes\nFollow-up needed on yield.","correlation_id":"c-1","generated_at":"2026-07-04T12:00:00Z"}'
  ```
  Confirm `kb_notes.md` is created/updated and `wiki.md` is untouched (diff the file before/after).
- Loop-guard test: fire the same `correlation_id` twice within the TTL window at the ExpTube hub; assert the second call never reaches the notebook endpoint (mock assertion) or the notebook endpoint itself returns a dedupe no-op.
- Regression: rerun a71-01/a71-02's full test suites — the new sync-content endpoint must not affect any existing `_require_ingest_token` gated route or the phone-capture flows they protect.

## Regression risks
- **Weakening the "SKB never re-propagates" invariant is the whole risk surface of this story.** Any bug in the loop guard turns into an infinite sync ping-pong across three systems. Mitigate: the correlation-id dedupe cache (AC7) plus strict source-tagging (AC4) plus the fact that only one narrow section (`## KB Notes`) is ever eligible for backflow — no other page content in SKB can trigger this path.
- **New auth surface on the notebook (`_require_sync_token`) sitting next to the security-sensitive phone-ingest surface (`_require_ingest_token`).** A copy-paste mistake could accidentally weaken the phone-capture replay-window protection. Mitigate: implement as a genuinely separate function, not a parameterized variant of `_require_ingest_token`, and add a dedicated test asserting the phone-ingest routes' behavior is bit-for-bit unchanged after this story lands.
- **`kb_notes.md` file appearing in an experiment folder that older notebook tooling doesn't expect** (export/import/zip flows, seed scripts) could silently drop it. Mitigate: audit `POST /api/experiments/import` and the experiment zip export path for "copy every file in the folder" vs. an explicit allowlist that would need updating.
- **Depends on a70-06's auth hardening landing first or being explicitly compatible** — implementing against the pre-hardening `SYNC_SERVICE_KEY` check and then having a70-06 change the contract underneath is a real coordination risk given the uncommitted working tree. Mitigate: confirm a70-06's status before starting implementation, not just before merging.

## Reviewer feedback

### Round 1 — Regression lens (Claude Opus fallback for Codex, 2026-07-04)
Reviewer note: local Codex CLI is broken; Claude Opus stood in for Codex. Cited paths read directly.

1. **MAJOR — the anti-loop "already exists" claim was only half-true.** Verified the hub's `source !== 'skb'` skip exists for lifecycle relays (route.ts ~L205/L228) and `skb-sync-service.ts` also early-returns on `source==='skb'` (~L113/141/168/192). But the `content_update`/`kb_notes` path this story adds is entirely new in the hub — the hub 422s `content_update` today (~L90) and has zero content relay to notebook or SKB. The loop guard for the new case must be written from scratch (following the lifecycle convention), not "mirrored." *(Fixed in §4.)*
2. **MAJOR (dependency, not a defect) — the hub content relay to notebook is net-new ExpTube work** and is correctly flagged as ExpTube-side. Reinforced in §4 that this is greenfield, so the ExpTube-side implementer cannot assume any existing plumbing.
3. **VERIFIED OK — the "never re-propagates" doctrine this story supersedes is real.** SKB route header comment L87: *"This is the RECEIVING end — never re-propagates events."* The story's explicit narrow supersede (only `## KB Notes`, only `externalId`-bearing pages) is the right scope.
4. **VERIFIED OK — notebook ingest surface.** `_require_ingest_token` at `backend/app.py:3832` exists; a separate `_require_sync_token()` sibling (not a parameterized variant) is the correct call to avoid weakening the phone-capture replay window. The `kb_notes.md`-separate-from-`wiki.md` design correctly prevents LLM regeneration from clobbering KB-authored text.
5. **MINOR — dedupe cache is in-process.** The `correlation_id` dedupe cache (AC7) will be per-process; under multiple Next.js/uvicorn workers it won't dedupe across workers. At current single-process dev scale this is fine, but note it so a future multi-worker deployment doesn't silently regress the loop guard. Added below.

**Revisions applied (Round 1):**
- Rewrote §4 to state the hub content case is greenfield (422 today, no relay), and that the skb-skip guard must be newly written following the verified lifecycle convention rather than "mirrored" from an existing content relay.

**Open questions for the owner (not fixable by story edit):**
- The `correlation_id` dedupe cache is in-process; if SKB or the notebook ever run multi-worker, the anti-loop guard needs a shared store (Redis/DB) — decide whether to design for that now or accept single-process-only as a documented constraint.
- a70-06 auth-hardening coordination remains a live dependency (already flagged in Provenance); confirm its status before implementing the outbound relay auth.

### Round 2 — GLM-4.5-flash runtime lens (2026-07-04, quota fallback for glm-5.2)

1. **[BLOCKER] `content_update` action doesn't exist in ExpTube's allowlist.** [fold note: already covered — §4 and the Affected files section already state this explicitly ("the hub currently rejects `content_update` outright (action allowlist ~L90) → HTTP 422"), and it's independently re-verified here against `route.ts`'s allowlist `['create','delete','archive','restore','update','purge']`. Not folded again.]
2. **[MAJOR] ExpTube → notebook relay endpoint doesn't exist yet.** [fold note: already covered — the story's own §4 (Round 1 revision) and Affected files already frame this as "greenfield in the hub" / "net-new ExpTube work," and Out of scope / the ExpTube file list already flag it as a separate coordination item. Not folded.]
3. **[MAJOR] No dedupe cache implementation exists anywhere yet.** [fold note: already covered — `kbNotesRelay.ts` (new file, listed in Affected files) is explicitly scoped to include "dedupe cache," and Round 1 already flagged its in-process-only limitation as an open question for the owner. Its non-existence today is this story's premise, not an unaddressed gap. Not folded.]
4. **[MINOR] Phone-header presence on the sync endpoint could cause a fragile rejection.** [fold note: incorrect as a gap — AC5 already mandates the opposite of what this finding worries about: the endpoint "rejects requests carrying the phone-only headers as a **no-op path** (they simply aren't required, not that their presence causes failure)." The story already requires phone headers to be harmless if present, not rejected. Not folded.]
5. **[MINOR] Missing timeout configuration for the relay hops.** Genuine gap — the story specifies a 30s debounce (how often a relay fires) but no per-hop request timeout. [fold note: genuine — folded into new §5 above.]
6. **[MINOR] No error handling for partial failures (SKB→hub succeeds, hub→notebook fails silently).** Genuine gap. [fold note: genuine — folded into new §5 above, alongside the timeout fix since both concern the same two-hop relay's failure behavior.]
7. **[MINOR] Missing auth configuration for the notebook sync endpoint (how the token is minted/stored).** [fold note: incorrect as stated — §3 already specifies this: "authenticated by the same per-experiment/workspace ingest-token minting flow (`app.py:3397`/`:3428`)," i.e. reusing the existing token-minting mechanism rather than inventing a new store. Not folded.]

**Revisions applied (Round 2):**
- Added a new §5 (Timeouts and partial-failure handling across the two-hop relay) specifying per-hop timeouts and requiring the hub to not silently swallow a failed relay to the notebook.
- Findings #1–#4 and #7 were adjudicated as already covered by this story's existing text (in several cases the story states almost verbatim what GLM flagged as missing) or factually incorrect given an existing AC; no further changes made for those.
