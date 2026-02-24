# Epic 5: UI/UX Improvements & Bug Fixes

**Status:** Ready for Implementation  
**Priority:** High  
**Dependencies:** None

## Overview
Fix critical UI bugs and add essential UX features for better document management.

---

## Story 17: Resizable Sidebar

**Points:** 3  
**Files to modify:**
- `src/components/workspace/Sidebar.tsx`
- `src/components/workspace/WorkspaceLayout.tsx`

### Requirements

1. **Draggable Resize Handle**
   - Vertical line on right edge of sidebar
   - Cursor changes to `col-resize` on hover
   - Drag to resize sidebar width

2. **Size Constraints**
   - Minimum width: 200px
   - Maximum width: 400px
   - Default width: 256px

3. **Persistence**
   - Save width to localStorage: `symbio-sidebar-width`
   - Restore on page load

4. **Visual Feedback**
   - Subtle hover state on resize handle
   - Optional: highlight during drag

5. **Implementation**
   ```typescript
   const [sidebarWidth, setSidebarWidth] = useState(
     () => parseInt(localStorage.getItem('symbio-sidebar-width') || '256')
   );
   
   const handleMouseDown = (e: MouseEvent) => {
     const startX = e.clientX;
     const startWidth = sidebarWidth;
     
     const handleMouseMove = (e: MouseEvent) => {
       const newWidth = Math.min(400, Math.max(200, startWidth + e.clientX - startX));
       setSidebarWidth(newWidth);
     };
     
     const handleMouseUp = () => {
       localStorage.setItem('symbio-sidebar-width', sidebarWidth.toString());
       document.removeEventListener('mousemove', handleMouseMove);
       document.removeEventListener('mouseup', handleMouseUp);
     };
     
     document.addEventListener('mousemove', handleMouseMove);
     document.addEventListener('mouseup', handleMouseUp);
   };
   ```

### Acceptance Criteria
- [ ] Sidebar can be resized by dragging
- [ ] Width stays within min/max bounds
- [ ] Width persists across page reloads
- [ ] Cursor shows resize indicator

---

## Story 18: Page Context Menu (Right-Click Options)

**Points:** 5  
**Files to create:**
- `src/components/sidebar/PageContextMenu.tsx`
- `src/components/ui/ContextMenu.tsx` (if not exists)

**Files to modify:**
- `src/components/sidebar/SidebarItem.tsx`

### Requirements

1. **Trigger Context Menu**
   - Right-click on any page in sidebar
   - Or click ⋯ (three dots) button on hover

2. **Menu Options**
   ```typescript
   const menuItems = [
     { icon: Pencil, label: "Rename", action: "rename" },
     { icon: Copy, label: "Duplicate", action: "duplicate" },
     { icon: Link, label: "Copy link", action: "copyLink" },
     { icon: ArrowRight, label: "Move to...", action: "move" },
     { divider: true },
     { icon: Star, label: "Add to favorites", action: "favorite" },
     { divider: true },
     { icon: Trash, label: "Delete", action: "delete", danger: true },
   ];
   ```

3. **Delete Confirmation**
   - Show confirmation modal before delete
   - "Are you sure? This will delete [Page Name] and all sub-pages."
   - Cancel / Delete buttons

4. **API Integration**
   - DELETE `/api/pages/[pageId]`
   - Should handle cascading delete of sub-pages

5. **Keyboard Support**
   - Escape closes menu
   - Arrow keys navigate
   - Enter selects

### Acceptance Criteria
- [ ] Right-click shows context menu
- [ ] Menu has all required options
- [ ] Delete shows confirmation
- [ ] Delete actually removes page
- [ ] Menu positions correctly (doesn't overflow screen)

---

## Story 19: Functional Global Search

**Points:** 5  
**Files to modify:**
- `src/components/search/SearchModal.tsx` (or create)
- `src/components/sidebar/SearchBar.tsx`
- `src/app/api/search/route.ts`

### Requirements

1. **Search Trigger**
   - Click search in sidebar
   - Keyboard shortcut: `Cmd/Ctrl + K`
   - Opens modal/overlay

2. **Search Modal**
   - Full-width input at top
   - Results appear below as you type
   - Debounced search (300ms)

3. **Search Results**
   ```typescript
   interface SearchResult {
     id: string;
     title: string;
     snippet: string; // Matching text preview
     path: string[]; // Breadcrumb path
     updatedAt: Date;
   }
   ```

4. **Result Display**
   - Page icon + title
   - Snippet with highlighted match
   - Breadcrumb path (parent > child)
   - Press Enter or click to navigate

5. **API Endpoint**
   ```typescript
   // GET /api/search?q=query&limit=20
   // Search page titles AND content
   // Return ranked results
   ```

6. **Empty States**
   - "Type to search..."
   - "No results found for '[query]'"

### Acceptance Criteria
- [ ] Cmd+K opens search modal
- [ ] Results appear as you type
- [ ] Searches both titles and content
- [ ] Clicking result navigates to page
- [ ] Highlights matching text

---

## Story 20: Drag & Drop to Create Sub-Pages

**Points:** 8  
**Files to modify:**
- `src/components/sidebar/SidebarTree.tsx`
- `src/components/sidebar/SidebarItem.tsx`
- `src/app/api/pages/[pageId]/move/route.ts`

### Requirements

1. **Drag Initiation**
   - Drag handle (⋮⋮) or drag entire row
   - Show dragging state (semi-transparent)
   - Cursor shows grabbing

2. **Drop Targets**
   - Drop ON a page → make it a child
   - Drop BETWEEN pages → reorder at same level
   - Visual indicator showing drop position

3. **Drop Zones Visual**
   ```
   ┌──────────────────┐
   │ ▬▬▬ Drop above  │  ← Blue line indicator
   │ Page A          │
   │ ▬▬▬ Drop below  │  ← Blue line indicator
   └──────────────────┘
   
   ┌──────────────────┐
   │ Page B          │  ← Highlighted = drop as child
   │   ↳ [drag here] │
   └──────────────────┘
   ```

4. **API Call on Drop**
   ```typescript
   // PATCH /api/pages/[pageId]/move
   // Body: { parentId: string | null, position: number }
   ```

5. **Constraints**
   - Cannot drop page into itself
   - Cannot drop parent into its own child
   - Max nesting depth: 5 levels

6. **Libraries**
   - Consider: `@dnd-kit/core` or `react-beautiful-dnd`

### Acceptance Criteria
- [ ] Can drag pages in sidebar
- [ ] Dropping on page makes it a child
- [ ] Dropping between pages reorders
- [ ] Visual indicators show drop zones
- [ ] Changes persist to database
- [ ] Undo available (Cmd+Z) - optional

---

## Story 21: Fix Sidebar Text Truncation

**Points:** 2  
**Files to modify:**
- `src/components/sidebar/SidebarItem.tsx`
- `src/styles/sidebar.css` (or Tailwind classes)

### Requirements

1. **Proper Text Handling**
   - Text truncates with ellipsis when too long
   - Full title shown on hover (tooltip)
   - Min visible characters: ~15-20

2. **Tooltip Implementation**
   ```typescript
   <TooltipProvider>
     <Tooltip>
       <TooltipTrigger asChild>
         <span className="truncate">{page.title}</span>
       </TooltipTrigger>
       <TooltipContent>
         {page.title}
       </TooltipContent>
     </Tooltip>
   </TooltipProvider>
   ```

3. **CSS Fix**
   ```css
   .sidebar-item-title {
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
     max-width: calc(100% - 40px); /* Account for icons */
   }
   ```

### Acceptance Criteria
- [ ] Long titles truncate with "..."
- [ ] Hover shows full title
- [ ] Text doesn't wrap to multiple lines

---

## Story 22: Auto-Name Untitled Pages

**Points:** 2  
**Files to modify:**
- `src/hooks/usePage.ts` or page creation logic
- `src/app/api/pages/route.ts`

### Requirements

1. **Auto-naming Logic**
   - First line of content becomes title (if typed)
   - Or: "Untitled 1", "Untitled 2", etc.
   - Or: Date-based: "Note - Feb 24, 2026"

2. **Title Sync**
   - When user types first heading, update page title
   - Debounced (500ms) to avoid spam

3. **Placeholder Improvement**
   - Instead of "Untitled", show "New Page" with dimmed styling
   - Becomes real title once content is added

### Acceptance Criteria
- [ ] New pages get meaningful default names
- [ ] First heading content syncs to title
- [ ] No more duplicate "Untitled" pages

---

## Implementation Order

1. **Story 21** (Text Truncation) - Quick CSS fix
2. **Story 17** (Resizable Sidebar) - Popular request, good UX
3. **Story 18** (Context Menu) - Essential for page management
4. **Story 19** (Global Search) - Critical functionality
5. **Story 20** (Drag & Drop) - Complex but important
6. **Story 22** (Auto-Name) - Polish

## Technical Notes

### Drag & Drop Library Recommendation
Use `@dnd-kit/core` and `@dnd-kit/sortable`:
```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

More flexible than react-beautiful-dnd and actively maintained.

### Context Menu Library
Consider `@radix-ui/react-context-menu` (already using Radix for other UI):
```bash
npm install @radix-ui/react-context-menu
```
