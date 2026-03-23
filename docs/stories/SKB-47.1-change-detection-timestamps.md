# Story SKB-47.1: Change Detection via Timestamps

**Epic:** Epic 47 - Incremental Sync & Maintenance
**Story ID:** SKB-47.1
**Story Points:** 3 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-45 (Chemistry KB Data Model — initial sync structure must exist)

---

## User Story

As a sync system, I want to detect which experiments changed in ChemELN since the last sync, So that I can update only the affected pages instead of re-syncing the entire KB.

---

## Acceptance Criteria

1. **Sync State File**
   - [ ] Sync state stored in `.sync-state/chemeln-sync.json`
   - [ ] JSON format with: `lastSyncTimestamp`, `experiments` (map of experiment ID → metadata)
   - [ ] File versioned in git (human-readable for debugging)
   - [ ] Initial state after first sync: `lastSyncTimestamp` = sync completion time

2. **Sync State Schema**
   - [ ] Schema:
     ```json
     {
       "version": "1.0",
       "lastSyncTimestamp": "2026-03-21T14:30:00.000Z",
       "experiments": {
         "EXP-2026-0042": {
           "contentHash": "sha256:abc123...",
           "lastUpdated": "2026-03-21T14:25:00.000Z",
           "reactionType": "suzuki-coupling",
           "researcher": "Dr. Jane Mueller"
         }
       }
     }
     ```

3. **ChemELN API Query**
   - [ ] Query endpoint: `GET /api/experiments?updated_at_gt=TIMESTAMP`
   - [ ] Add 1-minute buffer for clock skew: `updated_at_gt = lastSyncTimestamp - 60s`
   - [ ] Response includes: `id`, `updated_at`, `status`, and full experiment data
   - [ ] Handle pagination if response > 100 experiments

4. **Change Classification**
   - [ ] **NEW:** Experiment ID not in sync state
   - [ ] **UPDATED:** Experiment ID in sync state, `updated_at` timestamp changed
   - [ ] **DELETED:** Experiment ID in sync state but:
     - Missing from ChemELN API response, OR
     - Status changed to `archived` or `deleted`
   - [ ] Return change set: `{ new: ExperimentData[], updated: ExperimentData[], deleted: string[] }`

5. **Content Hash Calculation**
   - [ ] Hash algorithm: SHA-256
   - [ ] Hash input: Normalized page content (strip timestamps and metadata that change on every sync)
   - [ ] Normalization:
     - Strip YAML frontmatter `updated:` field
     - Strip "Last synced" footer
     - Normalize whitespace (trim lines, consistent line endings)
   - [ ] Store hash in sync state: `experiments[id].contentHash`

6. **Clock Skew Handling**
   - [ ] Add 1-minute buffer to `lastSyncTimestamp` when querying ChemELN
   - [ ] Formula: `query_timestamp = lastSyncTimestamp - 60000` (milliseconds)
   - [ ] Reason: Accounts for server time differences between KB and ChemELN
   - [ ] Duplicate detection: Skip experiments already in sync state with same `contentHash`

7. **Sync State Update**
   - [ ] After successful sync:
     - Update `lastSyncTimestamp` to current time
     - Add/update entries in `experiments` map
     - Remove entries for deleted experiments
   - [ ] Atomic write: Write to temp file, then rename (avoid partial writes)
   - [ ] Backup old state: Keep last 5 sync states as `.sync-state/chemeln-sync.backup-N.json`

8. **Error Handling**
   - [ ] ChemELN API error → log error, don't update sync state, return empty change set
   - [ ] Invalid sync state file → log warning, treat as first sync (query all experiments)
   - [ ] Missing `lastSyncTimestamp` → treat as first sync

---

## Technical Implementation Notes

### Sync State Manager

**File: `scripts/sync-chemeln/sync-state-manager.ts`**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

export interface SyncState {
  version: string;
  lastSyncTimestamp: string; // ISO 8601
  experiments: Record<
    string,
    {
      contentHash: string;
      lastUpdated: string;
      reactionType: string;
      researcher: string;
    }
  >;
}

export class SyncStateManager {
  private stateFilePath: string;
  private backupDir: string;

  constructor(projectRoot: string) {
    this.stateFilePath = path.join(projectRoot, '.sync-state', 'chemeln-sync.json');
    this.backupDir = path.join(projectRoot, '.sync-state');
  }

  async loadState(): Promise<SyncState> {
    try {
      const content = await fs.readFile(this.stateFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.warn('No sync state found — treating as first sync');
      return {
        version: '1.0',
        lastSyncTimestamp: new Date(0).toISOString(), // Epoch
        experiments: {},
      };
    }
  }

  async saveState(state: SyncState): Promise<void> {
    // Backup old state
    await this.backupCurrentState();

    // Write new state (atomic)
    const tempPath = `${this.stateFilePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tempPath, this.stateFilePath);

    console.log(`✓ Sync state updated: ${this.stateFilePath}`);
  }

  private async backupCurrentState(): Promise<void> {
    try {
      const currentState = await fs.readFile(this.stateFilePath, 'utf-8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `chemeln-sync.backup-${timestamp}.json`);
      await fs.writeFile(backupPath, currentState, 'utf-8');

      // Keep only last 5 backups
      const backups = await fs.readdir(this.backupDir);
      const backupFiles = backups.filter((f) => f.startsWith('chemeln-sync.backup-'));
      if (backupFiles.length > 5) {
        backupFiles.sort().reverse();
        for (const file of backupFiles.slice(5)) {
          await fs.unlink(path.join(this.backupDir, file));
        }
      }
    } catch (err) {
      // Ignore backup errors
    }
  }

  calculateContentHash(pageContent: string): string {
    // Normalize content (strip timestamps and metadata)
    const normalized = pageContent
      .replace(/^updated: .+$/m, '') // Remove "updated:" line
      .replace(/Last synced: .+$/m, '') // Remove "Last synced:" line
      .split('\n')
      .map((line) => line.trim())
      .join('\n');

    return createHash('sha256').update(normalized, 'utf-8').digest('hex');
  }
}
```

---

### Change Detection

**File: `scripts/sync-chemeln/detect-changes.ts`**

```typescript
import { SyncStateManager, SyncState } from './sync-state-manager';
import { ExperimentData, fetchExperimentsFromChemELN } from './chemeln-api';

export interface ChangeSet {
  new: ExperimentData[];
  updated: ExperimentData[];
  deleted: string[];
}

export async function detectChanges(
  stateManager: SyncStateManager,
  chemelRootUrl: string,
  apiKey: string,
): Promise<ChangeSet> {
  const state = await stateManager.loadState();

  // Query ChemELN for experiments updated since last sync (with 1-minute buffer)
  const lastSyncTime = new Date(state.lastSyncTimestamp);
  const queryTime = new Date(lastSyncTime.getTime() - 60000); // 1 minute buffer

  console.log(`Querying ChemELN for experiments updated after ${queryTime.toISOString()}`);

  let allExperiments: ExperimentData[];
  try {
    allExperiments = await fetchExperimentsFromChemELN(
      chemelRootUrl,
      apiKey,
      queryTime.toISOString(),
    );
  } catch (err) {
    console.error('ChemELN API error:', err);
    return { new: [], updated: [], deleted: [] };
  }

  const changeSet: ChangeSet = {
    new: [],
    updated: [],
    deleted: [],
  };

  // Classify experiments
  const seenIds = new Set<string>();

  for (const exp of allExperiments) {
    seenIds.add(exp.id);

    if (!state.experiments[exp.id]) {
      // NEW experiment
      changeSet.new.push(exp);
    } else {
      // Check if updated (compare updated_at timestamp)
      const storedUpdatedAt = state.experiments[exp.id].lastUpdated;
      if (exp.updated_at !== storedUpdatedAt) {
        changeSet.updated.push(exp);
      }
    }
  }

  // Detect deleted experiments (in state but not in ChemELN response)
  for (const expId of Object.keys(state.experiments)) {
    if (!seenIds.has(expId)) {
      changeSet.deleted.push(expId);
    }
  }

  console.log(
    `Changes detected: ${changeSet.new.length} new, ${changeSet.updated.length} updated, ${changeSet.deleted.length} deleted`,
  );

  return changeSet;
}
```

---

### ChemELN API Client

**File: `scripts/sync-chemeln/chemeln-api.ts`**

```typescript
export interface ExperimentData {
  id: string;
  updated_at: string;
  status: 'active' | 'archived' | 'deleted';
  reaction_type: string;
  researcher: string;
  reagents: Array<{
    chemical_name: string;
    cas: string;
    role: string;
    amount: number;
    amount_unit: string;
  }>;
  // ... other fields
}

export async function fetchExperimentsFromChemELN(
  rootUrl: string,
  apiKey: string,
  updatedAfter: string,
): Promise<ExperimentData[]> {
  const url = `${rootUrl}/api/experiments?updated_at_gt=${encodeURIComponent(updatedAfter)}&limit=1000`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ChemELN API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.experiments || [];
}
```

---

## Test Scenarios

### Unit Tests: `tests/sync-chemeln/sync-state-manager.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SyncStateManager } from '@/scripts/sync-chemeln/sync-state-manager';
import fs from 'fs/promises';

describe('SyncStateManager', () => {
  const testDir = '/tmp/test-sync-state';
  let manager: SyncStateManager;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    manager = new SyncStateManager(testDir);
  });

  it('should return empty state on first load', async () => {
    const state = await manager.loadState();
    expect(state.version).toBe('1.0');
    expect(state.lastSyncTimestamp).toBe(new Date(0).toISOString());
    expect(Object.keys(state.experiments)).toHaveLength(0);
  });

  it('should save and load state', async () => {
    const state = {
      version: '1.0',
      lastSyncTimestamp: new Date().toISOString(),
      experiments: {
        'EXP-2026-0042': {
          contentHash: 'abc123',
          lastUpdated: '2026-03-21T14:25:00.000Z',
          reactionType: 'suzuki-coupling',
          researcher: 'Dr. Mueller',
        },
      },
    };

    await manager.saveState(state);
    const loaded = await manager.loadState();

    expect(loaded.lastSyncTimestamp).toBe(state.lastSyncTimestamp);
    expect(loaded.experiments['EXP-2026-0042'].contentHash).toBe('abc123');
  });

  it('should calculate content hash consistently', () => {
    const content = `# Experiment\n\nupdated: 2026-03-21\n\nSome content\n\nLast synced: 2026-03-21`;
    const hash1 = manager.calculateContentHash(content);
    const hash2 = manager.calculateContentHash(content);

    expect(hash1).toBe(hash2);
  });
});
```

---

## Dependencies

- **EPIC-45:** Chemistry KB Data Model (initial sync must exist)

---

## Dev Notes

### Why 1-Minute Buffer?

- ChemELN and KB servers may have slightly different clocks
- Buffer ensures we don't miss experiments updated exactly at sync time
- Duplicate detection via content hash prevents re-syncing unchanged experiments

### Performance Considerations

- For large KBs (1000+ experiments), sync state file can be ~1MB
- Consider compressing old backups (gzip)
- Consider storing only essential metadata in sync state (not full experiment data)

---

**Last Updated:** 2026-03-21
