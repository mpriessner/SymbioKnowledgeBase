import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { databaseToMarkdown } from "./DatabaseSerializer";
import type { DatabaseSerializeInput, DatabaseRowInput } from "./DatabaseSerializer";
import { markdownToDatabase } from "./DatabaseDeserializer";
import type { ParsedRow } from "./DatabaseDeserializer";
import { MIRROR_ROOT, META_FILENAME, DATABASES_DIR, DB_DEBOUNCE_MS } from "./config";
import { syncLock } from "./SyncLock";
import { fileSlug } from "./slug";
import { debouncedWriteIndex } from "./IndexGenerator";
import { migrateMetadata } from "./types";
import type { SyncMetadata } from "./types";
import type { DatabaseSchema, PropertyValue, Column } from "@/types/database";
import { validateProperties } from "@/lib/database/propertyValidators";

/**
 * Write a file atomically: write to a temp file, then rename.
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = filePath + ".tmp." + process.pid;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

/**
 * Compute MD5 hash of a string.
 */
function md5(content: string): string {
  return crypto.createHash("md5").update(content, "utf-8").digest("hex");
}

/**
 * Load or create sync metadata for a tenant.
 */
async function loadMetadata(tenantId: string): Promise<SyncMetadata> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  try {
    const existing = await fs.readFile(metaPath, "utf-8");
    return migrateMetadata(JSON.parse(existing) as SyncMetadata);
  } catch {
    return {
      version: 2,
      tenantId,
      lastFullSync: new Date().toISOString(),
      pages: {},
      databases: {},
    };
  }
}

/**
 * Save sync metadata for a tenant.
 */
async function saveMetadata(tenantId: string, meta: SyncMetadata): Promise<void> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  await atomicWrite(metaPath, JSON.stringify(meta, null, 2));
}

/**
 * Resolve a unique filename for a database within the Databases/ directory.
 * Handles duplicate titles by appending numeric suffix.
 */
function resolveFilename(
  title: string,
  databaseId: string,
  meta: SyncMetadata
): string {
  const slug = fileSlug(title);
  const baseName = `${slug}.md`;
  const basePath = path.join(DATABASES_DIR, baseName);

  // Check if another database already uses this path
  const conflict = Object.entries(meta.databases).find(
    ([id, entry]) => id !== databaseId && entry.filePath === basePath
  );

  if (!conflict) return basePath;

  // Find a unique suffix
  let suffix = 2;
  while (true) {
    const candidatePath = path.join(DATABASES_DIR, `${slug}-${suffix}.md`);
    const taken = Object.entries(meta.databases).find(
      ([id, entry]) => id !== databaseId && entry.filePath === candidatePath
    );
    if (!taken) return candidatePath;
    suffix++;
  }
}

/**
 * Debounce map: databaseId → timeout handle.
 * Prevents rapid re-syncs when many rows change quickly.
 */
const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Sync a single database to the filesystem.
 * Fetches the database + all rows, serializes to markdown,
 * and writes to Databases/{title}.md.
 */
export async function syncDatabaseToFilesystem(
  tenantId: string,
  databaseId: string
): Promise<void> {
  // Debounce: cancel any pending sync for this database
  const existing = debounceTimers.get(databaseId);
  if (existing) {
    clearTimeout(existing);
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(async () => {
      debounceTimers.delete(databaseId);
      try {
        await _syncDatabaseToFilesystemImpl(tenantId, databaseId);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, DB_DEBOUNCE_MS);

    debounceTimers.set(databaseId, timer);
  });
}

async function _syncDatabaseToFilesystemImpl(
  tenantId: string,
  databaseId: string
): Promise<void> {
  const database = await prisma.database.findFirst({
    where: { id: databaseId, tenantId },
    include: {
      page: { select: { title: true, icon: true } },
      rows: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!database) return;

  const schema = database.schema as unknown as DatabaseSchema;

  const serializeInput: DatabaseSerializeInput = {
    id: database.id,
    title: database.page.title,
    icon: database.page.icon,
    pageId: database.pageId,
    defaultView: database.defaultView,
    columns: schema.columns,
    createdAt: database.createdAt,
    updatedAt: database.updatedAt,
  };

  const rows: DatabaseRowInput[] = database.rows.map((row) => ({
    id: row.id,
    properties: row.properties as Record<string, PropertyValue>,
    createdAt: row.createdAt,
  }));

  const markdown = databaseToMarkdown(serializeInput, rows);

  const meta = await loadMetadata(tenantId);

  // Resolve file path (handles renames and duplicates)
  const oldEntry = meta.databases[databaseId];
  const newFilePath = resolveFilename(database.page.title, databaseId, meta);
  const absPath = path.join(MIRROR_ROOT, tenantId, newFilePath);

  // If the file path changed (rename), delete the old file
  if (oldEntry && oldEntry.filePath !== newFilePath) {
    const oldAbsPath = path.join(MIRROR_ROOT, tenantId, oldEntry.filePath);
    syncLock.acquire(oldAbsPath);
    try {
      await fs.unlink(oldAbsPath).catch(() => {});
    } finally {
      setTimeout(() => syncLock.release(oldAbsPath), 1000);
    }
  }

  syncLock.acquire(absPath);

  try {
    await atomicWrite(absPath, markdown);

    meta.databases[databaseId] = {
      id: databaseId,
      filePath: newFilePath,
      contentHash: md5(markdown),
      lastSynced: new Date().toISOString(),
      rowCount: rows.length,
    };

    await saveMetadata(tenantId, meta);
  } finally {
    setTimeout(() => syncLock.release(absPath), 1000);
  }

  debouncedWriteIndex(tenantId);
}

/**
 * Remove a database's .md file from the filesystem.
 */
export async function deleteDatabaseFile(
  tenantId: string,
  databaseId: string
): Promise<void> {
  const meta = await loadMetadata(tenantId);

  const entry = meta.databases[databaseId];
  if (!entry) return;

  const absPath = path.join(MIRROR_ROOT, tenantId, entry.filePath);

  syncLock.acquire(absPath);
  try {
    await fs.unlink(absPath).catch(() => {});
    delete meta.databases[databaseId];
    await saveMetadata(tenantId, meta);
  } finally {
    setTimeout(() => syncLock.release(absPath), 1000);
  }

  debouncedWriteIndex(tenantId);
}

/**
 * Sync ALL databases for a tenant (used in fullSync).
 * Returns the number of databases synced.
 */
export async function fullDatabaseSync(tenantId: string): Promise<number> {
  const databases = await prisma.database.findMany({
    where: { tenantId },
    include: {
      page: { select: { title: true, icon: true } },
      rows: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (databases.length === 0) return 0;

  const meta = await loadMetadata(tenantId);
  let syncCount = 0;

  for (const database of databases) {
    const schema = database.schema as unknown as DatabaseSchema;

    const serializeInput: DatabaseSerializeInput = {
      id: database.id,
      title: database.page.title,
      icon: database.page.icon,
      pageId: database.pageId,
      defaultView: database.defaultView,
      columns: schema.columns,
      createdAt: database.createdAt,
      updatedAt: database.updatedAt,
    };

    const rows: DatabaseRowInput[] = database.rows.map((row) => ({
      id: row.id,
      properties: row.properties as Record<string, PropertyValue>,
      createdAt: row.createdAt,
    }));

    const markdown = databaseToMarkdown(serializeInput, rows);

    const oldEntry = meta.databases[database.id];
    const newFilePath = resolveFilename(database.page.title, database.id, meta);
    const absPath = path.join(MIRROR_ROOT, tenantId, newFilePath);

    // If the file path changed (rename), delete the old file
    if (oldEntry && oldEntry.filePath !== newFilePath) {
      const oldAbsPath = path.join(MIRROR_ROOT, tenantId, oldEntry.filePath);
      syncLock.acquire(oldAbsPath);
      try {
        await fs.unlink(oldAbsPath).catch(() => {});
      } finally {
        setTimeout(() => syncLock.release(oldAbsPath), 1000);
      }
    }

    syncLock.acquire(absPath);

    try {
      await atomicWrite(absPath, markdown);

      meta.databases[database.id] = {
        id: database.id,
        filePath: newFilePath,
        contentHash: md5(markdown),
        lastSynced: new Date().toISOString(),
        rowCount: rows.length,
      };

      syncCount++;
    } finally {
      setTimeout(() => syncLock.release(absPath), 1000);
    }
  }

  // Remove metadata entries for databases that no longer exist
  const activeIds = new Set(databases.map((d) => d.id));
  for (const id of Object.keys(meta.databases)) {
    if (!activeIds.has(id)) {
      const staleEntry = meta.databases[id];
      const staleAbsPath = path.join(MIRROR_ROOT, tenantId, staleEntry.filePath);
      await fs.unlink(staleAbsPath).catch(() => {});
      delete meta.databases[id];
    }
  }

  await saveMetadata(tenantId, meta);

  return syncCount;
}

// ─── FS→DB Sync Handlers ──────────────────────────────────────────────

/**
 * Resolve tenant ID from a file path.
 * File paths are: MIRROR_ROOT/tenantId/...
 */
function resolveTenantId(filePath: string): string | null {
  const relative = path.relative(MIRROR_ROOT, filePath);
  const parts = relative.split(path.sep);
  return parts.length >= 2 ? parts[0] : null;
}

/**
 * Get the TITLE column value from a row's properties, given the schema columns.
 */
function getTitleValue(
  properties: Record<string, PropertyValue>,
  columns: Column[]
): string | null {
  const titleCol = columns.find((c) => c.type === "TITLE");
  if (!titleCol) return null;
  const prop = properties[titleCol.id];
  if (!prop || prop.type !== "TITLE") return null;
  return prop.value || null;
}

/**
 * Check if two property values are deeply equal.
 */
function propertiesEqual(
  a: Record<string, PropertyValue>,
  b: Record<string, PropertyValue>
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Handle an existing database .md file being modified.
 * Diffs the file against the DB state and applies changes in a transaction.
 */
export async function handleDatabaseFileChange(filePath: string): Promise<void> {
  if (syncLock.isLocked(filePath)) {
    return;
  }

  const tenantId = resolveTenantId(filePath);
  if (!tenantId) return;

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    console.warn(`[DatabaseSync] Could not read file: ${filePath}`);
    return;
  }

  const parsed = markdownToDatabase(content);

  // Log parse errors but continue with valid rows
  for (const err of parsed.errors) {
    if (err.type === "error") {
      console.error(
        `[DatabaseSync] Parse error in ${filePath}: ${err.message}`
      );
    } else {
      console.warn(
        `[DatabaseSync] Parse warning in ${filePath}: ${err.message}`
      );
    }
  }

  const databaseId = parsed.metadata.id;
  if (!databaseId) {
    console.warn(
      `[DatabaseSync] Changed file has no database ID in frontmatter: ${filePath}`
    );
    return;
  }

  // Fatal parse errors (no columns, invalid YAML) — bail out
  if (parsed.columns.length === 0) {
    console.error(
      `[DatabaseSync] Skipping sync — no valid columns parsed from ${filePath}`
    );
    return;
  }

  const database = await prisma.database.findFirst({
    where: { id: databaseId, tenantId },
    include: {
      page: { select: { title: true, icon: true } },
      rows: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!database) {
    console.warn(
      `[DatabaseSync] Database ${databaseId} not found in DB for tenant ${tenantId}`
    );
    return;
  }

  const existingSchema = database.schema as unknown as DatabaseSchema;
  const existingRows = database.rows;

  // Build a map of existing rows by TITLE value for matching
  const existingByTitle = new Map<string, typeof existingRows>();
  for (const row of existingRows) {
    const props = row.properties as Record<string, PropertyValue>;
    const title = getTitleValue(props, existingSchema.columns);
    if (title) {
      const arr = existingByTitle.get(title) ?? [];
      arr.push(row);
      existingByTitle.set(title, arr);
    }
  }

  // Match parsed rows to existing DB rows
  const matched = new Map<string, ParsedRow>(); // dbRowId → parsedRow
  const unmatchedParsed: ParsedRow[] = [];
  const matchedDbIds = new Set<string>();

  for (const parsedRow of parsed.rows) {
    const title = getTitleValue(parsedRow.properties, parsed.columns);

    let matchedRow: (typeof existingRows)[number] | null = null;

    if (title) {
      const candidates = existingByTitle.get(title);
      if (candidates && candidates.length === 1) {
        matchedRow = candidates[0];
      } else if (candidates && candidates.length > 1) {
        // Duplicate titles — fall back to position matching
        const byPosition = existingRows[parsedRow.rowIndex];
        if (byPosition && !matchedDbIds.has(byPosition.id)) {
          matchedRow = byPosition;
        }
      }
    }

    // If no title match, try position fallback
    if (!matchedRow) {
      const byPosition = existingRows[parsedRow.rowIndex];
      if (byPosition && !matchedDbIds.has(byPosition.id)) {
        matchedRow = byPosition;
      }
    }

    if (matchedRow && !matchedDbIds.has(matchedRow.id)) {
      matched.set(matchedRow.id, parsedRow);
      matchedDbIds.add(matchedRow.id);
    } else {
      unmatchedParsed.push(parsedRow);
    }
  }

  // Rows in DB but not matched → to be deleted
  const toDelete = existingRows.filter((r) => !matchedDbIds.has(r.id));

  // Detect schema changes
  const schemaChanged =
    JSON.stringify({ columns: parsed.columns }) !==
    JSON.stringify({ columns: existingSchema.columns });

  // Suppress DB→FS echo
  syncLock.acquire(filePath);

  try {
    await prisma.$transaction(async (tx) => {
      // Update schema if changed
      if (schemaChanged) {
        await tx.database.update({
          where: { id: databaseId },
          data: {
            schema: JSON.parse(JSON.stringify({ columns: parsed.columns })),
          },
        });
      }

      // Update page metadata if changed
      const updates: Record<string, unknown> = {};
      if (parsed.metadata.title && parsed.metadata.title !== database.page.title) {
        updates.title = parsed.metadata.title;
      }
      if (parsed.metadata.icon !== undefined && parsed.metadata.icon !== database.page.icon) {
        updates.icon = parsed.metadata.icon;
      }
      if (Object.keys(updates).length > 0) {
        await tx.page.update({
          where: { id: database.pageId },
          data: updates,
        });
      }

      // Update matched rows if properties changed
      for (const [dbRowId, parsedRow] of matched) {
        const existingRow = existingRows.find((r) => r.id === dbRowId)!;
        const existingProps = existingRow.properties as Record<string, PropertyValue>;

        if (!propertiesEqual(existingProps, parsedRow.properties)) {
          // Validate before writing
          const validation = validateProperties(parsedRow.properties, parsed.columns);
          if (!validation.valid) {
            console.warn(
              `[DatabaseSync] Skipping row update (invalid properties): ${validation.errors.join(", ")}`
            );
            continue;
          }

          await tx.dbRow.update({
            where: { id: dbRowId },
            data: {
              properties: JSON.parse(JSON.stringify(parsedRow.properties)),
            },
          });
        }
      }

      // Create new rows
      for (const parsedRow of unmatchedParsed) {
        const validation = validateProperties(parsedRow.properties, parsed.columns);
        if (!validation.valid) {
          console.warn(
            `[DatabaseSync] Skipping new row (invalid properties): ${validation.errors.join(", ")}`
          );
          continue;
        }

        const title = getTitleValue(parsedRow.properties, parsed.columns) ?? "Untitled";

        // Auto-create linked page
        const linkedPage = await tx.page.create({
          data: {
            tenantId,
            title,
            parentId: database.pageId,
            position: 0,
          },
        });

        await tx.dbRow.create({
          data: {
            databaseId,
            tenantId,
            pageId: linkedPage.id,
            properties: JSON.parse(JSON.stringify(parsedRow.properties)),
          },
        });
      }

      // Delete removed rows
      for (const row of toDelete) {
        await tx.dbRow.delete({ where: { id: row.id } });
      }
    });

    // Update metadata
    const meta = await loadMetadata(tenantId);
    const contentHash = md5(content);
    const relative = path.relative(path.join(MIRROR_ROOT, tenantId), filePath);

    meta.databases[databaseId] = {
      id: databaseId,
      filePath: relative,
      contentHash,
      lastSynced: new Date().toISOString(),
      rowCount: parsed.rows.length,
    };

    await saveMetadata(tenantId, meta);

    console.log(
      `[DatabaseSync] Updated database ${databaseId} from ${filePath} (${matched.size} updated, ${unmatchedParsed.length} created, ${toDelete.length} deleted)`
    );
  } finally {
    setTimeout(() => syncLock.release(filePath), 1000);
  }

  if (tenantId) {
    debouncedWriteIndex(tenantId);
  }
}

/**
 * Handle a new database .md file being created.
 * Creates Database + Page + DbRows from scratch.
 */
export async function handleDatabaseFileAdd(filePath: string): Promise<void> {
  if (syncLock.isLocked(filePath)) {
    return;
  }

  const tenantId = resolveTenantId(filePath);
  if (!tenantId) return;

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    console.warn(`[DatabaseSync] Could not read file: ${filePath}`);
    return;
  }

  const parsed = markdownToDatabase(content);

  // Log parse errors
  for (const err of parsed.errors) {
    if (err.type === "error") {
      console.error(
        `[DatabaseSync] Parse error in ${filePath}: ${err.message}`
      );
    }
  }

  // If it has an ID, check if it already exists (may be echo from DB→FS)
  if (parsed.metadata.id) {
    const existing = await prisma.database.findFirst({
      where: { id: parsed.metadata.id, tenantId },
    });
    if (existing) {
      return;
    }
  }

  // Fatal parse errors — bail out
  if (parsed.columns.length === 0) {
    console.error(
      `[DatabaseSync] Skipping creation — no valid columns parsed from ${filePath}`
    );
    return;
  }

  // Validate: must have exactly one TITLE column
  const titleCols = parsed.columns.filter((c) => c.type === "TITLE");
  if (titleCols.length !== 1) {
    console.error(
      `[DatabaseSync] Skipping creation — schema must have exactly one TITLE column in ${filePath}`
    );
    return;
  }

  const title = parsed.metadata.title || path.basename(filePath, ".md");
  const defaultView = parsed.metadata.defaultView || "table";

  syncLock.acquire(filePath);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create parent page for the database
      const dbPage = await tx.page.create({
        data: {
          tenantId,
          title,
          icon: parsed.metadata.icon || null,
          position: 0,
        },
      });

      // Create the database
      const database = await tx.database.create({
        data: {
          tenantId,
          pageId: dbPage.id,
          schema: JSON.parse(JSON.stringify({ columns: parsed.columns })),
          defaultView,
        },
      });

      // Create rows with linked pages
      const rowIds: string[] = [];
      for (const parsedRow of parsed.rows) {
        const validation = validateProperties(parsedRow.properties, parsed.columns);
        if (!validation.valid) {
          console.warn(
            `[DatabaseSync] Skipping row (invalid properties): ${validation.errors.join(", ")}`
          );
          continue;
        }

        const rowTitle =
          getTitleValue(parsedRow.properties, parsed.columns) ?? "Untitled";

        const linkedPage = await tx.page.create({
          data: {
            tenantId,
            title: rowTitle,
            parentId: dbPage.id,
            position: parsedRow.rowIndex,
          },
        });

        const dbRow = await tx.dbRow.create({
          data: {
            databaseId: database.id,
            tenantId,
            pageId: linkedPage.id,
            properties: JSON.parse(JSON.stringify(parsedRow.properties)),
          },
        });

        rowIds.push(dbRow.id);
      }

      return { database, dbPage, rowCount: rowIds.length };
    });

    // Rewrite file with generated IDs
    const dbForSerialize: DatabaseSerializeInput = {
      id: result.database.id,
      title,
      icon: parsed.metadata.icon || null,
      pageId: result.dbPage.id,
      defaultView,
      columns: parsed.columns,
      createdAt: result.database.createdAt,
      updatedAt: result.database.updatedAt,
    };

    // Re-fetch rows to get their IDs and createdAt timestamps
    const createdRows = await prisma.dbRow.findMany({
      where: { databaseId: result.database.id },
      orderBy: { createdAt: "asc" },
    });

    const rowInputs: DatabaseRowInput[] = createdRows.map((row) => ({
      id: row.id,
      properties: row.properties as Record<string, PropertyValue>,
      createdAt: row.createdAt,
    }));

    const updatedMarkdown = databaseToMarkdown(dbForSerialize, rowInputs);
    await atomicWrite(filePath, updatedMarkdown);

    // Update metadata
    const meta = await loadMetadata(tenantId);
    const relative = path.relative(path.join(MIRROR_ROOT, tenantId), filePath);

    meta.databases[result.database.id] = {
      id: result.database.id,
      filePath: relative,
      contentHash: md5(updatedMarkdown),
      lastSynced: new Date().toISOString(),
      rowCount: result.rowCount,
    };

    await saveMetadata(tenantId, meta);

    console.log(
      `[DatabaseSync] Created database ${result.database.id} from ${filePath} (${result.rowCount} rows)`
    );
  } finally {
    setTimeout(() => syncLock.release(filePath), 1000);
  }

  if (tenantId) {
    debouncedWriteIndex(tenantId);
  }
}

/**
 * Handle a database .md file being deleted.
 * Does NOT delete the database from DB (safety measure).
 * Only logs a warning and removes the metadata entry.
 */
export async function handleDatabaseFileDelete(filePath: string): Promise<void> {
  if (syncLock.isLocked(filePath)) {
    return;
  }

  const tenantId = resolveTenantId(filePath);
  if (!tenantId) return;

  console.warn(
    `[DatabaseSync] Database file removed: ${filePath}. Database preserved in DB. Use API to delete.`
  );

  // Remove entry from .skb-meta.json
  const meta = await loadMetadata(tenantId);
  const relative = path.relative(path.join(MIRROR_ROOT, tenantId), filePath);

  const entryId = Object.keys(meta.databases).find(
    (id) => meta.databases[id].filePath === relative
  );

  if (entryId) {
    delete meta.databases[entryId];
    await saveMetadata(tenantId, meta);
  }
}
