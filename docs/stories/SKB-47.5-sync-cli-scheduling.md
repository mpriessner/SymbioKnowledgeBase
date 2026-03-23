# Story SKB-47.5: Sync CLI & Scheduling

**Epic:** Epic 47 - Incremental Sync & Maintenance
**Story ID:** SKB-47.5
**Story Points:** 2 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-47.4 (Aggregation Page Refresh)

---

## User Story

As a KB administrator, I want CLI commands and scheduling options for incremental sync, So that I can keep the Chemistry KB up-to-date without manual intervention.

---

## Acceptance Criteria

1. **CLI Commands**
   - [ ] `npx tsx scripts/sync-chemeln.ts` — Full sync (initial import or complete re-sync)
   - [ ] `npx tsx scripts/sync-chemeln.ts --incremental` — Incremental sync (changes since last sync)
   - [ ] `npx tsx scripts/sync-chemeln.ts --dry-run` — Preview changes without writing files
   - [ ] `npx tsx scripts/sync-chemeln.ts --experiment EXP-2026-0042` — Sync single experiment
   - [ ] `npx tsx scripts/sync-chemeln.ts --help` — Show usage and options

2. **CLI Flags**
   - [ ] `--incremental` — Use change detection (query ChemELN for experiments updated since last sync)
   - [ ] `--dry-run` — Print all operations but don't write any files (show what would be updated)
   - [ ] `--experiment <id>` — Sync single experiment by ID (useful for testing)
   - [ ] `--force` — Skip content hash comparison, update all pages
   - [ ] `--verbose` — Show detailed logging (default: show only summary)

3. **Exit Codes**
   - [ ] `0` — Success (all experiments synced, no errors)
   - [ ] `1` — Partial failure (some experiments failed, but sync continued)
   - [ ] `2` — Total failure (ChemELN API error, sync aborted)

4. **Logging**
   - [ ] Log to `logs/sync-chemeln.log` (append mode)
   - [ ] Log format: JSON lines (`{"timestamp": "...", "level": "info", "message": "...", "context": {...}}`)
   - [ ] Log levels: `debug`, `info`, `warn`, `error`
   - [ ] Console output: Summary only (detailed logs in file)
   - [ ] Console summary:
     ```
     Chemistry KB Sync Summary
     ─────────────────────────
     New experiments:     5
     Updated experiments: 3
     Deleted experiments: 1
     Pages updated:       42
     Duration:            12.5s
     Status:              ✓ Success
     ```

5. **Webhook Endpoint (Optional)**
   - [ ] Endpoint: `POST /api/sync/chemeln/trigger`
   - [ ] Auth: Bearer token (configured in `.env`: `CHEMELN_SYNC_WEBHOOK_TOKEN`)
   - [ ] Payload: `{ "experiment_id": "EXP-2026-0042" }` (optional — if not provided, sync all changes)
   - [ ] Response: `{ "status": "success", "message": "Incremental sync started" }`
   - [ ] Trigger incremental sync asynchronously (don't block webhook response)
   - [ ] Log webhook requests: "Webhook triggered by ChemELN for experiment EXP-2026-0042"

6. **Cron Configuration (Optional)**
   - [ ] Cron schedule: `*/15 * * * *` (every 15 minutes)
   - [ ] Cron job runs: `npx tsx scripts/sync-chemeln.ts --incremental`
   - [ ] Documented in `README.md` with setup instructions
   - [ ] Example crontab entry:
     ```
     */15 * * * * cd /path/to/kb && npx tsx scripts/sync-chemeln.ts --incremental >> logs/cron.log 2>&1
     ```

7. **Error Handling**
   - [ ] ChemELN API errors → log error, exit code 2, don't update sync state
   - [ ] Filesystem errors (permission denied) → log error, exit code 1, rollback partial writes
   - [ ] Invalid CLI arguments → show usage help, exit code 2
   - [ ] Missing `.env` config → log error, exit code 2

8. **Configuration**
   - [ ] Environment variables (`.env`):
     - `CHEMELN_ROOT_URL` — ChemELN API base URL
     - `CHEMELN_API_KEY` — API key for authentication
     - `CHEMELN_SYNC_WEBHOOK_TOKEN` — Webhook auth token (optional)
   - [ ] Validation: Check all required env vars before starting sync

---

## Technical Implementation Notes

### CLI Entry Point

**File: `scripts/sync-chemeln.ts`**

```typescript
#!/usr/bin/env tsx

import { Command } from 'commander';
import { SyncStateManager } from './sync-chemeln/sync-state-manager';
import { detectChanges } from './sync-chemeln/detect-changes';
import { UpdatePropagator } from './sync-chemeln/propagate-updates';
import { EntityPageCreator } from './sync-chemeln/create-entity-pages';
import { AggregationRefresher } from './sync-chemeln/refresh-aggregations';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const program = new Command();

program
  .name('sync-chemeln')
  .description('Sync Chemistry KB with ChemELN')
  .option('--incremental', 'Sync only changes since last sync')
  .option('--dry-run', 'Preview changes without writing files')
  .option('--experiment <id>', 'Sync single experiment by ID')
  .option('--force', 'Update all pages (skip hash comparison)')
  .option('--verbose', 'Show detailed logging')
  .parse(process.argv);

const options = program.opts();

async function main() {
  const startTime = Date.now();

  // Validate environment variables
  const chemelRootUrl = process.env.CHEMELN_ROOT_URL;
  const chemelApiKey = process.env.CHEMELN_API_KEY;

  if (!chemelRootUrl || !chemelApiKey) {
    console.error('Error: Missing required environment variables');
    console.error('Required: CHEMELN_ROOT_URL, CHEMELN_API_KEY');
    process.exit(2);
  }

  const kbDir = path.join(process.cwd(), 'kb');
  const stateManager = new SyncStateManager(process.cwd());

  console.log('Chemistry KB Sync');
  console.log('─────────────────────────');

  if (options.dryRun) {
    console.log('Mode: DRY RUN (no files will be written)');
  } else if (options.incremental) {
    console.log('Mode: Incremental sync');
  } else {
    console.log('Mode: Full sync');
  }

  try {
    let stats = {
      new: 0,
      updated: 0,
      deleted: 0,
      pagesUpdated: 0,
    };

    if (options.experiment) {
      // Single experiment sync
      console.log(`Syncing single experiment: ${options.experiment}`);
      // ... implementation
    } else if (options.incremental) {
      // Incremental sync
      console.log('Detecting changes since last sync...');
      const changeSet = await detectChanges(stateManager, chemelRootUrl, chemelApiKey);

      stats.new = changeSet.new.length;
      stats.updated = changeSet.updated.length;
      stats.deleted = changeSet.deleted.length;

      console.log(`Found: ${stats.new} new, ${stats.updated} updated, ${stats.deleted} deleted`);

      if (!options.dryRun) {
        // Process changes
        const propagator = new UpdatePropagator(stateManager, kbDir);
        const entityCreator = new EntityPageCreator(kbDir);
        const aggregationRefresher = new AggregationRefresher(kbDir, stateManager);

        // Process new experiments
        for (const exp of changeSet.new) {
          await entityCreator.processNewExperiment(exp);
          await propagator.propagateExperimentUpdate(null, exp);
        }

        // Process updated experiments
        for (const exp of changeSet.updated) {
          const state = await stateManager.loadState();
          const oldExp = state.experiments[exp.id];
          await propagator.propagateExperimentUpdate(oldExp as any, exp);
        }

        // Process deleted experiments
        for (const expId of changeSet.deleted) {
          // Remove experiment page and update aggregations
        }

        stats.pagesUpdated = propagator.getAffectedPages().length;

        // Update sync state
        const state = await stateManager.loadState();
        state.lastSyncTimestamp = new Date().toISOString();
        await stateManager.saveState(state);
      }
    } else {
      // Full sync
      console.log('Running full sync...');
      // ... implementation
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\nChemistry KB Sync Summary');
    console.log('─────────────────────────');
    console.log(`New experiments:     ${stats.new}`);
    console.log(`Updated experiments: ${stats.updated}`);
    console.log(`Deleted experiments: ${stats.deleted}`);
    console.log(`Pages updated:       ${stats.pagesUpdated}`);
    console.log(`Duration:            ${duration}s`);
    console.log(`Status:              ✓ Success`);

    process.exit(0);
  } catch (err) {
    console.error('\nSync failed:', err);
    process.exit(2);
  }
}

main();
```

---

### Webhook Endpoint

**File: `src/app/api/sync/chemeln/trigger/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  // Verify webhook token
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CHEMELN_SYNC_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const experimentId = body.experiment_id;

  console.log(`Webhook triggered for experiment: ${experimentId || 'all'}`);

  // Trigger sync asynchronously (don't block response)
  const syncCommand = experimentId
    ? `npx tsx scripts/sync-chemeln.ts --experiment ${experimentId}`
    : `npx tsx scripts/sync-chemeln.ts --incremental`;

  execAsync(syncCommand).catch((err) => {
    console.error('Sync failed:', err);
  });

  return NextResponse.json({
    status: 'success',
    message: 'Incremental sync started',
  });
}
```

---

### Logging Utility

**File: `scripts/sync-chemeln/logger.ts`**

```typescript
import fs from 'fs/promises';
import path from 'path';

export class SyncLogger {
  private logFilePath: string;

  constructor(projectRoot: string) {
    this.logFilePath = path.join(projectRoot, 'logs', 'sync-chemeln.log');
  }

  async log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Append to log file
    await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
    await fs.appendFile(this.logFilePath, logLine, 'utf-8');

    // Also log to console if verbose
    if (process.env.VERBOSE === 'true' || level === 'error') {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }
}
```

---

## Test Scenarios

### CLI Test: `tests/sync-chemeln/cli.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Sync CLI', () => {
  it('should show help message', async () => {
    const { stdout } = await execAsync('npx tsx scripts/sync-chemeln.ts --help');
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('--incremental');
    expect(stdout).toContain('--dry-run');
  });

  it('should exit with code 2 if env vars missing', async () => {
    try {
      await execAsync('npx tsx scripts/sync-chemeln.ts', {
        env: { ...process.env, CHEMELN_ROOT_URL: '', CHEMELN_API_KEY: '' },
      });
    } catch (err: any) {
      expect(err.code).toBe(2);
    }
  });

  it('should run dry-run without writing files', async () => {
    const { stdout } = await execAsync('npx tsx scripts/sync-chemeln.ts --dry-run');
    expect(stdout).toContain('DRY RUN');
    expect(stdout).toContain('Success');
  });
});
```

---

## Dependencies

- **SKB-47.4:** Aggregation Page Refresh (sync CLI orchestrates all sync steps)

---

## Dev Notes

### Cron vs. Webhook

- **Cron:** Reliable fallback if webhooks fail, but up to 15-minute latency
- **Webhook:** Near-real-time (<1 minute latency), but requires ChemELN integration
- **Recommendation:** Use both — webhook for speed, cron for reliability

### Logging Best Practices

- Log all sync operations (new/updated/deleted experiments)
- Log all page writes (which pages, why they were updated)
- Log errors with full stack traces
- Rotate log files (keep last 7 days, compress old logs)

---

**Last Updated:** 2026-03-21
