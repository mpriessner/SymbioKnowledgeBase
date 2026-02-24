# Epic: AI Chat Assistant for SKB

**Objective:** Implement a Notion-style AI chat assistant that provides contextual help, content generation, and document analysis within SymbioKnowledgeBase.

## Overview

Based on Notion AI interface analysis, implement a floating AI chat assistant with:
- Floating popup (bottom-right corner)
- Quick action suggestions
- Free-text chat input
- Context-aware responses (current page, selected text)
- Model selector

---

## Story 1: AI Chat Button & Floating Popup UI

**Priority:** P0 (Foundation)
**Estimate:** 3 points

### Description
Add a floating "AI" button to the bottom-right corner of the workspace that opens a chat popup.

### Acceptance Criteria
- [ ] Floating button appears on all workspace pages
- [ ] Click opens a popup chat window
- [ ] Popup can be minimized/closed
- [ ] Popup persists across page navigation
- [ ] Dark mode support

### Technical Notes
- Component: `src/components/ai/AIChatButton.tsx`
- Component: `src/components/ai/AIChatPopup.tsx`
- Use Radix UI Popover or custom floating div
- Store open/closed state in localStorage

---

## Story 2: Chat Interface & Message History

**Priority:** P0 (Foundation)
**Estimate:** 5 points

### Description
Implement the chat interface with message history, input field, and streaming responses.

### Acceptance Criteria
- [ ] Chat input field with send button
- [ ] Message history display (user & assistant)
- [ ] Streaming response support
- [ ] Auto-scroll to latest message
- [ ] Loading state indicator
- [ ] Session persistence (localStorage or DB)

### Technical Notes
- Component: `src/components/ai/ChatMessages.tsx`
- Component: `src/components/ai/ChatInput.tsx`
- Hook: `src/hooks/useAIChat.ts`
- Use Server-Sent Events for streaming

---

## Story 3: Quick Actions & Suggestions

**Priority:** P1 (Enhancement)
**Estimate:** 3 points

### Description
Add predefined quick action buttons that users can click to perform common AI tasks.

### Acceptance Criteria
- [ ] "Write meeting agenda" quick action
- [ ] "Summarize this page" quick action
- [ ] "Analyze document" quick action
- [ ] "Create task list" quick action
- [ ] Actions auto-fill chat input or execute directly
- [ ] Context-aware suggestions based on current page

### Technical Notes
- Component: `src/components/ai/QuickActions.tsx`
- Define actions in config: `src/lib/ai/quickActions.ts`

---

## Story 4: Backend AI Chat API

**Priority:** P0 (Foundation)
**Estimate:** 5 points

### Description
Create the backend API endpoint for AI chat that connects to LLM providers.

### Acceptance Criteria
- [ ] POST `/api/ai/chat` endpoint
- [ ] Support for OpenAI/Anthropic models
- [ ] Streaming response support
- [ ] Context injection (current page content)
- [ ] Rate limiting per user
- [ ] Error handling

### Technical Notes
- Route: `src/app/api/ai/chat/route.ts`
- Use Vercel AI SDK or direct API calls
- Environment variables for API keys
- Support model selection (gpt-4, claude-3, etc.)

---

## Story 5: Page Context Integration

**Priority:** P1 (Enhancement)
**Estimate:** 3 points

### Description
Allow AI to access and understand the current page content for contextual responses.

### Acceptance Criteria
- [ ] AI can "see" current page title and content
- [ ] Selected text can be sent as context
- [ ] AI can reference page blocks
- [ ] "Summarize this page" works correctly
- [ ] Privacy controls (user can disable)

### Technical Notes
- Extract page content via existing hooks
- Pass as system prompt context
- Limit context size to model limits

---

## Story 6: Model Selector

**Priority:** P2 (Nice-to-have)
**Estimate:** 2 points

### Description
Add ability to switch between AI models (GPT-4, Claude, etc.)

### Acceptance Criteria
- [ ] Dropdown to select model
- [ ] Persist selection per user
- [ ] Show model capabilities/limits
- [ ] "Auto" mode for best model selection

### Technical Notes
- Store in user preferences
- Component: `src/components/ai/ModelSelector.tsx`

---

## Story 7: Sidebar AI Entry

**Priority:** P2 (Nice-to-have)
**Estimate:** 2 points

### Description
Add "AI Assistant" entry to the sidebar for quick access.

### Acceptance Criteria
- [ ] "AI Assistant" item in sidebar
- [ ] Opens chat in sidebar panel (not popup)
- [ ] Can switch between popup and sidebar modes

### Technical Notes
- Integrate with existing sidebar structure
- Share state with floating popup

---

## Implementation Order

1. **Phase 1 (MVP):** Stories 1, 2, 4 - Basic chat functionality
2. **Phase 2 (Context):** Stories 3, 5 - Quick actions and page context
3. **Phase 3 (Polish):** Stories 6, 7 - Model selector and sidebar

## Dependencies

- OpenAI/Anthropic API keys configured
- Vercel AI SDK (optional but recommended)
- Existing auth system for rate limiting

## Files to Create

```
src/
├── components/
│   └── ai/
│       ├── AIChatButton.tsx
│       ├── AIChatPopup.tsx
│       ├── ChatMessages.tsx
│       ├── ChatInput.tsx
│       ├── QuickActions.tsx
│       └── ModelSelector.tsx
├── hooks/
│   └── useAIChat.ts
├── lib/
│   └── ai/
│       ├── quickActions.ts
│       └── providers.ts
└── app/
    └── api/
        └── ai/
            └── chat/
                └── route.ts
```
