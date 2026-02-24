# Epic 2: Advanced Notion AI Features

**Status:** Ready for Implementation  
**Priority:** High  
**Dependencies:** Epic 1 (AI Chat) must be complete ✅

## Overview
Enhance the AI Chat with Notion-style features including display mode toggle, contextual prompt suggestions, and advanced controls.

---

## Story 5: Sidebar/Floating Mode Toggle

**Points:** 5  
**Files to modify:**
- `src/components/ai/AIChatPopup.tsx`
- `src/components/ai/AIChatButton.tsx`
- `src/hooks/useAIChat.ts` (add mode state)

### Requirements

1. **Add Toggle Control in Chat Header**
   - Dropdown or segmented control with two options: "Sidebar" and "Floating"
   - Show checkmark next to active mode
   - Place in header next to close button

2. **Floating Mode (Current Behavior)**
   - Fixed position bottom-right
   - 400px × 500px dimensions
   - Can be closed/opened with button

3. **Sidebar Mode (New)**
   - Docked to right edge of viewport
   - Full viewport height (minus header if any)
   - Width: 380px
   - Push main content left (don't overlay)
   - Smooth transition animation (300ms)

4. **Persistence**
   - Save mode preference to localStorage key: `symbio-ai-chat-mode`
   - Restore on page load

### Acceptance Criteria
- [ ] Toggle switches between Sidebar and Floating modes
- [ ] Sidebar mode docks to right edge, full height
- [ ] Floating mode shows as popup bottom-right
- [ ] Mode persists across sessions
- [ ] Smooth CSS transition between modes

---

## Story 6: Welcome Screen & Prompt Suggestions

**Points:** 5  
**Files to create:**
- `src/components/ai/AIWelcomeScreen.tsx`
- `src/components/ai/PromptSuggestionCard.tsx`

**Files to modify:**
- `src/components/ai/AIChatPopup.tsx`
- `src/components/ai/ChatMessages.tsx`

### Requirements

1. **Welcome Screen (shown when no messages)**
   - AI avatar/icon at top (sparkles or custom logo)
   - Heading: "Your Symbio AI Assistant"
   - Subtext: "Here are a few things I can do, or ask me anything!"

2. **Prompt Suggestion Cards (4 cards)**
   ```typescript
   const suggestions = [
     { icon: "FileText", text: "Explain this page", prompt: "Can you explain what this page is about?" },
     { icon: "ListTodo", text: "Create a task list", prompt: "Help me create a task list for..." },
     { icon: "FileSearch", text: "Summarize content", prompt: "Summarize the key points of..." },
     { icon: "Calendar", text: "Write meeting notes", prompt: "Help me write meeting notes for..." }
   ];
   ```

3. **Card Behavior**
   - Cards are clickable
   - Click inserts the prompt text into input field
   - Cards disappear after first message is sent
   - Cards have hover effect (slight background change)

4. **Styling**
   - Cards in 2x2 grid layout
   - Each card has icon + text
   - Match dark theme CSS variables
   - Subtle border, rounded corners

### Acceptance Criteria
- [ ] Welcome screen shows when chat is empty
- [ ] 4 suggestion cards displayed in grid
- [ ] Clicking card inserts prompt into input
- [ ] Welcome screen hides after first message
- [ ] Responsive layout (stack on small screens)

---

## Story 7: Chat Controls (New Chat, Minimize, Expand)

**Points:** 3  
**Files to modify:**
- `src/components/ai/AIChatPopup.tsx`
- `src/components/ai/AIChatButton.tsx`

### Requirements

1. **Header Controls (left to right)**
   - "New chat" button with sparkle/plus icon → clears history, shows welcome
   - Title: "Symbio AI"
   - Minimize button (dash icon) → collapses to small button
   - Expand button (expand icon) → toggles large/normal size
   - Close button (X icon) → closes popup

2. **Minimize Behavior**
   - Chat collapses to just the floating button
   - Button shows subtle indicator that chat has content
   - Click button to restore

3. **Expand Behavior**
   - Normal: 400px × 500px
   - Expanded: 600px × 700px (or 80% viewport on small screens)
   - Toggle with expand/collapse icon
   - Save preference to localStorage

### Acceptance Criteria
- [ ] New chat button clears messages and shows welcome
- [ ] Minimize collapses to button only
- [ ] Expand toggles between normal and large sizes
- [ ] All controls have tooltips
- [ ] Keyboard shortcuts (optional): Esc to close

---

## Story 8: Context Awareness

**Points:** 5  
**Files to modify:**
- `src/hooks/useAIChat.ts`
- `src/components/ai/AIChatPopup.tsx`
- `src/app/api/ai/chat/route.ts`

### Requirements

1. **Capture Page Context**
   - Get current route/page title
   - Optionally: extract visible page content (first 2000 chars)
   - Pass as `context` parameter to API

2. **System Prompt Enhancement**
   ```typescript
   const systemPrompt = `You are Symbio AI, a helpful assistant for the SymbioKnowledgeBase.
   The user is currently viewing: ${pageTitle}
   ${pageContent ? `Page content summary: ${pageContent.slice(0, 2000)}` : ''}
   Be helpful, concise, and reference the current page when relevant.`;
   ```

3. **Context Toggle (Optional)**
   - "Auto" button in chat footer
   - Toggle on/off context awareness
   - When off, don't send page context

4. **Visual Indicator**
   - Small badge or text showing "Context: [Page Name]"
   - Helps user know AI is aware of current page

### Acceptance Criteria
- [ ] AI receives current page context
- [ ] AI can reference current page in responses
- [ ] Context can be toggled on/off
- [ ] Works on all workspace pages

---

## Implementation Order

1. **Story 6** (Welcome Screen) - Good visual impact, standalone
2. **Story 5** (Sidebar/Floating) - Core UX improvement
3. **Story 7** (Controls) - Polish and usability
4. **Story 8** (Context) - Advanced feature

## Design Reference

See Notion AI interface for styling inspiration:
- Clean, minimal design
- Subtle shadows and borders
- Consistent with dark/light theme
- Smooth animations (300ms ease)
