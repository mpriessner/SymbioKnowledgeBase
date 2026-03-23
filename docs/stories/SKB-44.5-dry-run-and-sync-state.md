# Story SKB-44.5: Dry-Run Mode & Sync State Persistence

**Epic:** Epic 44 - SKB Ingestion Pipeline
**Story ID:** SKB-44.5
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-44.4 (Batch Orchestrator must exist)

---

## User Story

As a data engineer, I want a dry-run mode that previews all changes with diffs before committing, and a sync state that tracks what was synced and when, So that I can safely review proposed changes and avoid redundant syncs.

---

## Acceptance Criteria

- [ ] CLI entry point: `npx tsx scripts/sync-chemeln.ts [options]`
- [ ] CLI options:
  - `--dry-run` — preview changes without writing (default: false)
  - `--full` — full sync all pages, ignore content hashes (default: false)
  - `--incremental` — only sync changed pages since last sync (default: true)
  - `--verbose` — show detailed logs including page content diffs
- [ ] Dry-run output shows:
  - Summary counts: pages to create, update, skip
  - List of pages to create (name + type)
  - Content diffs for pages to update (unified diff format)
  - No writes to SKB
- [ ] Sync state persistence:
  - Store last sync timestamp
  - Per-page content hashes for change detection
  - Sync results (created/updated/failed counts)
  - Default storage: `sync-state.json` in project root
- [ ] Incremental sync only processes pages changed since last sync timestamp
- [ ] Full sync ignores hashes and re-syncs all pages
- [ ] Unit tests for CLI argument parsing, diff generation, state persistence
- [ ] Integration test runs dry-run → full sync → incremental sync sequence

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  CLI: npx tsx scripts/sync-chemeln.ts                       │
│                                                             │
│  Options:                                                   │
│    --dry-run      Preview changes without writing           │
│    --full         Full sync (ignore hashes)                 │
│    --incremental  Only changed pages (default)              │
│    --verbose      Show content diffs                        │
│                                                             │
│  Flow:                                                      │
│    1. Parse CLI arguments                                   │
│    2. Load sync state from sync-state.json                  │
│    3. Connect to ChemELN (EPIC-43 extractors)               │
│    4. Connect to SKB (API writer)                           │
│    5. Run BatchOrchestrator with dryRun flag                │
│    6. Display summary report                                │
│    7. Save sync state (unless dry-run)                      │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  SyncState (sync-state.json)                                │
│                                                             │
│  {                                                          │
│    "lastSyncTimestamp": "2026-03-21T15:30:00Z",             │
│    "pageHashes": {                                          │
│      "eln:EXP-2024-001": "a1b2c3d4...",                     │
│      "cas:3375-31-3": "e5f6g7h8...",                        │
│      "reaction:suzuki-coupling": "i9j0k1l2..."              │
│    },                                                       │
│    "lastSyncResults": {                                     │
│      "created": 50,                                         │
│      "updated": 10,                                         │
│      "skipped": 440,                                        │
│      "failed": 2,                                           │
│      "timestamp": "2026-03-21T15:30:00Z"                    │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘

Dry-Run Output Example:
=======================================
  ChemELN -> SKB Sync Preview (DRY RUN)
=======================================

  To Create: 50 pages
  To Update: 10 pages (content changed)
  To Skip:   440 pages (unchanged)

  === Pages To Create ===
  - [experiment] EXP-2024-001: Suzuki Coupling with 4-bromoanisole
  - [experiment] EXP-2024-002: Heck Reaction optimization
  - [chemical] Palladium Acetate (CAS: 3375-31-3)
  ...

  === Pages To Update ===
  - [chemical] THF (CAS: 109-99-9)
    Diff:
    + ## Used In
    + - [[EXP-2024-001]] (solvent, 10 mL)
    + - [[EXP-2024-005]] (solvent, 20 mL)

=======================================
```

---

## Implementation Steps

### Step 1: Define Sync State Types

**File: `src/lib/chemeln/sync/state.ts`**

```typescript
import fs from 'fs/promises';
import path from 'path';

export interface SyncState {
  lastSyncTimestamp: string | null;
  pageHashes: Record<string, string>; // key: matchTag, value: contentHash
  lastSyncResults: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    timestamp: string;
  } | null;
}

const DEFAULT_STATE: SyncState = {
  lastSyncTimestamp: null,
  pageHashes: {},
  lastSyncResults: null,
};

export class SyncStateManager {
  private statePath: string;
  private state: SyncState;

  constructor(statePath?: string) {
    this.statePath = statePath ?? path.join(process.cwd(), 'sync-state.json');
    this.state = { ...DEFAULT_STATE };
  }

  async load(): Promise<SyncState> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(raw) as SyncState;
    } catch {
      this.state = { ...DEFAULT_STATE };
    }
    return this.state;
  }

  async save(): Promise<void> {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  getHash(matchTag: string): string | null {
    return this.state.pageHashes[matchTag] ?? null;
  }

  setHash(matchTag: string, hash: string): void {
    this.state.pageHashes[matchTag] = hash;
  }

  getLastSyncTimestamp(): string | null {
    return this.state.lastSyncTimestamp;
  }

  updateResults(results: { created: number; updated: number; skipped: number; failed: number }): void {
    this.state.lastSyncTimestamp = new Date().toISOString();
    this.state.lastSyncResults = {
      ...results,
      timestamp: new Date().toISOString(),
    };
  }

  hasChanged(matchTag: string, newHash: string): boolean {
    const existingHash = this.getHash(matchTag);
    return existingHash !== newHash;
  }
}
```

### Step 2: Implement Diff Generation

```typescript
import { createPatch } from 'diff';

export function generateDiff(oldContent: string, newContent: string, fileName: string): string {
  return createPatch(fileName, oldContent, newContent, 'existing', 'updated', { context: 3 });
}

export function formatDiffSummary(
  toCreate: Array<{ type: string; name: string }>,
  toUpdate: Array<{ type: string; name: string; diff: string }>,
  toSkip: number
): string {
  const lines: string[] = [
    '='.repeat(39),
    '  ChemELN -> SKB Sync Preview (DRY RUN)',
    '='.repeat(39),
    '',
    `  To Create: ${toCreate.length} pages`,
    `  To Update: ${toUpdate.length} pages (content changed)`,
    `  To Skip:   ${toSkip} pages (unchanged)`,
    '',
  ];

  if (toCreate.length > 0) {
    lines.push('  === Pages To Create ===');
    for (const page of toCreate) {
      lines.push(`  - [${page.type}] ${page.name}`);
    }
    lines.push('');
  }

  if (toUpdate.length > 0) {
    lines.push('  === Pages To Update ===');
    for (const page of toUpdate) {
      lines.push(`  - [${page.type}] ${page.name}`);
      if (page.diff) {
        lines.push(`    ${page.diff.split('\n').join('\n    ')}`);
      }
    }
    lines.push('');
  }

  lines.push('='.repeat(39));
  return lines.join('\n');
}
```

### Step 3: Implement CLI Entry Point

**File: `scripts/sync-chemeln.ts`**

```typescript
import { parseArgs } from 'node:util';
import { BatchOrchestrator, formatSyncReport } from '../src/lib/chemeln/sync/orchestrator';
import { SyncStateManager } from '../src/lib/chemeln/sync/state';
import { createWriter } from '../src/lib/chemeln/sync/writer';
import { CrossReferenceResolver } from '../src/lib/chemeln/sync/resolver';
import {
  fetchExperiments,
  fetchChemicals,
  fetchReactionTypes,
  fetchResearchers,
  fetchSubstrateClasses,
} from '../src/lib/chemeln';

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'full': { type: 'boolean', default: false },
      'incremental': { type: 'boolean', default: true },
      'verbose': { type: 'boolean', default: false },
    },
  });

  const dryRun = values['dry-run'] ?? false;
  const fullSync = values['full'] ?? false;
  const verbose = values['verbose'] ?? false;

  console.log(`\nChemELN -> SKB Sync ${dryRun ? '(DRY RUN)' : ''}\n`);

  // 1. Load sync state
  const stateManager = new SyncStateManager();
  await stateManager.load();

  if (!fullSync) {
    const lastSync = stateManager.getLastSyncTimestamp();
    if (lastSync) {
      console.log(`  Last sync: ${lastSync}`);
      console.log(`  Mode: Incremental (only changes since last sync)\n`);
    } else {
      console.log('  No previous sync found. Running full sync.\n');
    }
  } else {
    console.log('  Mode: Full sync (ignoring content hashes)\n');
  }

  // 2. Extract data from ChemELN
  console.log('  Extracting data from ChemELN...');
  const dateFilter = !fullSync && stateManager.getLastSyncTimestamp()
    ? { dateRange: { start: stateManager.getLastSyncTimestamp()!, end: new Date().toISOString() } }
    : undefined;

  const [experiments, chemicals, reactionTypes, researchers, substrateClasses] = await Promise.all([
    fetchExperiments(dateFilter),
    fetchChemicals(),
    fetchReactionTypes(),
    fetchResearchers(),
    fetchSubstrateClasses(),
  ]);

  console.log(`  Found: ${experiments.length} experiments, ${chemicals.length} chemicals, ${reactionTypes.length} reaction types\n`);

  // 3. Build resolver
  const resolver = new CrossReferenceResolver();
  resolver.buildLookupMap({ chemicals, reactionTypes, researchers, substrateClasses });

  // 4. Create writer and orchestrator
  const writer = createWriter();
  const orchestrator = new BatchOrchestrator(writer, resolver, {
    dryRun,
    onProgress: (current, total, passName, pageName) => {
      if (verbose) {
        process.stdout.write(`\r  ${passName}: ${current}/${total} - ${pageName}    `);
      }
    },
  });

  // 5. Run sync
  const report = await orchestrator.run({
    experiments,
    chemicals,
    reactionTypes,
    researchers,
    substrateClasses,
  });

  // 6. Display report
  console.log('\n');
  console.log(formatSyncReport(report));

  // 7. Save sync state (unless dry-run)
  if (!dryRun) {
    stateManager.updateResults({
      created: report.totalCreated,
      updated: report.totalUpdated,
      skipped: report.totalSkipped,
      failed: report.totalFailed,
    });
    await stateManager.save();
    console.log('\n  Sync state saved to sync-state.json');
  }
}

main().catch(error => {
  console.error('\n  Sync failed:', error.message);
  process.exit(1);
});
```

---

## Testing Requirements

### Unit Test: `src/__tests__/lib/chemeln/sync/state.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncStateManager } from '@/lib/chemeln/sync/state';
import fs from 'fs/promises';
import path from 'path';

describe('SyncStateManager', () => {
  const testStatePath = path.join('/tmp', 'test-sync-state.json');
  let manager: SyncStateManager;

  beforeEach(() => {
    manager = new SyncStateManager(testStatePath);
  });

  afterEach(async () => {
    try { await fs.unlink(testStatePath); } catch { /* ignore */ }
  });

  it('should load default state when file does not exist', async () => {
    const state = await manager.load();
    expect(state.lastSyncTimestamp).toBeNull();
    expect(state.pageHashes).toEqual({});
  });

  it('should save and reload state', async () => {
    manager.setHash('eln:EXP-001', 'abc123');
    manager.updateResults({ created: 10, updated: 5, skipped: 85, failed: 0 });
    await manager.save();

    const newManager = new SyncStateManager(testStatePath);
    const state = await newManager.load();
    expect(state.pageHashes['eln:EXP-001']).toBe('abc123');
    expect(state.lastSyncResults?.created).toBe(10);
    expect(state.lastSyncTimestamp).toBeTruthy();
  });

  it('should detect content changes via hash comparison', () => {
    manager.setHash('eln:EXP-001', 'abc123');
    expect(manager.hasChanged('eln:EXP-001', 'abc123')).toBe(false);
    expect(manager.hasChanged('eln:EXP-001', 'def456')).toBe(true);
    expect(manager.hasChanged('eln:EXP-002', 'abc123')).toBe(true); // new page
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/sync/state.ts` |
| CREATE | `scripts/sync-chemeln.ts` |
| CREATE | `src/__tests__/lib/chemeln/sync/state.test.ts` |
| MODIFY | `package.json` (add `diff` dependency) |

---

## Dev Notes

**Sync state location:** `sync-state.json` in project root is simplest for MVP. For multi-tenant production, sync state should move to a database table (`chemeln_sync_state` defined in EPIC-44 epic). The `SyncStateManager` abstraction supports both backends.

**Incremental sync limitation:** Incremental sync only catches experiments with `created_at` or `updated_at` after the last sync timestamp. If ChemELN data is modified without updating timestamps (direct DB edits), incremental sync will miss those changes. Use `--full` to catch everything.

**Diff library:** Uses the `diff` npm package for generating unified diffs. The `createPatch` function produces standard unified diff output that's familiar to developers.

**CLI framework:** Uses Node.js built-in `parseArgs` (available since Node 18.3) to avoid adding a CLI framework dependency. For a more complex CLI, consider `commander` or `yargs`.

---

**Last Updated:** 2026-03-21
