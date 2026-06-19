# SKB Implementation Guide
## Anleitung zur Wiederherstellung der Features

Dieses Dokument beschreibt alle Änderungen, die im Backup-Branch `backup/symbio-bugfixes-2026-02-24` implementiert wurden. Arbeite diese Schritte der Reihe nach ab und teste nach jedem Schritt.

---

## Phase 1: Kritische Bugfixes

Diese Bugs müssen ZUERST behoben werden, da sie die Grundfunktionalität blockieren.

### 1.1 Search API 500 Error

**Problem:** Die Search-Query referenziert `p.deleted_at`, aber die `pages` Tabelle hat keine `deleted_at` Spalte (nur `blocks` hat sie).

**Datei:** `src/lib/search/query.ts`

**Lösung:** Entferne alle Referenzen zu `p.deleted_at` in WHERE-Klauseln. Behalte `b.deleted_at IS NULL` für Blocks.

**Beispiel für korrekte WHERE-Bedingungen:**
```typescript
const whereConditions: string[] = [
  `b.search_vector @@ plainto_tsquery('english', $1)`,
  `b.tenant_id = $2`,
  `b.deleted_at IS NULL`,  // ✅ blocks hat deleted_at
  // NICHT: `p.deleted_at IS NULL` - pages hat KEINE deleted_at Spalte!
];
```

**Test:** Suche im QuickSwitcher (Cmd+K) sollte keine 500 Errors mehr werfen.

---

### 1.2 Duplicate Link Extension Error

**Problem:** Die Link Extension wird doppelt registriert - einmal in StarterKit (default) und einmal explizit.

**Datei:** `src/lib/editor/editorConfig.ts`

**Lösung:** Deaktiviere Link in StarterKit und konfiguriere sie separat:

```typescript
StarterKit.configure({
  heading: {
    levels: [1, 2, 3],
  },
  bulletList: {
    keepMarks: true,
    keepAttributes: false,
  },
  orderedList: {
    keepMarks: true,
    keepAttributes: false,
  },
  undoRedo: {
    depth: 100,
  },
  // Disable built-in code block — we use CodeBlockLowlight instead
  codeBlock: false,
  // Disable built-in link — we configure our own Link extension below
  link: false,  // <-- WICHTIG: Diese Zeile hinzufügen!
}),
```

**Test:** Editor sollte ohne Console Errors laden.

---

### 1.3 Wikilink Autocomplete Bug

**Problem:** Wenn man `[[` tippt und dann einen Suchbegriff eingibt, wird `]]` im Query mit erfasst, was die Suche kaputt macht.

**Datei:** `src/components/editor/extensions/wikilinkSuggestionPlugin.ts`

**Lösung:** Erstelle eine custom `findSuggestionMatch` Funktion:

```typescript
/**
 * Custom function to find wikilink suggestion match.
 * Handles the [[ trigger and ensures the query doesn't include ]] closing brackets.
 */
function findWikilinkSuggestionMatch(config: Trigger): SuggestionMatch {
  const { char, $position } = config;
  const textBefore = $position.parent.textContent.slice(0, $position.parentOffset);

  // Find the last occurrence of [[
  const triggerIndex = textBefore.lastIndexOf(char);
  if (triggerIndex === -1) {
    return null;
  }

  // Get the text after [[
  let query = textBefore.slice(triggerIndex + char.length);

  // If query contains ]], don't show suggestion (wikilink is closed)
  if (query.includes("]]")) {
    return null;
  }

  // Strip pipe and everything after (for display text syntax)
  const pipeIndex = query.indexOf("|");
  if (pipeIndex > -1) {
    query = query.slice(0, pipeIndex);
  }

  // Calculate the range
  const from = $position.pos - $position.parentOffset + triggerIndex;
  const to = $position.pos;

  return {
    range: { from, to },
    query: query.trim(),
    text: textBefore.slice(triggerIndex),
  };
}
```

Verwende diese Funktion dann in `createWikilinkSuggestion()`:

```typescript
export function createWikilinkSuggestion(): Omit<SuggestionOptions, "editor"> {
  return {
    char: "[[",
    allowSpaces: true,
    findSuggestionMatch: findWikilinkSuggestionMatch,  // <-- Custom function
    // ... rest
  };
}
```

**Test:** Tippe `[[Test` - Autocomplete sollte erscheinen. Tippe `[[Test]]` - Autocomplete sollte verschwinden.

---

### 1.4 Invalid UUID Seed Data

**Problem:** Zod UUID-Validierung schlägt fehl bei UUIDs im Format `00000000-0000-0000-0000-*`. UUID v4 erfordert bestimmte Bits.

**Dateien:** 
- `prisma/seed.ts`
- `prisma/seed-demo.ts`

**Lösung:** Ändere alle Seed-UUIDs von:
```
00000000-0000-0000-0000-000000000001
```
zu:
```
00000000-0000-4000-a000-000000000001
```

Das `4` an Position 13 und `a` an Position 17 sind für UUID v4 Compliance erforderlich.

**Beispiel seed.ts:**
```typescript
const tenant = await prisma.tenant.upsert({
  where: { id: "00000000-0000-4000-a000-000000000001" },
  update: {},
  create: {
    id: "00000000-0000-4000-a000-000000000001",
    name: "Default Workspace",
  },
});

const adminId = "00000000-0000-4000-a000-000000000002";
// ... weitere UUIDs analog ändern
```

**Alle UUIDs die geändert werden müssen:**
- Tenant ID: `00000000-0000-4000-a000-000000000001`
- Admin User ID: `00000000-0000-4000-a000-000000000002`
- Welcome Page ID: `00000000-0000-4000-a000-000000000010`
- Block IDs: `00000000-0000-4000-a000-000000000100`, `00000000-0000-4000-a000-000000000101`, etc.

**Test:** `npx prisma db seed` sollte ohne Validierungsfehler durchlaufen.

---

### 1.5 Page Loading UUID Validation

**Problem:** Wenn eine ungültige Page ID in der URL steht, crashed die App statt einen Fehler zu zeigen.

**Datei:** `src/hooks/usePages.ts`

**Lösung:** Validiere die ID vor dem API Call und disable die Query bei ungültiger ID:

```typescript
import { z } from "zod";

const pageIdSchema = z.string().uuid();

// In fetchPage function:
async function fetchPage(id: string): Promise<SinglePageResponse> {
  const parsedId = pageIdSchema.safeParse(id);
  if (!parsedId.success) {
    throw new Error("Invalid page ID");
  }

  const response = await fetch(`/api/pages/${parsedId.data}`);
  // ...
}

// In usePage hook:
export function usePage(id: string, options?: Partial<UseQueryOptions<SinglePageResponse>>) {
  const hasValidPageId = pageIdSchema.safeParse(id).success;

  return useQuery({
    queryKey: pageKeys.detail(id),
    queryFn: () => fetchPage(id),
    enabled: hasValidPageId,  // <-- Query nur ausführen wenn ID gültig
    ...options,
  });
}
```

**Test:** Navigiere zu `/pages/invalid-id` - sollte graceful handeln, nicht crashen.

---

### 1.6 API Route Param Handling (Next.js 16)

**Problem:** Next.js 16 Route Params können Promise oder Object sein. Der alte Code assumed immer Object.

**Datei:** `src/app/api/pages/[id]/route.ts`

**Lösung:** Resolve params defensiv:

```typescript
export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext, { params }) => {
    try {
      // Defensive param parsing - works for both Promise and Object
      const resolvedParams = await Promise.resolve(params);
      const idRaw = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
      const idParsed = pageIdSchema.safeParse(idRaw);
      
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid page ID", undefined, 400);
      }
      // ... rest of handler
    }
  }
);
```

Wende das gleiche Pattern auf PUT und DELETE Handler an.

**Test:** Page API sollte sowohl in Dev als auch Prod funktionieren.

---

### 1.7 Tenant Context Auth Fix

**Problem:** Der tenantContext checkte auf Bearer Header auch wenn es kein Bearer Token war.

**Datei:** `src/lib/tenantContext.ts`

**Lösung:** Prüfe explizit ob es ein Bearer Header ist:

```typescript
export async function getTenantContext(request: NextRequest): Promise<TenantContext> {
  const authHeader = request.headers.get("authorization");
  const hasBearerAuthHeader = Boolean(authHeader?.match(/^Bearer\s+/i));

  // Only try API key resolution if it's actually a Bearer header
  if (hasBearerAuthHeader && authHeader) {
    const apiKeyContext = await resolveApiKey(authHeader);
    if (apiKeyContext) {
      return apiKeyContext;
    }
    // If Authorization header is present but invalid, reject immediately
    throw new AuthenticationError("Invalid or revoked API key", 401, "UNAUTHORIZED");
  }

  // Try NextAuth JWT token from cookies
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  // ...
}
```

---

## Phase 2: Prisma Schema Erweiterungen

Nach den Bugfixes, erweitere das Prisma Schema für die neuen Features.

### 2.1 Neue Enums hinzufügen

In `prisma/schema.prisma`, füge diese Enums hinzu (nach den existierenden):

```prisma
enum FileStatus {
  UPLOADING
  PROCESSING
  READY
  FAILED
}

enum SpaceType {
  PRIVATE
  TEAM
  AGENT
}

enum ChangeType {
  MANUAL
  AUTO_SYNC
  PROPAGATED
  MACHINE_UPDATE
  AI_SUGGESTED
}

enum SourceType {
  URL
  PAGE
  MACHINE_PROTOCOL
}

enum SubscriptionBehavior {
  MIRROR
  NOTIFY
  SUGGEST
}
```

### 2.2 BlockType erweitern

```prisma
enum BlockType {
  // ... existierende types ...
  FILE  // <-- Neu hinzufügen
}
```

### 2.3 Tenant Model erweitern

```prisma
model Tenant {
  id              String   @id @default(uuid())
  name            String
  storageQuota    BigInt   @default(5368709120) @map("storage_quota")    // 5GB default
  storageUsed     BigInt   @default(0) @map("storage_used")
  createdAt       DateTime @default(now()) @map("created_at")

  // Neue Relations hinzufügen:
  auditLogs              AuditLog[]
  documentVersions       DocumentVersion[]
  documentSubscriptions  DocumentSubscription[]
  fileAttachments        FileAttachment[]
  // ... existierende relations behalten
}
```

### 2.4 User Model erweitern

```prisma
model User {
  // ... existierende fields ...
  avatarUrl    String?  @map("avatar_url")  // <-- Neu

  // Neue Relations:
  auditLogs        AuditLog[]
  fileAttachments  FileAttachment[]
  // ... existierende relations behalten
}
```

### 2.5 Page Model erweitern

```prisma
model Page {
  // ... existierende fields ...
  spaceType    SpaceType @default(PRIVATE) @map("space_type")  // <-- Neu

  // Neue Relations:
  documentVersions      DocumentVersion[]
  documentSubscriptions DocumentSubscription[]
  fileAttachments       FileAttachment[]

  // Neuer Index:
  @@index([tenantId, spaceType], map: "idx_pages_tenant_id_space_type")
}
```

### 2.6 Neue Models hinzufügen

#### DocumentVersion Model:
```prisma
model DocumentVersion {
  id           String     @id @default(uuid())
  pageId       String     @map("page_id")
  tenantId     String     @map("tenant_id")
  version      Int
  content      Json
  plainText    String     @map("plain_text")
  changeType   ChangeType @map("change_type")
  changeSource String?    @map("change_source")
  changeNotes  String?    @map("change_notes")
  diffFromPrev Json?      @map("diff_from_prev")
  createdAt    DateTime   @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  page   Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([pageId, version])
  @@index([pageId])
  @@index([tenantId, pageId])
  @@map("document_versions")
}
```

#### DocumentSubscription Model:
```prisma
model DocumentSubscription {
  id               String               @id @default(uuid())
  tenantId         String               @map("tenant_id")
  subscriberPageId String               @map("subscriber_page_id")
  sourceType       SourceType           @map("source_type")
  sourcePageId     String?              @map("source_page_id")
  sourceUrl        String?              @map("source_url")
  behavior         SubscriptionBehavior @default(NOTIFY)
  lastSyncedAt     DateTime?            @map("last_synced_at")
  lastSyncVersion  Int?                 @map("last_sync_version")
  isActive         Boolean              @default(true) @map("is_active")
  createdAt        DateTime             @default(now()) @map("created_at")
  updatedAt        DateTime             @updatedAt @map("updated_at")

  tenant         Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  subscriberPage Page   @relation(fields: [subscriberPageId], references: [id], onDelete: Cascade)

  @@index([tenantId, subscriberPageId])
  @@index([sourcePageId])
  @@map("document_subscriptions")
}
```

#### FileAttachment Model:
```prisma
model FileAttachment {
  id          String     @id @default(uuid())
  tenantId    String     @map("tenant_id")
  userId      String     @map("user_id")
  pageId      String?    @map("page_id")
  fileName    String     @map("file_name")
  fileSize    BigInt     @map("file_size")
  mimeType    String     @map("mime_type")
  storagePath String     @map("storage_path")
  storageUrl  String?    @map("storage_url")
  status      FileStatus @default(UPLOADING)
  checksum    String?
  metadata    Json?
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  page   Page?  @relation(fields: [pageId], references: [id], onDelete: SetNull)

  @@index([tenantId, pageId])
  @@index([tenantId, userId])
  @@map("file_attachments")
}
```

#### AuditLog Model:
```prisma
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  userId     String   @map("user_id")
  apiKeyId   String?  @map("api_key_id")
  action     String
  resource   String
  resourceId String?  @map("resource_id")
  details    Json?
  createdAt  DateTime @default(now()) @map("created_at")

  tenant Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  apiKey ApiKey? @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt], map: "idx_audit_logs_tenant_created")
  @@index([userId], map: "idx_audit_logs_user_id")
  @@index([resource, resourceId], map: "idx_audit_logs_resource")
  @@map("audit_logs")
}
```

### 2.7 ApiKey Model erweitern

```prisma
model ApiKey {
  // ... existierende fields ...
  scopes     String[]  @default([])  // <-- Neu
  
  // Neue Relation:
  auditLogs AuditLog[]
}
```

### 2.8 Migration erstellen

Nach allen Schema-Änderungen:
```bash
npx prisma migrate dev --name add_living_docs_and_files
npx prisma generate
```

---

## Phase 3: Living Documentation Library

Erstelle die Library-Funktionen für das Versioning-System.

### 3.1 Diff-Utilities

**Datei erstellen:** `src/lib/livingDocs/diff.ts`

```typescript
export interface TextDiff {
  additions: number;
  deletions: number;
  changes: Array<{
    type: "add" | "remove" | "equal";
    value: string;
  }>;
}

/**
 * Compute a simple word-level diff between two texts.
 */
export function computeTextDiff(oldText: string, newText: string): TextDiff {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);

  // Simple LCS-based diff
  const changes: TextDiff["changes"] = [];
  let additions = 0;
  let deletions = 0;

  // Use a basic diff algorithm (for production, consider using 'diff' package)
  let i = 0, j = 0;
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      changes.push({ type: "add", value: newWords[j] });
      additions++;
      j++;
    } else if (j >= newWords.length) {
      changes.push({ type: "remove", value: oldWords[i] });
      deletions++;
      i++;
    } else if (oldWords[i] === newWords[j]) {
      changes.push({ type: "equal", value: oldWords[i] });
      i++;
      j++;
    } else {
      // Simple heuristic: remove old, add new
      changes.push({ type: "remove", value: oldWords[i] });
      deletions++;
      i++;
      changes.push({ type: "add", value: newWords[j] });
      additions++;
      j++;
    }
  }

  return { additions, deletions, changes };
}
```

### 3.2 Versioning Functions

**Datei erstellen:** `src/lib/livingDocs/versioning.ts`

```typescript
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { computeTextDiff } from "./diff";

interface CreateVersionOptions {
  pageId: string;
  tenantId: string;
  content: Prisma.InputJsonValue;
  plainText: string;
  changeType: "MANUAL" | "AUTO_SYNC" | "PROPAGATED" | "MACHINE_UPDATE" | "AI_SUGGESTED";
  changeSource?: string;
  changeNotes?: string;
}

export async function createDocumentVersion(options: CreateVersionOptions) {
  const { pageId, tenantId, content, plainText, changeType, changeSource, changeNotes } = options;

  const latest = await prisma.documentVersion.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true, plainText: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  let diffFromPrev: Prisma.InputJsonValue | undefined;
  if (latest) {
    const diff = computeTextDiff(latest.plainText, plainText);
    diffFromPrev = JSON.parse(JSON.stringify(diff)) as Prisma.InputJsonValue;
  }

  return prisma.documentVersion.create({
    data: {
      pageId,
      tenantId,
      version: nextVersion,
      content,
      plainText,
      changeType,
      changeSource: changeSource ?? null,
      changeNotes: changeNotes ?? null,
      diffFromPrev: diffFromPrev ?? undefined,
    },
  });
}

export async function listDocumentVersions(
  pageId: string,
  tenantId: string,
  limit: number = 50,
  offset: number = 0
) {
  const where = { pageId, tenantId };

  const [versions, total] = await Promise.all([
    prisma.documentVersion.findMany({
      where,
      select: {
        id: true,
        version: true,
        changeType: true,
        changeSource: true,
        changeNotes: true,
        createdAt: true,
        plainText: true,
      },
      orderBy: { version: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.documentVersion.count({ where }),
  ]);

  return {
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      change_type: v.changeType,
      change_source: v.changeSource,
      change_notes: v.changeNotes,
      created_at: v.createdAt.toISOString(),
      word_count: v.plainText.split(/\s+/).filter(Boolean).length,
    })),
    total,
  };
}

export async function getDocumentVersion(
  pageId: string,
  tenantId: string,
  version: number
) {
  return prisma.documentVersion.findFirst({
    where: { pageId, tenantId, version },
  });
}

export async function restoreDocumentVersion(
  pageId: string,
  tenantId: string,
  version: number,
  userId: string
) {
  const target = await getDocumentVersion(pageId, tenantId, version);
  if (!target) return null;

  // Create new version with restored content
  return createDocumentVersion({
    pageId,
    tenantId,
    content: target.content as Prisma.InputJsonValue,
    plainText: target.plainText,
    changeType: "MANUAL",
    changeSource: userId,
    changeNotes: `Restored from version ${version}`,
  });
}

export async function compareDocumentVersions(
  pageId: string,
  tenantId: string,
  v1: number,
  v2: number
) {
  const [version1, version2] = await Promise.all([
    getDocumentVersion(pageId, tenantId, v1),
    getDocumentVersion(pageId, tenantId, v2),
  ]);

  if (!version1 || !version2) return null;

  const diff = computeTextDiff(version1.plainText, version2.plainText);

  return {
    v1: { version: v1, created_at: version1.createdAt.toISOString() },
    v2: { version: v2, created_at: version2.createdAt.toISOString() },
    diff,
  };
}
```

### 3.3 Validation Schemas

**Datei erstellen:** `src/lib/validation/livingDocs.ts`

```typescript
import { z } from "zod";

export const listHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const compareVersionsSchema = z.object({
  v1: z.coerce.number().int().min(1),
  v2: z.coerce.number().int().min(1),
});
```

### 3.4 Index Export

**Datei erstellen:** `src/lib/livingDocs/index.ts`

```typescript
export * from "./diff";
export * from "./versioning";
```

---

## Phase 4: API Routes für History

### 4.1 List History

**Datei erstellen:** `src/app/api/pages/[id]/history/route.ts`

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { listDocumentVersions } from "@/lib/livingDocs/versioning";
import { listHistoryQuerySchema } from "@/lib/validation/livingDocs";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext, { params }) => {
    try {
      const resolvedParams = await Promise.resolve(params);
      const idRaw = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
      const idParsed = pageIdSchema.safeParse(idRaw);
      
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid page ID", undefined, 400);
      }

      const page = await prisma.page.findFirst({
        where: { id: idParsed.data, tenantId: ctx.tenantId },
        select: { id: true },
      });
      
      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());
      const parsed = listHistoryQuerySchema.safeParse(queryParams);
      
      if (!parsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid query parameters", undefined, 400);
      }

      const { limit, offset } = parsed.data;
      const { versions, total } = await listDocumentVersions(
        idParsed.data,
        ctx.tenantId,
        limit,
        offset
      );

      return listResponse(versions, total, limit, offset);
    } catch (error) {
      console.error("GET /api/pages/:id/history error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
```

### 4.2 Get/Restore Specific Version

**Datei erstellen:** `src/app/api/pages/[id]/history/[version]/route.ts`

Implementiere GET (Version abrufen) und POST (Version wiederherstellen) Handler analog zur History-Route.

### 4.3 Compare Versions

**Datei erstellen:** `src/app/api/pages/[id]/history/compare/route.ts`

Implementiere GET Handler der v1 und v2 Query-Parameter akzeptiert und compareDocumentVersions aufruft.

---

## Phase 5: Page Tree mit SpaceType

### 5.1 getPageTree erweitern

**Datei:** `src/lib/pages/getPageTree.ts`

Füge eine neue Funktion hinzu:

```typescript
export async function getPageTreeBySpace(tenantId: string) {
  const pages = await prisma.page.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      icon: true,
      parentId: true,
      position: true,
      spaceType: true,  // Neu
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  // Group by spaceType
  const grouped = {
    private: pages.filter((p) => p.spaceType === "PRIVATE"),
    team: pages.filter((p) => p.spaceType === "TEAM"),
    agent: pages.filter((p) => p.spaceType === "AGENT"),
  };

  // Build tree for each group
  return {
    private: buildTree(grouped.private),
    team: buildTree(grouped.team),
    agent: buildTree(grouped.agent),
  };
}
```

### 5.2 Tree Route anpassen

**Datei:** `src/app/api/pages/tree/route.ts`

```typescript
import { getPageTreeBySpace } from "@/lib/pages/getPageTree";

export const GET = withTenant(
  async (_req: NextRequest, context: TenantContext) => {
    const tree = await getPageTreeBySpace(context.tenantId);
    return successResponse(tree);
  }
);
```

---

## Phase 6: SpaceType Cascade bei Page Update

**Datei:** `src/app/api/pages/[id]/route.ts`

Im PUT Handler, wenn spaceType geändert wird, kaskadiere zu allen Kindern:

```typescript
// If spaceType changed, cascade to all descendants
if (spaceType !== undefined && spaceType !== existingPage.spaceType) {
  const updateDescendants = async (parentId: string) => {
    const children = await tx.page.findMany({
      where: { parentId, tenantId: context.tenantId },
      select: { id: true },
    });
    
    for (const child of children) {
      await tx.page.update({
        where: { id: child.id },
        data: { spaceType },
      });
      await updateDescendants(child.id);
    }
  };
  
  await updateDescendants(idParsed.data);
}
```

---

## Checkliste

Nach jedem Schritt testen!

- [ ] Phase 1.1: Search API - keine 500 Errors
- [ ] Phase 1.2: Editor lädt ohne Errors
- [ ] Phase 1.3: Wikilink Autocomplete funktioniert
- [ ] Phase 1.4: Seeds laufen durch
- [ ] Phase 1.5: Invalid Page IDs werden abgefangen
- [ ] Phase 1.6: API Routes funktionieren in Prod
- [ ] Phase 1.7: Auth funktioniert für Session und API Keys
- [ ] Phase 2: Schema Migration erfolgreich
- [ ] Phase 3: Living Docs Library erstellt
- [ ] Phase 4: History API funktioniert
- [ ] Phase 5: Tree nach SpaceType gruppiert
- [ ] Phase 6: SpaceType Cascade funktioniert

---

## Referenz: Relevante Stories

Die Stories im `stories/` Ordner enthalten weitere Details zu den Features:
- `1.1` bis `1.6` — File Attachments
- `5.1` bis `5.6` — Living Documentation

Diese kannst du für weitere Implementierungsdetails konsultieren.
