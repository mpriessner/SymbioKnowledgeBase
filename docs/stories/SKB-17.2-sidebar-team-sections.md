# Story SKB-17.2: Sidebar Team Sections

**Epic:** Epic 17 - Teamspaces
**Story ID:** SKB-17.2
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-17.1 (teamspace data model must exist)

---

## User Story

As a user, I want to see my sidebar organized into "Private" and team sections, So that I can easily navigate between my personal pages and shared team pages.

---

## Acceptance Criteria

1. **Sidebar Structure**
   - [ ] Sidebar displays two types of sections: "Private" (personal pages) and one section per teamspace
   - [ ] Private section header shows "🔒 Private" with a lock icon
   - [ ] Each teamspace section header shows team icon + team name (e.g., "🚀 Research Team")
   - [ ] Sections are rendered in order: Private first, then teamspaces alphabetically by name

2. **Private Section**
   - [ ] Shows all pages where `teamspaceId IS NULL` and `creatorId = userId`
   - [ ] Page tree structure preserved (parent-child hierarchy)
   - [ ] Create page button creates a private page (teamspaceId = null)
   - [ ] Collapsible section (open by default)

3. **Teamspace Sections**
   - [ ] Each teamspace section shows all pages where `teamspaceId = X`
   - [ ] Page tree structure preserved within each teamspace
   - [ ] Create page button within teamspace context creates page with `teamspaceId = X`
   - [ ] Collapsible sections (state persisted in localStorage per teamspace)
   - [ ] Badge showing member count (e.g., "5 members") on hover or in section header

4. **Data Fetching**
   - [ ] `GET /api/teamspaces` fetches user's teamspaces (via TanStack Query)
   - [ ] `GET /api/pages` fetches all accessible pages (private + team pages)
   - [ ] Pages are grouped by `teamspaceId` on the client side
   - [ ] Stale-while-revalidate caching (30s stale time)
   - [ ] Loading skeleton while teamspaces/pages are loading

5. **Create Page in Context**
   - [ ] "New Page" button in Private section calls `POST /api/pages` with `teamspaceId = null`
   - [ ] "New Page" button in teamspace section calls `POST /api/pages` with `teamspaceId = X`
   - [ ] New page appears immediately in the correct section (optimistic update)

6. **Empty States**
   - [ ] Private section empty: "No private pages yet. Click + to create one."
   - [ ] Teamspace section empty: "No pages in this team yet. Click + to create one."
   - [ ] No teamspaces: Show only Private section

7. **Responsive Behavior**
   - [ ] Sections collapse/expand on header click
   - [ ] Collapse state persisted in localStorage: `sidebar-section-{sectionId}-collapsed`
   - [ ] All sections respect global sidebar collapse state

---

## Technical Implementation Notes

### Sidebar Component Refactor

**File: `src/components/sidebar/Sidebar.tsx`**

```typescript
'use client';

import { useMemo } from 'react';
import { useTeamspaces } from '@/hooks/useTeamspaces';
import { usePages } from '@/hooks/usePages';
import { SidebarSection } from './SidebarSection';
import { PrivateSection } from './PrivateSection';
import { TeamspaceSection } from './TeamspaceSection';

export function Sidebar() {
  const { data: teamspaces, isLoading: teamspacesLoading } = useTeamspaces();
  const { data: pages, isLoading: pagesLoading } = usePages();

  // Group pages by teamspaceId
  const pagesByTeamspace = useMemo(() => {
    if (!pages) return { private: [], teams: {} };

    const grouped: { private: Page[]; teams: Record<string, Page[]> } = {
      private: [],
      teams: {},
    };

    pages.forEach((page) => {
      if (page.teamspaceId === null) {
        grouped.private.push(page);
      } else {
        if (!grouped.teams[page.teamspaceId]) {
          grouped.teams[page.teamspaceId] = [];
        }
        grouped.teams[page.teamspaceId].push(page);
      }
    });

    return grouped;
  }, [pages]);

  // Sort teamspaces alphabetically
  const sortedTeamspaces = useMemo(() => {
    if (!teamspaces) return [];
    return [...teamspaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamspaces]);

  if (teamspacesLoading || pagesLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Private Section */}
      <PrivateSection pages={pagesByTeamspace.private} />

      {/* Teamspace Sections */}
      {sortedTeamspaces.map((teamspace) => (
        <TeamspaceSection
          key={teamspace.id}
          teamspace={teamspace}
          pages={pagesByTeamspace.teams[teamspace.id] || []}
        />
      ))}
    </div>
  );
}
```

---

### Private Section Component

**File: `src/components/sidebar/PrivateSection.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { PageTree } from './PageTree';
import { CreatePageButton } from './CreatePageButton';
import { ChevronRight, Lock } from 'lucide-react';

interface PrivateSectionProps {
  pages: Page[];
}

export function PrivateSection({ pages }: PrivateSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-section-private-collapsed');
    if (stored !== null) {
      setCollapsed(stored === 'true');
    }
  }, []);

  // Persist collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebar-section-private-collapsed', String(newState));
  };

  return (
    <div className="border-b border-[var(--color-border)]">
      {/* Section Header */}
      <button
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between px-4 py-2 hover:bg-[var(--color-bg-hover)]"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[var(--color-text-secondary)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Private
          </span>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-[var(--color-text-secondary)] transition-transform ${
            collapsed ? '' : 'rotate-90'
          }`}
        />
      </button>

      {/* Section Content */}
      {!collapsed && (
        <div className="px-2 py-2">
          {pages.length === 0 ? (
            <p className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
              No private pages yet. Click + to create one.
            </p>
          ) : (
            <PageTree pages={pages} />
          )}
          <CreatePageButton teamspaceId={null} label="New Private Page" />
        </div>
      )}
    </div>
  );
}
```

---

### Teamspace Section Component

**File: `src/components/sidebar/TeamspaceSection.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { PageTree } from './PageTree';
import { CreatePageButton } from './CreatePageButton';
import { ChevronRight, Users } from 'lucide-react';
import type { Teamspace } from '@/types/teamspace';
import type { Page } from '@/types/page';

interface TeamspaceSectionProps {
  teamspace: Teamspace;
  pages: Page[];
}

export function TeamspaceSection({ teamspace, pages }: TeamspaceSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`sidebar-section-${teamspace.id}-collapsed`);
    if (stored !== null) {
      setCollapsed(stored === 'true');
    }
  }, [teamspace.id]);

  // Persist collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(`sidebar-section-${teamspace.id}-collapsed`, String(newState));
  };

  return (
    <div className="border-b border-[var(--color-border)]">
      {/* Section Header */}
      <button
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between px-4 py-2 hover:bg-[var(--color-bg-hover)] group"
      >
        <div className="flex items-center gap-2">
          {teamspace.icon ? (
            <span className="text-base">{teamspace.icon}</span>
          ) : (
            <Users className="h-4 w-4 text-[var(--color-text-secondary)]" />
          )}
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {teamspace.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Member count badge (visible on hover) */}
          <span className="text-xs text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
            {teamspace.memberCount} {teamspace.memberCount === 1 ? 'member' : 'members'}
          </span>
          <ChevronRight
            className={`h-4 w-4 text-[var(--color-text-secondary)] transition-transform ${
              collapsed ? '' : 'rotate-90'
            }`}
          />
        </div>
      </button>

      {/* Section Content */}
      {!collapsed && (
        <div className="px-2 py-2">
          {pages.length === 0 ? (
            <p className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
              No pages in this team yet. Click + to create one.
            </p>
          ) : (
            <PageTree pages={pages} />
          )}
          <CreatePageButton
            teamspaceId={teamspace.id}
            label={`New Page in ${teamspace.name}`}
          />
        </div>
      )}
    </div>
  );
}
```

---

### Create Page Button Component

**File: `src/components/sidebar/CreatePageButton.tsx`**

```typescript
'use client';

import { Plus } from 'lucide-react';
import { useCreatePage } from '@/hooks/useCreatePage';

interface CreatePageButtonProps {
  teamspaceId: string | null;
  label: string;
}

export function CreatePageButton({ teamspaceId, label }: CreatePageButtonProps) {
  const { mutate: createPage, isPending } = useCreatePage();

  const handleCreate = () => {
    createPage({
      title: 'Untitled',
      teamspaceId,
    });
  };

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
    >
      <Plus className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
```

---

### Teamspaces Hook

**File: `src/hooks/useTeamspaces.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';

export interface Teamspace {
  id: string;
  name: string;
  icon: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  memberCount: number;
}

async function fetchTeamspaces(): Promise<Teamspace[]> {
  const res = await fetch('/api/teamspaces');
  if (!res.ok) {
    throw new Error('Failed to fetch teamspaces');
  }
  const json = await res.json();
  return json.data;
}

export function useTeamspaces() {
  return useQuery({
    queryKey: ['teamspaces'],
    queryFn: fetchTeamspaces,
    staleTime: 30_000, // 30 seconds
  });
}
```

---

### Create Page Hook (with teamspace support)

**File: `src/hooks/useCreatePage.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface CreatePageInput {
  title: string;
  teamspaceId: string | null;
  parentId?: string;
}

async function createPage(input: CreatePageInput) {
  const res = await fetch('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error('Failed to create page');
  }
  return res.json();
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: createPage,
    onSuccess: (data) => {
      // Invalidate pages query to refetch sidebar
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      // Navigate to new page
      router.push(`/pages/${data.data.id}`);
    },
  });
}
```

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/sidebar/TeamspaceSection.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamspaceSection } from '@/components/sidebar/TeamspaceSection';

const mockTeamspace = {
  id: '1',
  name: 'Research Team',
  icon: '🔬',
  role: 'MEMBER' as const,
  memberCount: 5,
};

describe('TeamspaceSection', () => {
  it('should render teamspace name and icon', () => {
    render(<TeamspaceSection teamspace={mockTeamspace} pages={[]} />);
    expect(screen.getByText('Research Team')).toBeInTheDocument();
    expect(screen.getByText('🔬')).toBeInTheDocument();
  });

  it('should show member count on hover', () => {
    render(<TeamspaceSection teamspace={mockTeamspace} pages={[]} />);
    expect(screen.getByText('5 members')).toBeInTheDocument();
  });

  it('should toggle collapse state on header click', () => {
    render(<TeamspaceSection teamspace={mockTeamspace} pages={[]} />);
    const header = screen.getByRole('button');

    // Should be expanded by default
    expect(screen.getByText(/No pages in this team yet/)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(header);
    expect(screen.queryByText(/No pages in this team yet/)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(header);
    expect(screen.getByText(/No pages in this team yet/)).toBeInTheDocument();
  });

  it('should persist collapse state to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<TeamspaceSection teamspace={mockTeamspace} pages={[]} />);

    const header = screen.getByRole('button');
    fireEvent.click(header);

    expect(setItemSpy).toHaveBeenCalledWith('sidebar-section-1-collapsed', 'true');
  });
});
```

### Integration Tests: `src/__tests__/components/sidebar/Sidebar.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useTeamspaces', () => ({
  useTeamspaces: () => ({
    data: [
      { id: '1', name: 'Team A', icon: '🚀', role: 'MEMBER', memberCount: 3 },
      { id: '2', name: 'Team B', icon: '🔬', role: 'ADMIN', memberCount: 7 },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/usePages', () => ({
  usePages: () => ({
    data: [
      { id: 'p1', title: 'Private Page', teamspaceId: null },
      { id: 'p2', title: 'Team A Page', teamspaceId: '1' },
      { id: 'p3', title: 'Team B Page', teamspaceId: '2' },
    ],
    isLoading: false,
  }),
}));

const queryClient = new QueryClient();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('Sidebar', () => {
  it('should render Private section first', () => {
    renderWithProviders(<Sidebar />);
    const sections = screen.getAllByRole('button');
    expect(sections[0]).toHaveTextContent('Private');
  });

  it('should render teamspace sections alphabetically', () => {
    renderWithProviders(<Sidebar />);
    const teamSections = screen.getAllByText(/Team [AB]/);
    expect(teamSections[0]).toHaveTextContent('Team A');
    expect(teamSections[1]).toHaveTextContent('Team B');
  });

  it('should group pages by teamspaceId', () => {
    renderWithProviders(<Sidebar />);
    // Private section should contain "Private Page"
    expect(screen.getByText('Private Page')).toBeInTheDocument();
    // Team A section should contain "Team A Page"
    expect(screen.getByText('Team A Page')).toBeInTheDocument();
  });
});
```

### E2E Tests: `tests/e2e/sidebar-teamspaces.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Sidebar Teamspace Sections', () => {
  test('should show Private section and team sections', async ({ page }) => {
    await page.goto('/');

    // Private section should be visible
    await expect(page.locator('text=Private')).toBeVisible();

    // Teamspace sections should be visible (assuming user has teams)
    await expect(page.locator('text=Research Team')).toBeVisible();
  });

  test('should create page in private section', async ({ page }) => {
    await page.goto('/');

    // Click "New Private Page" button
    await page.click('text=New Private Page');

    // Should navigate to new page
    await expect(page).toHaveURL(/\/pages\/[a-f0-9-]+/);

    // New page should appear in Private section
    await expect(page.locator('text=Untitled')).toBeVisible();
  });

  test('should create page in teamspace section', async ({ page }) => {
    await page.goto('/');

    // Click "New Page in Research Team" button
    await page.click('text=New Page in Research Team');

    // Should navigate to new page
    await expect(page).toHaveURL(/\/pages\/[a-f0-9-]+/);

    // New page should appear in teamspace section
    await expect(page.locator('text=Untitled')).toBeVisible();
  });

  test('should persist section collapse state', async ({ page }) => {
    await page.goto('/');

    // Collapse Private section
    await page.click('text=Private');
    await expect(page.locator('text=No private pages yet')).not.toBeVisible();

    // Reload page
    await page.reload();

    // Private section should remain collapsed
    await expect(page.locator('text=No private pages yet')).not.toBeVisible();
  });
});
```

---

## Dependencies

- **SKB-17.1:** Teamspace and TeamspaceMember models must exist
- **SKB-03.x:** Page creation API (`POST /api/pages`) must support `teamspaceId` parameter

---

## Dev Notes

### Page Filtering Logic

```typescript
// Fetch all accessible pages:
// 1. Private pages: teamspaceId IS NULL AND creatorId = userId
// 2. Team pages: teamspaceId IN (SELECT teamspaceId FROM teamspace_members WHERE userId = X)

// Client-side grouping:
const pagesByTeamspace = pages.reduce((acc, page) => {
  if (page.teamspaceId === null) {
    acc.private.push(page);
  } else {
    if (!acc.teams[page.teamspaceId]) {
      acc.teams[page.teamspaceId] = [];
    }
    acc.teams[page.teamspaceId].push(page);
  }
  return acc;
}, { private: [], teams: {} });
```

### localStorage Keys

- Private section: `sidebar-section-private-collapsed`
- Teamspace sections: `sidebar-section-{teamspaceId}-collapsed`

### Performance Considerations

- **Single query for pages:** Fetch all accessible pages in one query, then group on client side (faster than separate queries per teamspace)
- **Optimistic updates:** When creating a page, immediately add it to the sidebar (before API response) for snappy UX
- **Stale-while-revalidate:** Cache teamspaces and pages for 30s to reduce re-fetching on navigation

### Empty State Edge Cases

- **No teamspaces:** User sees only Private section
- **No pages:** Each section shows "No pages yet" message
- **All pages in teams:** Private section shows "No private pages yet"

---

**Last Updated:** 2026-02-22
