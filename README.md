# SymbioKnowledgeBase

A modern, AI-powered knowledge management platform built with Next.js 14, featuring a Notion-like interface with advanced graph visualization and intelligent assistance.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 📝 Document Management
- **Rich Text Editor** - Block-based editor with TipTap
- **Hierarchical Organization** - Unlimited nesting with drag & drop
- **Page Templates** - Quick-start templates for common use cases
- **Full-Text Search** - Instant search across all documents (Cmd+K). Retrieval is PostgreSQL full-text search (FTS) with heuristic ranking — keyword/lexical matching, **not** vector/embedding semantic similarity.
- **Backlinks** - Automatic bi-directional linking between pages

### 🤖 AI Assistant (Symbio AI)
- **Floating/Sidebar Chat** - Toggle between popup and full-height sidebar
- **Context Awareness** - AI knows which page you're viewing
- **Prompt Suggestions** - Quick-start prompts for common tasks
- **Streaming Responses** - Real-time AI responses with markdown
- **Chat Controls** - New chat, minimize, expand, history

### 🕸️ Knowledge Graph
- **Interactive Visualization** - 2D and 3D graph views
- **Node Search** - Find and highlight nodes instantly
- **Click Navigation** - Click any node to open the page
- **Local Graph** - Mini-graph sidebar on each document
- **Filters** - Date range, connection count, labels

### ⚙️ Settings & Customization
- **Settings Navigation** - Organized sidebar with sections
- **Theme Support** - Light, Dark, and System modes
- **Preferences** - Language, date format, week start
- **Notifications** - Email and in-app notification controls
- **API Keys** - Manage integration keys

### 🎨 UI/UX
- **Resizable Sidebar** - Drag to adjust width
- **Context Menus** - Right-click for page actions
- **Text Truncation** - Smart truncation with tooltips
- **Auto-Naming** - Unique names for new pages
- **Dark Mode** - Full dark theme support

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (or use Supabase)

### Installation

```bash
# Clone the repository
git clone https://github.com/mpriessner/SymbioKnowledgeBase.git
cd SymbioKnowledgeBase

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database and API keys

# Run database migrations
npx prisma migrate dev

# Seed demo data (optional)
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Supabase (optional)
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."

# OpenAI (for AI features)
OPENAI_API_KEY="sk-..."

# Auth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
```

## 📖 Documentation

- [User Guide](docs/USER-GUIDE.md) - How to use the application
- [Features Overview](docs/FEATURES.md) - Detailed feature descriptions
- [API Reference](docs/api/) - API endpoint documentation
- [Deployment Guide](docs/deployment/) - Production deployment

## 🏗️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma |
| Auth | Supabase Auth / NextAuth |
| Editor | TipTap |
| Graph | react-force-graph |
| AI | OpenAI API |
| Icons | Lucide React |

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (workspace)/        # Authenticated routes
│   │   ├── home/           # Dashboard
│   │   ├── pages/[id]/     # Document pages
│   │   ├── graph/          # Knowledge graph
│   │   └── settings/       # Settings pages
│   └── api/                # API routes
├── components/
│   ├── ai/                 # AI chat components
│   ├── editor/             # TipTap editor
│   ├── graph/              # Graph visualization
│   ├── settings/           # Settings components
│   ├── sidebar/            # Sidebar components
│   └── workspace/          # Workspace layout
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
└── types/                  # TypeScript types
```

## 🛠️ Development

```bash
# Run development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## 📝 Recent Updates

### v0.5.0 (2026-02-24)
- ✅ AI Chat with sidebar/floating modes
- ✅ Welcome screen with prompt suggestions
- ✅ Context-aware AI assistance
- ✅ Knowledge Graph search and navigation
- ✅ Local graph sidebar on documents
- ✅ Settings page with full navigation
- ✅ Preferences (theme, language, date format)
- ✅ Notification settings
- ✅ Resizable sidebar
- ✅ Page context menu with delete
- ✅ Auto-naming for new pages

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Notion](https://notion.so) - Inspiration for the UI/UX
- [TipTap](https://tiptap.dev) - Amazing editor framework
- [Vercel](https://vercel.com) - Next.js and hosting
- [OpenAI](https://openai.com) - AI capabilities
