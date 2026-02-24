# SymbioKnowledgeBase User Guide

Welcome to SymbioKnowledgeBase! This guide will help you get the most out of your knowledge management experience.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Navigation](#navigation)
3. [Creating & Editing Pages](#creating--editing-pages)
4. [Using the AI Assistant](#using-the-ai-assistant)
5. [Knowledge Graph](#knowledge-graph)
6. [Search](#search)
7. [Organizing Content](#organizing-content)
8. [Settings & Preferences](#settings--preferences)

---

## Getting Started

### First Login
1. Navigate to the application URL
2. Sign in with your credentials
3. You'll land on the **Home** dashboard

### Home Dashboard
The home page shows:
- **Recently Visited** - Quick access to your recent pages
- **Quick Actions** - New Page, Search, View Graph
- **All Pages** - Overview of your documents

---

## Navigation

### Sidebar
The left sidebar is your main navigation hub:

| Section | Description |
|---------|-------------|
| **Search** | Open global search (Cmd+K) |
| **Home** | Return to dashboard |
| **Graph** | Open knowledge graph view |
| **Pages** | Hierarchical page tree |
| **Settings** | App settings (bottom) |

### Resizing the Sidebar
- Hover over the right edge of the sidebar
- Drag left/right to resize (200-400px)
- Your preference is saved automatically

### Page Tree
- **Click** a page to open it
- **Click arrow** to expand/collapse children
- **Drag** pages to reorganize (see [Organizing Content](#organizing-content))
- **Right-click** for context menu

---

## Creating & Editing Pages

### Creating a New Page
1. Click **"+ New Page"** in the sidebar, or
2. Press **Cmd+N**, or
3. Use the Home page "New Page" button

New pages automatically get unique names (Untitled, Untitled 2, etc.)

### The Editor
The editor supports rich content:

| Format | How to Use |
|--------|------------|
| **Headings** | Type `# `, `## `, or `### ` |
| **Bold** | `**text**` or Cmd+B |
| **Italic** | `*text*` or Cmd+I |
| **Code** | `` `code` `` or Cmd+E |
| **Lists** | Type `- ` or `1. ` |
| **Quotes** | Type `> ` |
| **Divider** | Type `---` |

### Slash Commands
Type `/` to open the command menu:
- `/heading` - Insert heading
- `/bullet` - Bullet list
- `/numbered` - Numbered list
- `/quote` - Block quote
- `/code` - Code block
- `/divider` - Horizontal divider

### Page Options
Right-click any page in the sidebar for:
- **Rename** - Change the page title
- **Duplicate** - Create a copy
- **Copy link** - Copy page URL
- **Add to favorites** - Quick access
- **Delete** - Remove the page

---

## Using the AI Assistant

### Opening the Chat
- Click the **sparkle button** (bottom-right corner)
- The AI chat popup will open

### Chat Modes
Toggle between modes using the dropdown in the chat header:

| Mode | Description |
|------|-------------|
| **Floating** | Small popup window (400×500px) |
| **Sidebar** | Full-height panel docked right |

### Welcome Screen
When you first open the chat, you'll see suggested prompts:
- "Explain this page"
- "Create a task list"
- "Summarize content"
- "Write meeting notes"

Click any suggestion to insert it into the input.

### Context Awareness
The AI can see which page you're on:
- Look for **"Context: [Page Title]"** indicator
- Toggle context ON/OFF with the button
- When ON, AI can reference your current page

### Chat Controls

| Button | Action |
|--------|--------|
| ✨ **New Chat** | Clear history, start fresh |
| ➖ **Minimize** | Collapse to button only |
| ⬜ **Expand** | Toggle large/normal size |
| ✕ **Close** | Close the chat |

### Tips for Better AI Responses
- Be specific in your questions
- Enable context when asking about the current page
- Use the suggested prompts as starting points
- Ask follow-up questions for clarification

---

## Knowledge Graph

### Accessing the Graph
- Click **"Graph"** in the sidebar, or
- Click **"View Graph"** on the home page

### Graph Views
Toggle between:
- **2D** - Flat interactive graph
- **3D** - Three-dimensional view (requires WebGL)

### Graph Controls

| Control | Action |
|---------|--------|
| **Zoom +/-** | Zoom in/out |
| **Fit** | Fit all nodes in view |
| **Reset** | Reset to center |
| **Search** | Find nodes by name |

### Searching the Graph
1. Type in the "Find node..." search box
2. Matching nodes will highlight in blue
3. Graph centers on the first match
4. Non-matching nodes are dimmed
5. Clear search to reset

### Filters
- **Updated after** - Show only recently updated pages
- **Updated before** - Filter by date
- **Min connections** - Only show well-connected nodes

### Node Interaction
- **Click** a node to navigate to that page
- **Hover** to see the page title
- Statistics show: Nodes, Links, Clusters, Orphans

### Local Graph (Document Sidebar)
When viewing a document:
- Look for the **"Connections"** panel on the right
- Shows pages directly linked to the current page
- Click any node to navigate
- Use +/- buttons to zoom

---

## Search

### Global Search (Cmd+K)
Press **Cmd+K** (or Ctrl+K on Windows) anywhere to open search.

### How Search Works
- Searches page **titles** and **content**
- Results appear as you type (300ms debounce)
- Shows matching text snippets
- Displays breadcrumb path

### Navigating Results
- **Arrow keys** - Move up/down
- **Enter** - Open selected result
- **Escape** - Close search
- **Click** - Open any result

---

## Organizing Content

### Drag & Drop
Reorganize your pages with drag and drop:

1. **Hover** over a page to see the drag handle (⋮⋮)
2. **Drag** the page
3. **Drop between pages** - Reorders at the same level
4. **Drop ON a page** - Makes it a child (nested)

### Visual Indicators
- **Blue line** = Drop position (reorder)
- **Highlighted page** = Will become parent (nest)

### Nesting Pages
- Drop a page onto another to nest it
- Nested pages appear indented
- Click the arrow to expand/collapse
- No limit on nesting depth

### Best Practices
- Use folders (pages with children) for categories
- Keep important pages near the top
- Use clear, descriptive names
- Link related pages for graph connections

---

## Settings & Preferences

### Accessing Settings
Click **"Settings"** at the bottom of the sidebar.

### Settings Sections

#### Profile (`/settings/profile`)
- **Avatar** - Upload a profile picture
- **Name** - Your display name
- **User ID** - Copy your unique ID

#### Security (`/settings/security`)
- **Email** - Manage email address
- **Password** - Change password
- **Two-factor** - Enable 2FA (coming soon)

#### Preferences (`/settings/preferences`)
| Setting | Options |
|---------|---------|
| **Theme** | Light / Dark / System |
| **Language** | English, Deutsch, Español |
| **Date Format** | MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD |
| **Week Starts** | Sunday / Monday |

#### Notifications (`/settings/notifications`)
**Email Notifications:**
- Document updates
- Comments and mentions
- Weekly digest

**In-App Notifications:**
- Show notifications
- Play sounds

#### API Keys (`/settings/api-keys`)
- View and manage API keys
- Create new keys for integrations
- Revoke unused keys

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd+K** | Open search |
| **Cmd+N** | New page |
| **Cmd+B** | Bold text |
| **Cmd+I** | Italic text |
| **Cmd+E** | Inline code |
| **Escape** | Close modals/menus |

---

## Tips & Tricks

### Productivity
1. Use **Cmd+K** for quick navigation
2. Enable **AI context** for relevant assistance
3. Check the **Local Graph** to discover connections
4. Use **templates** for recurring document types

### Organization
1. Create **hub pages** that link to related content
2. Use **backlinks** to see what references a page
3. Review **orphan pages** in the graph (unconnected)
4. Keep your sidebar clean with **nesting**

### AI Assistant
1. Start with **suggested prompts**
2. Use **Sidebar mode** for longer conversations
3. Reference specific content by name
4. Ask for **formatting** (bullet points, tables)

---

## Getting Help

- Check the [Documentation](../README.md)
- Report bugs via GitHub Issues
- Join our community Discord

Happy knowledge building! 🧠✨
