# Story SKB-34.4: Sweep CLI Command & Scheduling

**Epic:** Epic 34 - Agent Sweep Mode (Housekeeping Agent)
**Story ID:** SKB-34.4
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-34.1 (sweep core), SKB-34.2 (staleness), SKB-34.3 (link discovery)

---

## User Story

As a SymbioKnowledgeBase administrator, I want a CLI command and API endpoint to trigger sweeps with configurable options, and I want to review sweep history to understand the health of my knowledge base over time.

---

## Acceptance Criteria

### CLI Command
- [ ] `npx skb agent:sweep` runs a sweep with default settings (budget 50, current tenant)
- [ ] Supports the following flags:
  | Flag | Description | Default |
  |------|-------------|---------|
  | `--budget <n>` | Max pages to process | 50 |
  | `--tenant <id>` | Tenant ID to sweep | auto-detect from env |
  | `--dry-run` | Preview without making changes | false |
  | `--auto-link` | Auto-create high-confidence links | false |
  | `--verbose` | Show per-page log entries | false |
  | `--json` | Output result as JSON (for piping) | false |
- [ ] Progress output during execution:
  ```
  🔍 Starting sweep for tenant abc-123 (budget: 50)
  📊 Selected 50 pages (12 stale, 8 no-summary, 30 least-recent)

  [  1/50] API Authentication Guide — REGENERATE (stale summary)
  [  2/50] Setup Instructions — SKIP (summary current)
  [  3/50] Database Schema — REGENERATE (no summary)
  ...
  [ 50/50] Old Notes — VISIT_ONLY

  ✅ Sweep complete in 45.2s
  ─────────────────────────────────
  Pages processed:        50
  Summaries regenerated:  12
  Summaries skipped:      35
  Visit only:              3
  Link suggestions found:  8
  Links auto-created:      0
  Errors:                  0
  ─────────────────────────────────
  Session ID: sweep-abc-20260227-143000
  ```
- [ ] `--verbose` adds detail for each page:
  ```
  [  1/50] API Authentication Guide
           Action: REGENERATE_SUMMARY
           Reason: content_changed_significantly
           Duration: 1.2s
           Suggestions: JWT Reference (0.85), Rate Limiting (0.72)
  ```
- [ ] `--json` outputs the full `SweepResult` as JSON (no progress output)
- [ ] `--dry-run` shows what WOULD happen without making changes:
  ```
  [DRY RUN]  1/50  API Authentication Guide — WOULD REGENERATE (stale)
  ```

### API Endpoints

#### Trigger Sweep
- [ ] `POST /api/agent/sweep` triggers a sweep:
  ```json
  {
    "budget": 50,
    "dryRun": false,
    "autoLink": false
  }
  ```
- [ ] Returns immediately with the `sessionId`:
  ```json
  {
    "sessionId": "sweep-uuid",
    "status": "RUNNING",
    "budget": 50,
    "startedAt": "2026-02-27T14:30:00Z"
  }
  ```
- [ ] The sweep runs asynchronously in the background
- [ ] Only one sweep can run per tenant at a time — return 409 if already running

#### Check Sweep Status
- [ ] `GET /api/agent/sweep/{sessionId}` returns current status:
  ```json
  {
    "sessionId": "sweep-uuid",
    "status": "RUNNING",          // or COMPLETED, FAILED
    "budget": 50,
    "startedAt": "2026-02-27T14:30:00Z",
    "completedAt": null,
    "results": null                // Populated when COMPLETED
  }
  ```
- [ ] When status is COMPLETED, `results` contains the full `SweepResult`

#### Sweep History
- [ ] `GET /api/agent/sweep/history` returns past sweeps:
  ```json
  {
    "sessions": [
      {
        "sessionId": "sweep-uuid-1",
        "startedAt": "2026-02-27T14:30:00Z",
        "completedAt": "2026-02-27T14:32:15Z",
        "status": "COMPLETED",
        "budget": 50,
        "pagesProcessed": 50,
        "summariesRegenerated": 12,
        "linksDiscovered": 8,
        "errors": 0
      }
    ],
    "totalSessions": 15
  }
  ```
- [ ] Paginated: `?page=1&pageSize=10` (default: 10 most recent)
- [ ] Filterable: `?status=COMPLETED` or `?status=FAILED`

#### Link Suggestions Review
- [ ] `GET /api/agent/suggestions` returns pending link suggestions:
  ```json
  {
    "suggestions": [
      {
        "id": "suggestion-uuid",
        "sourcePageId": "uuid-1",
        "sourcePageTitle": "API Guide",
        "targetPageId": "uuid-2",
        "targetPageTitle": "JWT Reference",
        "confidence": 0.85,
        "context": "...configure **JWT Reference** tokens for...",
        "status": "PENDING",
        "createdAt": "2026-02-27T14:31:00Z"
      }
    ],
    "totalPending": 8
  }
  ```
- [ ] `PUT /api/agent/suggestions/{id}` to accept or dismiss:
  ```json
  { "status": "ACCEPTED" }  // Creates PageLink
  { "status": "DISMISSED" } // Marks as dismissed
  ```

### package.json Script
- [ ] Add to `package.json` scripts:
  ```json
  "scripts": {
    "agent:sweep": "tsx scripts/agent-sweep.ts"
  }
  ```

### Future Enhancement Note
- [ ] Add a comment block in the CLI script and a section in the EPIC-34 doc noting the future "sleep mode" / daemon feature:
  ```
  // FUTURE: Daemon mode — run sweeps automatically during idle periods.
  // Implementation: a long-running process that monitors user activity
  // (via API request timestamps or WebSocket connection count) and triggers
  // sweeps when the system has been idle for > 30 minutes.
  // See: https://github.com/[org]/[repo]/issues/XXX
  ```
- [ ] Also note cron scheduling as an alternative:
  ```
  # Example crontab entry (run sweep every night at 2am):
  # 0 2 * * * cd /app && npx skb agent:sweep --budget 200
  ```

---

## Architecture Overview

```
CLI Architecture:
─────────────────

npx skb agent:sweep --budget 50 --verbose
        │
        ▼
scripts/agent-sweep.ts
  1. Parse CLI arguments (minimist or commander)
  2. Resolve tenant (from env or --tenant flag)
  3. Instantiate SweepService
  4. Call sweep() with progress callback
  5. Print progress lines as they arrive
  6. Print final summary
  7. Exit with code 0 (success) or 1 (errors occurred)


API Architecture:
─────────────────

POST /api/agent/sweep
        │
        ▼
1. Validate request body
2. Check for running sweep (query SweepSession where status = RUNNING)
   - If exists → 409 Conflict
3. Create SweepSession (status: RUNNING)
4. Start async sweep:
   setImmediate(() => {
     sweepService.sweep(config).then(result => {
       // Session already updated by SweepService
     }).catch(error => {
       prisma.sweepSession.update({ status: 'FAILED' });
     });
   });
5. Return { sessionId, status: 'RUNNING' } immediately


GET /api/agent/sweep/{sessionId}
        │
        ▼
1. Fetch SweepSession by ID
2. Return status and results


GET /api/agent/sweep/history
        │
        ▼
1. Fetch SweepSessions for tenant
2. Order by startedAt DESC
3. Paginate
4. Return summary (not full pageLog — too large)
```

---

## Implementation Steps

### Step 1: Create CLI Script

**File: `scripts/agent-sweep.ts`** (create)

```typescript
#!/usr/bin/env tsx
import { SweepService } from '../src/lib/sweep/SweepService';
import { parseArgs } from 'util';

async function main() {
  const args = parseArgs({
    options: {
      budget: { type: 'string', default: '50' },
      tenant: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'auto-link': { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    }
  });

  // Resolve tenant
  // Create SweepService
  // Run sweep with progress callback
  // Print results
}

main().catch(console.error);
```

### Step 2: Create Sweep API Endpoint

**File: `src/app/api/agent/sweep/route.ts`** (create)

```typescript
// POST — Trigger sweep
export async function POST(req: NextRequest) {
  // 1. Authenticate + resolve tenant
  // 2. Check for running sweep → 409 if exists
  // 3. Parse body: budget, dryRun, autoLink
  // 4. Start async sweep
  // 5. Return sessionId
}

// GET — List sweep capabilities / health info
export async function GET(req: NextRequest) {
  // Return: configured budget limits, LLM status, last sweep time
}
```

### Step 3: Create Sweep Status Endpoint

**File: `src/app/api/agent/sweep/[sessionId]/route.ts`** (create)

```typescript
// GET — Check sweep status
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  // Fetch SweepSession by ID, return status + results
}
```

### Step 4: Create Sweep History Endpoint

**File: `src/app/api/agent/sweep/history/route.ts`** (create)

```typescript
// GET — List past sweeps
export async function GET(req: NextRequest) {
  // Paginated list of SweepSessions
  // Summary only (no full pageLog)
}
```

### Step 5: Create Suggestions Review Endpoints

**File: `src/app/api/agent/suggestions/route.ts`** (create)

```typescript
// GET — List pending suggestions
export async function GET(req: NextRequest) {
  // Fetch LinkSuggestions with status PENDING
  // Include source and target page titles
}
```

**File: `src/app/api/agent/suggestions/[id]/route.ts`** (create)

```typescript
// PUT — Accept or dismiss suggestion
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Update status to ACCEPTED or DISMISSED
  // If ACCEPTED: create PageLink
}
```

### Step 6: Add Script to package.json

**File: `package.json`** (modify)

Add: `"agent:sweep": "tsx scripts/agent-sweep.ts"`

---

## Testing Requirements

### Unit Tests (6+ cases)

**File: `src/__tests__/scripts/agent-sweep.test.ts`**

- Default arguments parsed correctly (budget 50, no dry-run)
- Custom budget flag → passed to SweepService
- --dry-run flag → config.dryRun = true
- --json flag → output is valid JSON
- Budget 0 → empty result (no processing)
- Budget > MAX → capped to MAX

### Integration Tests (6+ cases)

**File: `src/__tests__/integration/sweep-api.test.ts`**

- POST /api/agent/sweep → returns sessionId with RUNNING status
- POST while another is RUNNING → 409 Conflict
- GET /api/agent/sweep/{id} → returns current status
- GET /api/agent/sweep/{id} after completion → COMPLETED with results
- GET /api/agent/sweep/history → returns list sorted by recency
- GET /api/agent/suggestions → returns pending suggestions
- PUT /api/agent/suggestions/{id} with ACCEPTED → PageLink created

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `scripts/agent-sweep.ts` | Create | CLI command for manual sweeps |
| `src/app/api/agent/sweep/route.ts` | Create | Trigger sweep + info |
| `src/app/api/agent/sweep/[sessionId]/route.ts` | Create | Sweep status check |
| `src/app/api/agent/sweep/history/route.ts` | Create | Sweep history list |
| `src/app/api/agent/suggestions/route.ts` | Create | List pending suggestions |
| `src/app/api/agent/suggestions/[id]/route.ts` | Create | Accept/dismiss suggestion |
| `package.json` | Modify | Add agent:sweep script |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
