# SymbioKnowledgeBase Features

Complete overview of all features implemented in SymbioKnowledgeBase.

## 📝 Document Management

### Rich Text Editor
- **Block-based editing** with TipTap
- **Markdown support** - Type markdown, see formatted output
- **Slash commands** - Type `/` for quick formatting
- **Keyboard shortcuts** - Cmd+B, Cmd+I, Cmd+E
- **Code blocks** with syntax highlighting
- **Tables, lists, quotes, dividers**

### Page Organization
- **Hierarchical structure** - Unlimited nesting
- **Drag & drop** - Reorder and nest pages
- **Automatic backlinks** - See what links to a page
- **Cover images** - Visual page headers
- **Icons** - Emoji icons for pages

### Page Operations
- **Create** - New page with auto-naming
- **Rename** - Inline or via context menu
- **Duplicate** - Copy with all content
- **Delete** - With confirmation
- **Move** - Drag to new location
- **Export** - Markdown export

---

## 🤖 AI Assistant (Symbio AI)

### Chat Interface
| Feature | Description |
|---------|-------------|
| **Floating mode** | 400×500px popup, bottom-right |
| **Sidebar mode** | Full-height panel, docked right |
| **Expandable** | Toggle between normal and large (600×700px) |
| **Minimizable** | Collapse to button only |
| **Message indicator** | Dot shows when chat has content |

### Conversation Features
- **Streaming responses** - See AI typing in real-time
- **Markdown rendering** - Formatted AI responses
- **Code highlighting** - Syntax-highlighted code blocks
- **Copy responses** - One-click copy button
- **Message history** - Persisted in localStorage
- **New chat** - Clear and start fresh

### Context Awareness
- **Page detection** - AI knows your current page
- **Context toggle** - Enable/disable context sharing
- **Visual indicator** - Shows "Context: [Page Name]"
- **Smart prompts** - Suggestions based on context

### Welcome Screen
Four quick-start suggestions:
1. "Explain this page"
2. "Create a task list"
3. "Summarize content"
4. "Write meeting notes"

---

## 🕸️ Knowledge Graph

### Visualization
| Feature | Description |
|---------|-------------|
| **2D View** | Interactive force-directed graph |
| **3D View** | Three-dimensional navigation (WebGL) |
| **Zoom controls** | +/- buttons and scroll |
| **Fit to screen** | Show all nodes |
| **Reset view** | Return to center |

### Search & Filter
- **Node search** - Find by name, highlights matches
- **Center on match** - Graph zooms to first result
- **Match counter** - "X matches found"
- **Dimming** - Non-matching nodes fade out
- **Date filters** - Updated after/before
- **Connection filter** - Minimum link count

### Interaction
- **Click to navigate** - Open page from graph
- **Hover tooltips** - See page title
- **Node labels** - Toggle on/off
- **Edge labels** - Toggle on/off

### Statistics
- **Nodes** - Total page count
- **Links** - Connection count
- **Clusters** - Connected groups
- **Orphans** - Unconnected pages

### Local Graph (Document Sidebar)
- **Compact view** - 280×200px mini-graph
- **Current page centered** - Highlighted node
- **Direct connections** - First-degree links
- **Zoom controls** - +/- and fit
- **Click to navigate** - Open connected pages
- **Full graph link** - Jump to main graph

---

## 🔍 Search

### Global Search (Quick Switcher)
- **Keyboard shortcut** - Cmd+K / Ctrl+K
- **Instant results** - 300ms debounce
- **Full-text search** - Titles and content
- **Keyboard navigation** - Arrow keys + Enter
- **Recent pages** - Quick access list
- **Breadcrumbs** - Show page location

---

## 🎨 User Interface

### Sidebar
| Feature | Description |
|---------|-------------|
| **Resizable** | Drag to adjust (200-400px) |
| **Collapsible** | Hide to maximize content |
| **Persistent width** | Saved to localStorage |
| **Hover resize handle** | Visual indicator |

### Context Menus
Right-click any page for:
- Rename
- Duplicate
- Copy link
- Add to favorites
- Delete (with confirmation)

### Text Handling
- **Smart truncation** - Ellipsis for long titles
- **Hover tooltips** - Full text on hover
- **Auto-detect** - Only shows when truncated

### Page Naming
- **Unique names** - "Untitled", "Untitled 2", etc.
- **Gap filling** - Reuses deleted numbers
- **Title sync** - (Future: sync from first heading)

### Drag & Drop
- **Drag handle** - ⋮⋮ dots pattern
- **Reorder** - Drop between pages
- **Nest** - Drop on page to make child
- **Visual feedback** - Blue lines and highlights
- **Circular prevention** - Can't drop into self

---

## ⚙️ Settings

### Navigation
- **Sidebar layout** - Organized sections
- **URL routing** - `/settings/profile`, etc.
- **Active highlighting** - Current section marked

### Sections

#### Profile
- Profile avatar (initials or upload)
- Preferred name
- User ID (copyable)

#### Security
- Email management
- Password change (with strength indicator)
- Two-factor authentication (placeholder)
- Passkeys (placeholder)

#### Preferences
| Setting | Options |
|---------|---------|
| Theme | Light / Dark / System |
| Language | English, Deutsch, Español |
| Date format | MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD |
| Week starts | Sunday / Monday |

#### Notifications
**Email:**
- Document updates
- Comments and mentions
- Weekly digest

**In-App:**
- Show notifications
- Play sounds

#### API Keys
- View existing keys
- Create new keys
- Revoke keys

---

## 🔧 Technical Features

### Performance
- **Server Components** - Next.js 14 App Router
- **Streaming** - AI responses stream in real-time
- **Optimistic updates** - Instant UI feedback
- **Debounced search** - Prevents API spam

### Persistence
- **Database** - PostgreSQL with Prisma
- **Local storage** - User preferences
- **Session storage** - Temporary state

### Authentication
- **Supabase Auth** - Email/password
- **Session management** - Secure cookies
- **Multi-tenant** - Workspace isolation

### API
- **RESTful endpoints** - `/api/*`
- **Streaming support** - Server-Sent Events
- **Rate limiting** - Per-user limits
- **Validation** - Zod schemas

---

## 🗺️ Feature Roadmap

### Planned
- [ ] File/image upload in chat
- [ ] Chat history browser
- [ ] AI page creation
- [ ] Comments & mentions
- [ ] Real-time collaboration
- [ ] Mobile PWA
- [ ] Import from Notion
- [ ] Team workspaces

### Under Consideration
- [ ] Offline support
- [ ] End-to-end encryption
- [ ] Custom AI models
- [ ] Plugin system
- [ ] Public sharing

---

## 📊 Implementation Status

| Epic | Stories | Status |
|------|---------|--------|
| Epic 1: AI Chat Basics | 4 | ✅ Complete |
| Epic 2: Notion AI Features | 4 | ✅ Complete |
| Epic 3: Knowledge Graph | 3 | ✅ Complete |
| Epic 4: Settings | 3 | ✅ Complete |
| Epic 5: UI Improvements | 6 | ✅ Complete |

**Total: 20 stories implemented**
