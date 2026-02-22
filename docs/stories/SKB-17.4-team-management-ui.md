# Story SKB-17.4: Team Management UI

**Epic:** Epic 17 - Teamspaces
**Story ID:** SKB-17.4
**Story Points:** 5 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-17.1 (teamspace data model must exist)

---

## User Story

As a team admin, I want to manage team members and settings through a UI, So that I can control who has access to shared pages without writing code or calling APIs directly.

---

## Acceptance Criteria

1. **Settings Modal - Teams Section**
   - [ ] New "Teams" tab in Settings modal
   - [ ] List of user's teamspaces with role badges (OWNER, ADMIN, MEMBER, GUEST)
   - [ ] "Create Team" button (opens CreateTeamModal)
   - [ ] Each team row shows: icon, name, member count, role badge, "Manage" button

2. **Create Team Modal**
   - [ ] Form fields: Team Name (required, 1-100 chars), Icon (emoji picker)
   - [ ] Validation: name cannot be empty or duplicate within tenant
   - [ ] Calls `POST /api/teamspaces` with `{ name, icon }`
   - [ ] On success: closes modal, refetches teamspaces list, shows toast "Team created"

3. **Manage Team Modal**
   - [ ] Opens when clicking "Manage" on a team row
   - [ ] Sections: Team Info, Members, Danger Zone
   - [ ] **Team Info:** Edit name/icon (ADMIN or OWNER only), Save button
   - [ ] **Members Section:**
     - Table: Name, Email, Role, Actions
     - "Invite Member" button (opens InviteMemberModal)
     - Role dropdown per member (OWNER can change any role, ADMIN can change MEMBER/GUEST only)
     - "Remove" button per member (cannot remove last OWNER)
     - "Leave Team" button for self (disabled if you are the only OWNER)
   - [ ] **Danger Zone:** "Delete Team" button (OWNER only, confirmation dialog)

4. **Invite Member Modal**
   - [ ] Input: Email address (validated as email format)
   - [ ] Role selector: ADMIN, MEMBER, GUEST (default: MEMBER)
   - [ ] Lookup user by email within tenant: `GET /api/users?email=X`
   - [ ] If user found: calls `POST /api/teamspaces/:id/members` with `{ userId, role }`
   - [ ] If user not found: shows error "No user with this email in your workspace"
   - [ ] On success: closes modal, refetches members, shows toast "Member invited"

5. **Role Management**
   - [ ] Role dropdown per member (only for ADMIN or OWNER)
   - [ ] Calls `PATCH /api/teamspaces/:id/members/:userId` with `{ role }`
   - [ ] Ownership transfer: if changing someone to OWNER, show confirmation "You will be demoted to ADMIN. Continue?"
   - [ ] On success: refetches members, shows toast "Role updated"

6. **Remove Member**
   - [ ] "Remove" button per member (only for ADMIN or OWNER)
   - [ ] Confirmation dialog: "Remove [Name] from [Team Name]?"
   - [ ] Cannot remove last OWNER (button disabled with tooltip)
   - [ ] Calls `DELETE /api/teamspaces/:id/members/:userId`
   - [ ] On success: refetches members, shows toast "Member removed"

7. **Leave Team**
   - [ ] "Leave Team" button in Manage Team modal
   - [ ] Confirmation dialog: "Leave [Team Name]? You will lose access to all shared pages."
   - [ ] Disabled if you are the only OWNER (tooltip: "Transfer ownership first")
   - [ ] Calls `DELETE /api/teamspaces/:id/members/:userId` (self)
   - [ ] On success: closes modal, refetches teamspaces, shows toast "Left team"

8. **Delete Team**
   - [ ] "Delete Team" button in Danger Zone (OWNER only)
   - [ ] Confirmation dialog: "Delete [Team Name]? All pages will become private."
   - [ ] Calls `DELETE /api/teamspaces/:id`
   - [ ] On success: closes modal, refetches teamspaces, shows toast "Team deleted"

---

## Technical Implementation Notes

### Settings Modal - Teams Tab

**File: `src/components/settings/TeamManagement.tsx`**

```typescript
'use client';

import { useTeamspaces } from '@/hooks/useTeamspaces';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useState } from 'react';
import { CreateTeamModal } from './CreateTeamModal';
import { ManageTeamModal } from './ManageTeamModal';

export function TeamManagement() {
  const { data: teamspaces, isLoading } = useTeamspaces();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  if (isLoading) return <div>Loading teams...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Teams</h2>
        <Button onClick={() => setShowCreateModal(true)}>Create Team</Button>
      </div>

      <div className="space-y-2">
        {teamspaces?.map((team) => (
          <div key={team.id} className="flex items-center justify-between border p-4 rounded">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{team.icon || '👥'}</span>
              <div>
                <p className="font-medium">{team.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {team.memberCount} members
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{team.role}</Badge>
              <Button variant="secondary" onClick={() => setSelectedTeam(team.id)}>
                Manage
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && <CreateTeamModal onClose={() => setShowCreateModal(false)} />}
      {selectedTeam && (
        <ManageTeamModal teamId={selectedTeam} onClose={() => setSelectedTeam(null)} />
      )}
    </div>
  );
}
```

---

### Create Team Modal

**File: `src/components/settings/CreateTeamModal.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useCreateTeamspace } from '@/hooks/useCreateTeamspace';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

interface CreateTeamModalProps {
  onClose: () => void;
}

export function CreateTeamModal({ onClose }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const { mutate: createTeam, isPending } = useCreateTeamspace();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTeam(
      { name, icon: icon || null },
      {
        onSuccess: () => {
          toast.success('Team created');
          onClose();
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to create team');
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Team Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Research Team"
              required
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Icon (emoji)</label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🚀"
              maxLength={2}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || !name.trim()}>
              Create Team
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Manage Team Modal (simplified - full implementation in code)

**File: `src/components/settings/ManageTeamModal.tsx`**

Includes:
- Team info edit form (name, icon) — PATCH /api/teamspaces/:id
- Members table with role dropdowns
- Invite member button → opens InviteMemberModal
- Remove member button → DELETE /api/teamspaces/:id/members/:userId
- Leave team button → DELETE /api/teamspaces/:id/members/self
- Delete team button (danger zone) → DELETE /api/teamspaces/:id

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/settings/CreateTeamModal.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateTeamModal } from '@/components/settings/CreateTeamModal';

vi.mock('@/hooks/useCreateTeamspace', () => ({
  useCreateTeamspace: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe('CreateTeamModal', () => {
  it('should render form fields', () => {
    render(<CreateTeamModal onClose={() => {}} />);
    expect(screen.getByLabelText('Team Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Icon (emoji)')).toBeInTheDocument();
  });

  it('should disable submit button when name is empty', () => {
    render(<CreateTeamModal onClose={() => {}} />);
    const submitButton = screen.getByText('Create Team');
    expect(submitButton).toBeDisabled();
  });
});
```

### E2E Tests: `tests/e2e/team-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Team Management', () => {
  test('should create new team', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Teams');
    await page.click('text=Create Team');

    await page.fill('input[placeholder="Research Team"]', 'E2E Test Team');
    await page.fill('input[placeholder="🚀"]', '🧪');
    await page.click('text=Create Team');

    await expect(page.locator('text=Team created')).toBeVisible();
    await expect(page.locator('text=E2E Test Team')).toBeVisible();
  });

  test('should invite member to team', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Teams');
    await page.click('text=Manage');

    await page.click('text=Invite Member');
    await page.fill('input[type="email"]', 'teammate@example.com');
    await page.selectOption('select[name="role"]', 'MEMBER');
    await page.click('text=Send Invite');

    await expect(page.locator('text=Member invited')).toBeVisible();
  });
});
```

---

## Dependencies

- **SKB-17.1:** Teamspace API endpoints must exist
- **Existing:** User lookup API (`GET /api/users?email=X`)

---

## Dev Notes

### Permission Checks

All mutation buttons must check user role:
- **Edit team info:** ADMIN or OWNER
- **Invite/remove members:** ADMIN or OWNER
- **Change roles:** OWNER only (ADMIN can manage MEMBER/GUEST)
- **Delete team:** OWNER only

### Edge Cases

- **Last OWNER:** Cannot be removed or leave team
- **Ownership transfer:** Show confirmation before demoting self to ADMIN
- **Duplicate names:** API returns 409 if team name already exists in tenant

---

**Last Updated:** 2026-02-22
