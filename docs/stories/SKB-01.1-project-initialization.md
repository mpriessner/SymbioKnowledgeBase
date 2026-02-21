# Story SKB-01.1: Initialize Next.js Project with Core Dependencies

**Epic:** Epic 1 - Project Foundation & Infrastructure
**Story ID:** SKB-01.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** Nothing (first story)

---

## User Story

As a developer, I want a fully configured Next.js 16 project with all required dependencies installed, So that I can begin building features on a consistent, well-structured foundation.

---

## Acceptance Criteria

- [ ] Next.js 16 project created with TypeScript, Tailwind 4, ESLint, App Router, `src/` directory, Turbopack, `@/*` import alias
- [ ] All production dependencies installed: `@prisma/client`, `next-auth@4`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/extension-placeholder`, `@tiptap/extension-code-block-lowlight`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tanstack/react-query`, `react-force-graph`, `zod`, `dompurify`, `bcryptjs`
- [ ] All dev dependencies installed: `prisma`, `@types/bcryptjs`, `@types/dompurify`, `playwright`, `@playwright/test`
- [ ] TypeScript strict mode enabled in `tsconfig.json`
- [ ] ESLint configured with Next.js recommended rules
- [ ] `package.json` scripts include: `dev`, `build`, `start`, `lint`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`
- [ ] Project compiles with zero errors (`npm run build` succeeds)
- [ ] Dev server starts and serves page at `localhost:3000`
- [ ] Import alias `@/*` works correctly (verified by importing from `@/lib/` in a component)

---

## Architecture Overview

```
Project Root (symbio-knowledge-base/)
│
├── src/                    ← App Router with src/ directory
│   ├── app/
│   │   ├── layout.tsx      ← Root layout (default from create-next-app)
│   │   ├── page.tsx        ← Modified: "SymbioKnowledgeBase" heading
│   │   └── globals.css     ← Tailwind CSS imports
│   └── ...
│
├── package.json            ← All dependencies + custom scripts
├── tsconfig.json           ← Strict mode + path aliases
├── next.config.ts          ← output: 'standalone' for Docker
├── .eslintrc.json          ← Next.js recommended + TypeScript rules
├── tailwind.config.ts      ← Default Tailwind 4 config
└── postcss.config.mjs      ← PostCSS with Tailwind plugin
```

**Why `output: 'standalone'`:** The `standalone` output mode bundles only the files needed to run the application, reducing the Docker image size from ~1GB (full `node_modules`) to ~100MB. This is critical for the Docker Compose deployment in SKB-01.3.

**Why TypeScript strict mode:** Strict mode enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and other checks that catch bugs at compile time. Since we are building a multi-tenant application where data leaks are unacceptable, strict typing helps enforce correctness at every boundary.

---

## Implementation Steps

### Step 1: Create Next.js Project

Run the `create-next-app` command with all required flags. This scaffolds the entire project structure including TypeScript, Tailwind CSS 4, ESLint, App Router with `src/` directory, and Turbopack for development.

```bash
npx create-next-app@latest symbio-knowledge-base \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --turbopack \
  --import-alias "@/*"
```

**Expected output:** A `symbio-knowledge-base/` directory with the default Next.js project files.

**Verification:**
```bash
cd symbio-knowledge-base
ls -la src/app/
# Should show: globals.css  layout.tsx  page.tsx
```

---

### Step 2: Install Production Dependencies

Install all production npm packages required by the architecture document. These are grouped by purpose for clarity.

```bash
# ORM and database
npm install @prisma/client

# Authentication
npm install next-auth@4

# Block editor (TipTap 3)
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm \
  @tiptap/extension-placeholder \
  @tiptap/extension-code-block-lowlight \
  @tiptap/extension-task-list \
  @tiptap/extension-task-item \
  @tiptap/extension-image \
  @tiptap/extension-link

# Client-side state management
npm install @tanstack/react-query

# Knowledge graph visualization
npm install react-force-graph

# Validation and security
npm install zod dompurify bcryptjs
```

**Why these specific TipTap extensions:**
- `@tiptap/extension-placeholder`: Shows "Type '/' for commands..." placeholder text in empty blocks
- `@tiptap/extension-code-block-lowlight`: Syntax-highlighted code blocks (critical for scientific documentation)
- `@tiptap/extension-task-list` + `@tiptap/extension-task-item`: Interactive task lists (checkboxes)
- `@tiptap/extension-image`: Image blocks for experiment photos and diagrams
- `@tiptap/extension-link`: Clickable hyperlinks within block content

---

### Step 3: Install Dev Dependencies

Install development-only packages: Prisma CLI for schema management and migrations, TypeScript type definitions for packages that don't bundle their own, and Playwright for end-to-end testing.

```bash
# Prisma CLI (generates client, runs migrations)
npm install -D prisma

# TypeScript type definitions
npm install -D @types/bcryptjs @types/dompurify

# End-to-end testing
npm install -D playwright @playwright/test
```

---

### Step 4: Configure TypeScript Strict Mode

Modify `tsconfig.json` to enable strict mode and verify the path alias configuration. The `create-next-app` command sets up the basic `@/*` alias, but we need to ensure strict mode is fully enabled.

**File: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

**Key settings:**
- `"strict": true` — Enables all strict type-checking options (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`)
- `"paths": { "@/*": ["./src/*"] }` — Maps `@/` imports to the `src/` directory
- `"target": "ES2017"` — Supports async/await natively, no polyfills needed

---

### Step 5: Add Custom Scripts to package.json

Add Prisma-related scripts and verify the existing scripts are correct. These scripts provide the developer workflow for database management.

**Add to `package.json` scripts section:**

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  }
}
```

**Script explanations:**
- `db:generate` — Regenerates the Prisma Client TypeScript types after schema changes
- `db:migrate` — Creates and applies database migrations during development
- `db:seed` — Runs the seed script to populate initial data (admin user, welcome page)
- `db:studio` — Opens the Prisma Studio GUI for visual database browsing

---

### Step 6: Configure ESLint

Verify and extend the ESLint configuration to include Next.js recommended rules and TypeScript-aware linting.

**File: `.eslintrc.json`**

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "prefer-const": "error"
  }
}
```

**Rule explanations:**
- `next/core-web-vitals` — Enforces best practices for Core Web Vitals performance
- `next/typescript` — TypeScript-specific rules for Next.js projects
- `no-unused-vars` with `^_` pattern — Allows intentionally unused variables prefixed with underscore (common for destructuring)
- `no-explicit-any` — Enforces the architecture requirement "no `any` types allowed"
- `prefer-const` — Encourages immutable bindings for cleaner code

---

### Step 7: Configure next.config.ts

Set up the Next.js configuration for Docker-optimized production builds.

**File: `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Why `output: 'standalone'`:**
- Produces a self-contained build in `.next/standalone/` that includes only the necessary `node_modules`
- Reduces Docker image size from ~1GB to ~100MB
- Includes a minimal `server.js` that can run the application without the full `node_modules` tree
- Required by the multi-stage Docker build in SKB-01.3

---

### Step 8: Modify Landing Page

Replace the default Next.js landing page with a simple SymbioKnowledgeBase heading. This serves as a smoke test that the project compiles and renders correctly.

**File: `src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold tracking-tight">
        SymbioKnowledgeBase
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        AI-agent-first knowledge management platform
      </p>
    </main>
  );
}
```

---

### Step 9: Verify Build and Dev Server

Run the verification commands to confirm the project is correctly configured.

```bash
# Verify TypeScript compilation and build
npm run build

# Verify lint passes
npm run lint

# Start dev server (manual verification at localhost:3000)
npm run dev
```

**Expected results:**
- `npm run build` — Exits with code 0, no errors
- `npm run lint` — Exits with code 0, no warnings
- `npm run dev` — Server starts, `localhost:3000` shows the "SymbioKnowledgeBase" heading

---

### Step 10: Verify Import Alias

Create a temporary test to verify the `@/*` import alias works. This can be done by creating a simple utility file and importing it.

**File: `src/lib/constants.ts`** (temporary — will be expanded in later stories)

```typescript
export const APP_NAME = "SymbioKnowledgeBase";
```

**Update `src/app/page.tsx` to verify the alias works:**

```tsx
import { APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold tracking-tight">
        {APP_NAME}
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        AI-agent-first knowledge management platform
      </p>
    </main>
  );
}
```

**Verification:** `npm run build` should succeed, confirming that the `@/lib/constants` import resolves correctly.

---

## Testing Requirements

### Test File: `tests/e2e/smoke.spec.ts`

This is a minimal Playwright end-to-end test that verifies the dev server is running and the landing page renders correctly.

```typescript
import { test, expect } from "@playwright/test";

test.describe("Project Initialization Smoke Tests", () => {
  test("should load the landing page at localhost:3000", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await expect(page).toHaveTitle(/SymbioKnowledgeBase/);
  });

  test("should display the application heading", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("SymbioKnowledgeBase");
  });

  test("should display the application description", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const description = page.getByText("AI-agent-first knowledge management platform");
    await expect(description).toBeVisible();
  });
});
```

### Manual Verification Checklist

```bash
# 1. TypeScript compiles with zero errors
npm run build
# Expected: Exit code 0

# 2. ESLint passes with no errors
npm run lint
# Expected: Exit code 0

# 3. Dev server starts
npm run dev
# Expected: "Ready" message, localhost:3000 accessible

# 4. Import alias works (verified by successful build with @/lib/constants import)
# Already covered by npm run build

# 5. All scripts exist in package.json
npm run db:generate --help 2>&1 | head -1
npm run db:migrate --help 2>&1 | head -1
npm run db:seed --help 2>&1 | head -1
npm run db:studio --help 2>&1 | head -1
# Expected: No "missing script" errors
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `symbio-knowledge-base/` (entire project via create-next-app) |
| MODIFY | `tsconfig.json` (ensure strict mode enabled) |
| MODIFY | `package.json` (add db:* scripts) |
| MODIFY | `.eslintrc.json` (add no-explicit-any and custom rules) |
| MODIFY | `next.config.ts` (add output: 'standalone') |
| MODIFY | `src/app/page.tsx` (replace default with SymbioKnowledgeBase heading) |
| CREATE | `src/lib/constants.ts` (APP_NAME constant for import alias test) |
| CREATE | `tests/e2e/smoke.spec.ts` (Playwright smoke test) |

---

**Last Updated:** 2026-02-21
