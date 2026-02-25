# Story SKB-21.7: Ask AI / AI Page Generation

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.7
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-21.1 (creation menu must exist), existing AI chat backend at `/api/ai/chat`

---

## User Story

As a SymbioKnowledgeBase user, I want to type a prompt like "Create a project plan for launching a mobile app" and have AI generate a complete, well-structured page with headings, lists, and content, So that I can bootstrap new pages in seconds instead of writing from scratch.

---

## Acceptance Criteria

### Ask AI Dialog
- [ ] "Ask AI" button in the PageCreationMenu opens an inline dialog (not a modal — appears below the button area)
- [ ] Dialog contains:
  - A text input with placeholder: "Describe the page you want to create..."
  - A "Generate" button (disabled until input has 3+ characters)
  - A "Cancel" link to dismiss
- [ ] Pressing Enter in the input triggers generation (same as clicking "Generate")
- [ ] Dialog supports light and dark themes

### AI Generation Flow
- [ ] Clicking "Generate" sends the prompt to `POST /api/ai/generate-page`
- [ ] The API streams the response back (Server-Sent Events or chunked response)
- [ ] While generating, the dialog shows:
  - A spinner/loading indicator
  - The streamed content appearing in real-time (like ChatGPT's typing effect)
  - A "Stop" button to cancel generation mid-stream
- [ ] When generation completes:
  - The generated markdown is converted to TipTap JSON
  - The page's blocks are updated with the generated content
  - The page title is auto-set from the first `# heading` in the generated content
  - The creation menu disappears (page now has content)
  - The user can immediately edit the generated content

### API Endpoint
- [ ] `POST /api/ai/generate-page` accepts `{ prompt: string, context?: string }`
- [ ] Uses the user's configured AI provider and model (from Settings > AI Configuration)
- [ ] System prompt instructs the AI to:
  - Generate well-structured markdown with headings, lists, and paragraphs
  - Use `##` and `###` for section headers (not `#` — that becomes the page title)
  - Include practical content, not just outlines
  - Keep output between 500-2000 words unless user specifies otherwise
- [ ] Response is streamed as `text/event-stream` (SSE) with `data:` frames containing markdown chunks
- [ ] Supports the same providers as the existing AI chat: OpenAI, Anthropic, Google
- [ ] Rate limited: max 10 generations per minute per user

### Error Handling
- [ ] If AI API key is not configured: show inline message "Configure your AI provider in Settings"
- [ ] If AI request fails: show error message in the dialog with "Retry" button
- [ ] If generation is cancelled: partial content is discarded, dialog returns to input state
- [ ] Network timeout (30s): show "Generation timed out. Try a simpler prompt."
- [ ] Empty AI response: show "AI returned empty content. Try rephrasing your prompt."

### Prompt Suggestions
- [ ] Below the input, show 3-4 clickable prompt suggestions:
  - "Project plan for..."
  - "Meeting notes template"
  - "Technical design doc for..."
  - "Weekly status report"
- [ ] Clicking a suggestion fills the input with that text (cursor at end for editing)

### Generated Content Quality
- [ ] Generated pages use proper markdown formatting:
  - H2/H3 headings for sections
  - Bullet lists and numbered lists
  - Bold/italic for emphasis
  - Code blocks where appropriate
  - Task lists (checkboxes) where appropriate
- [ ] The AI generates the page title as the first `# heading`
- [ ] Content is relevant to the prompt and well-organized

---

## Architecture Overview

```
Ask AI Page Generation Flow
─────────────────────────────

User types: "Create a project plan for launching a mobile app"
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  AskAIDialog component                                            │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [Describe the page you want to create...        ] [Generate]│  │
│  │                                                              │  │
│  │ Suggestions:                                                 │  │
│  │ [Project plan for...] [Meeting notes] [Design doc] [Report] │  │
│  └────────────────────────────────────────────────────────────┘  │
│        │                                                          │
│        │ User clicks "Generate"                                   │
│        ▼                                                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ POST /api/ai/generate-page                                   │  │
│  │ body: { prompt: "Create a project plan for..." }            │  │
│  │                                                              │  │
│  │ Response: SSE stream                                         │  │
│  │   data: "# Mobile App Launch Plan\n\n"                      │  │
│  │   data: "## Overview\n\nThis project plan outlines..."      │  │
│  │   data: "## Timeline\n\n### Phase 1: Research..."           │  │
│  │   data: [DONE]                                               │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                              │                                    │
│  Stream displayed in real-time while generating                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ # Mobile App Launch Plan                    [Stop]          │  │
│  │                                                              │  │
│  │ ## Overview                                                  │  │
│  │ This project plan outlines the key phases...                │  │
│  │ █ (cursor blinking — still generating)                      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │ Generation complete
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  1. Extract title from first "# heading" → set page.title        │
│  2. Convert markdown → TipTap JSON via markdownToTiptap()        │
│  3. Save blocks to page via PATCH /api/pages/:id/blocks          │
│  4. PageCreationMenu disappears                                   │
│  5. BlockEditor shows generated content (fully editable)          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create AI Page Generation System Prompt

**File: `src/lib/ai/page-generation-prompt.ts`**

```typescript
export const PAGE_GENERATION_SYSTEM_PROMPT = `You are a knowledge base page generator.
Given a user's prompt, generate a well-structured page in markdown format.

Rules:
- Start with a # heading that becomes the page title
- Use ## and ### for sections
- Include practical, detailed content (not just outlines)
- Use bullet lists, numbered lists, and task lists where appropriate
- Use bold and italic for emphasis
- Include code blocks if the topic is technical
- Keep output between 500-2000 words unless the user specifies otherwise
- Be specific and actionable, not generic

Output only the markdown content. No preamble or explanation.`;
```

### Step 2: Create API Endpoint

**File: `src/app/api/ai/generate-page/route.ts`**

```typescript
import { getAIProvider } from "@/lib/ai/providers";

export async function POST(req: NextRequest) {
  // 1. Authenticate user (session-based, not agent API key)
  // 2. Parse { prompt, context? } from body
  // 3. Validate prompt (non-empty, max 1000 chars)
  // 4. Get user's AI config (provider, model, apiKey)
  // 5. Create streaming response:
  //    - Build messages: [system prompt, user prompt]
  //    - Call AI provider with streaming enabled
  //    - Pipe chunks as SSE: "data: {chunk}\n\n"
  //    - End with "data: [DONE]\n\n"
  // 6. Return Response with Content-Type: text/event-stream
}
```

### Step 3: Create useAIPageGeneration Hook

**File: `src/hooks/useAIPageGeneration.ts`**

```typescript
interface UseAIPageGenerationReturn {
  generate: (prompt: string) => void;
  content: string;        // Accumulated generated content (streams in)
  isGenerating: boolean;
  error: string | null;
  cancel: () => void;
}

export function useAIPageGeneration(): UseAIPageGenerationReturn {
  // Uses EventSource or fetch with ReadableStream to consume SSE
  // Accumulates chunks into content string
  // AbortController for cancellation
  // Error handling for network failures, timeouts, empty responses
}
```

### Step 4: Create AskAIDialog Component

**File: `src/components/ai/AskAIDialog.tsx`**

```typescript
interface AskAIDialogProps {
  pageId: string;
  onComplete: () => void; // Called after content is saved
  onCancel: () => void;
}

// States:
// 1. Input: show text input + suggestions
// 2. Generating: show streaming preview + stop button
// 3. Error: show error message + retry button
//
// On complete:
// 1. Extract title from "# heading"
// 2. Update page title via useUpdatePage
// 3. Convert markdown to TipTap JSON
// 4. Save blocks to page
// 5. Call onComplete() to hide menu
```

### Step 5: Create Streaming Preview Component

**File: `src/components/ai/StreamingPreview.tsx`**

```typescript
interface StreamingPreviewProps {
  content: string;     // Markdown content accumulated so far
  isStreaming: boolean;
  onStop: () => void;
}

// Renders markdown content in a scrollable preview area
// Auto-scrolls to bottom as content streams in
// Shows blinking cursor at end while streaming
// "Stop" button at top-right
// Uses a simple markdown renderer (not full TipTap — just for preview)
```

### Step 6: Wire into PageCreationMenu

**File: `src/components/page/PageCreationMenu.tsx`** (modify)

Replace the "Ask AI" placeholder with the actual dialog:

```typescript
// When "Ask AI" is clicked:
// 1. Set showAskAI = true
// 2. Render AskAIDialog in place of the creation menu options
// 3. On complete: refetch page → BlockEditor shows generated content
// 4. On cancel: return to creation menu
```

### Step 7: Update AI Configuration Validation

**File: `src/lib/ai/providers.ts`** (modify if needed)

Ensure the streaming generation uses the same provider abstraction as the existing AI chat. Verify that all three providers (OpenAI, Anthropic, Google) support streaming for this use case.

---

## Testing Requirements

### Unit Tests (15+ cases)

**File: `src/__tests__/components/ai/AskAIDialog.test.tsx`**

- Dialog renders text input and Generate button
- Generate button disabled when input is empty
- Generate button disabled when input has < 3 characters
- Generate button enabled when input has 3+ characters
- Pressing Enter triggers generation
- Cancel link dismisses dialog
- Prompt suggestions render (4 items)
- Clicking suggestion fills input text
- Error state shows error message and Retry button
- Missing AI config shows "Configure in Settings" message

**File: `src/__tests__/hooks/useAIPageGeneration.test.ts`**

- generate() sends POST to /api/ai/generate-page
- Content accumulates as SSE chunks arrive
- isGenerating is true during streaming
- isGenerating becomes false after [DONE]
- cancel() aborts the request
- Error set on network failure
- Error set on timeout (30s)
- Error set on empty response

**File: `src/__tests__/components/ai/StreamingPreview.test.tsx`**

- Preview renders markdown content
- Auto-scrolls to bottom during streaming
- Shows blinking cursor while streaming
- Stop button fires onStop
- No cursor after streaming complete

**File: `src/__tests__/lib/ai/page-generation-prompt.test.ts`**

- System prompt includes markdown formatting rules
- System prompt instructs starting with # heading

### Integration Tests (8+ cases)

**File: `src/__tests__/integration/ai-page-generation.test.tsx`**

- POST /api/ai/generate-page returns SSE stream
- Stream contains valid markdown content
- Generated content has # heading (extracted as title)
- Generated content has ## sections
- Page title updated from generated heading
- Page blocks populated from generated markdown
- Rate limiting: 11th request in 1 minute returns 429
- Invalid prompt (empty) returns 400

### E2E Tests (4+ cases)

**File: `src/__tests__/e2e/ai-page-generation.test.ts`**

- Click "Ask AI" → type prompt → click Generate → content streams in → page populated
- Click suggestion → Generate → content generated from suggestion
- Click Stop during generation → content discarded → back to input
- Generated page: title matches first heading, content is editable

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/ai/page-generation-prompt.ts` | Create | System prompt for page generation |
| `src/app/api/ai/generate-page/route.ts` | Create | SSE streaming endpoint for page generation |
| `src/hooks/useAIPageGeneration.ts` | Create | Hook for consuming SSE stream |
| `src/components/ai/AskAIDialog.tsx` | Create | Prompt input dialog with suggestions |
| `src/components/ai/StreamingPreview.tsx` | Create | Real-time markdown preview during streaming |
| `src/components/page/PageCreationMenu.tsx` | Modify | Wire Ask AI dialog into creation menu |
| `src/__tests__/components/ai/AskAIDialog.test.tsx` | Create | Dialog unit tests |
| `src/__tests__/hooks/useAIPageGeneration.test.ts` | Create | Generation hook tests |
| `src/__tests__/components/ai/StreamingPreview.test.tsx` | Create | Preview unit tests |
| `src/__tests__/integration/ai-page-generation.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/ai-page-generation.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
