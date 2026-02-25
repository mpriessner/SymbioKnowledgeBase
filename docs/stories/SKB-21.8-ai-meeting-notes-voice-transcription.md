# Story SKB-21.8: AI Meeting Notes & Voice Transcription

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.8
**Story Points:** 12 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-21.1 (creation menu), SKB-21.7 (AI generation infrastructure / streaming patterns)

---

## User Story

As a SymbioKnowledgeBase user, I want to record a meeting or voice note via my browser microphone, have it transcribed to text, and then have AI structure it into clean meeting notes with attendees, agenda, discussion points, action items, and decisions, So that I can capture knowledge hands-free and get searchable, structured notes without manual formatting.

---

## Acceptance Criteria

### Voice Recording UI
- [ ] "AI Meeting Notes" button in PageCreationMenu opens a recording panel (inline, not modal)
- [ ] Recording panel shows:
  - A large "Start Recording" button (microphone icon)
  - Recording status: "Ready", "Recording...", "Processing..."
  - Audio waveform visualization while recording (real-time amplitude bars)
  - Elapsed time counter (0:00, 0:01, ...)
  - "Stop" button to end recording
  - "Cancel" to discard and return to creation menu
- [ ] Browser permission prompt for microphone access is triggered on first "Start Recording"
- [ ] If microphone permission denied: show message "Microphone access required. Please allow in browser settings."

### Recording Behavior
- [ ] Recording uses the browser's MediaRecorder API
- [ ] Audio format: WebM/Opus (default for Chrome/Firefox) or fallback to WAV
- [ ] Maximum recording duration: 30 minutes (configurable)
- [ ] Warning at 25 minutes: "Recording will stop in 5 minutes"
- [ ] Auto-stop at 30 minutes with message: "Maximum duration reached"
- [ ] Audio is stored temporarily in memory (Blob) — NOT uploaded to server as a file
- [ ] Recording quality: 16kHz mono (sufficient for speech, smaller file size)

### Transcription Flow
- [ ] After stopping recording, audio is sent to `POST /api/ai/transcribe`
- [ ] The API proxies to OpenAI Whisper API (`/v1/audio/transcriptions`)
- [ ] Transcription model: `whisper-1`
- [ ] Processing indicator: "Transcribing audio..." with spinner
- [ ] Transcribed text appears in a preview area below the recording controls
- [ ] User can review and edit the raw transcript before proceeding
- [ ] "Continue" button sends transcript to the structuring step

### AI Structuring Flow
- [ ] After transcript is ready, clicking "Generate Notes" sends transcript to `POST /api/ai/generate-page`
- [ ] Uses a meeting-notes-specific system prompt that instructs the AI to produce:
  ```
  # [Meeting Title — inferred from content]

  **Date:** [today's date]
  **Duration:** [recording duration]

  ## Attendees
  - [names mentioned, or "Not specified"]

  ## Agenda
  - [topics discussed]

  ## Discussion
  [Organized summary of the conversation]

  ## Action Items
  - [ ] [action item 1 — assigned to X]
  - [ ] [action item 2]

  ## Decisions
  - [decision 1]
  - [decision 2]

  ## Key Takeaways
  - [takeaway 1]
  - [takeaway 2]
  ```
- [ ] AI generation streams in real-time (reuses StreamingPreview from SKB-21.7)
- [ ] Generated content is saved as the page's blocks
- [ ] Page title set from the AI-generated `# heading`
- [ ] Recording panel disappears, BlockEditor shows the structured notes

### Privacy & Security
- [ ] Audio is NEVER saved to the server filesystem or database
- [ ] Audio Blob is transmitted directly to the Whisper API and discarded after transcription
- [ ] The transcribed text is sent to the LLM for structuring, then the raw transcript is discarded
- [ ] Only the final structured notes are persisted (as page blocks)
- [ ] API endpoint requires authentication (session-based)
- [ ] Privacy notice shown before first recording: "Audio is processed via AI and not stored"

### Error Handling
- [ ] Whisper API not configured (no OpenAI key): "Voice transcription requires an OpenAI API key. Configure in Settings > AI."
- [ ] Whisper API error: "Transcription failed. Check your API key or try again."
- [ ] Audio too short (< 1 second): "Recording too short. Please record at least a few seconds."
- [ ] Audio too large (> 25MB — Whisper limit): "Recording too long for transcription. Try recording in shorter segments."
- [ ] Browser doesn't support MediaRecorder: "Your browser doesn't support audio recording. Try Chrome or Firefox."
- [ ] Network error during upload: "Failed to send audio. Check your connection and try again."

### Accessibility
- [ ] All recording controls are keyboard accessible (Space to start/stop)
- [ ] Screen reader announces recording state changes
- [ ] Waveform visualization has aria-label describing audio level

---

## Architecture Overview

```
AI Meeting Notes — Full Pipeline
──────────────────────────────────

Step 1: Record Audio
┌──────────────────────────────────────────────────────────────────┐
│  Browser (VoiceRecorder component)                                │
│                                                                    │
│  navigator.mediaDevices.getUserMedia({ audio: true })             │
│  → MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" }) │
│  → ondataavailable: collect chunks                                │
│  → onstop: combine chunks → audioBlob (Blob)                     │
│                                                                    │
│  Waveform: AnalyserNode → getByteTimeDomainData → canvas bars    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ audioBlob (WebM, ~50KB/min at 16kHz mono)
                           ▼
Step 2: Transcribe
┌──────────────────────────────────────────────────────────────────┐
│  POST /api/ai/transcribe                                          │
│  Content-Type: multipart/form-data                                │
│  body: { file: audioBlob, model: "whisper-1" }                   │
│                                                                    │
│  Server-side:                                                     │
│  1. Validate file size (< 25MB)                                   │
│  2. Forward to OpenAI Whisper API                                 │
│  3. Return: { text: "So today we discussed the new..." }         │
│                                                                    │
│  Note: Audio is NOT saved — just proxied to Whisper and discarded │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ transcript (string)
                           ▼
Step 3: Review & Edit
┌──────────────────────────────────────────────────────────────────┐
│  TranscriptPreview component                                      │
│                                                                    │
│  Shows raw transcript in editable textarea                        │
│  User can fix names, remove filler words, add context             │
│  [Generate Notes] button proceeds to AI structuring               │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ editedTranscript (string)
                           ▼
Step 4: AI Structure
┌──────────────────────────────────────────────────────────────────┐
│  POST /api/ai/generate-page                                       │
│  body: {                                                          │
│    prompt: editedTranscript,                                      │
│    context: "meeting-notes",                                      │
│    metadata: { duration: "14:32", date: "2026-02-25" }           │
│  }                                                                │
│                                                                    │
│  System prompt: meeting-notes-specific (from meeting-notes-prompt)│
│  → AI generates structured notes in markdown                      │
│  → Streamed back as SSE (reuses SKB-21.7 infrastructure)         │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ structured markdown (streamed)
                           ▼
Step 5: Save Page
┌──────────────────────────────────────────────────────────────────┐
│  1. Extract title from "# Meeting Title"                          │
│  2. markdownToTiptap(structuredMarkdown)                         │
│  3. Save blocks to page via API                                   │
│  4. Update page title                                             │
│  5. Recording panel disappears → BlockEditor shows notes          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create useVoiceRecording Hook

**File: `src/hooks/useVoiceRecording.ts`**

```typescript
interface UseVoiceRecordingReturn {
  state: "idle" | "requesting" | "recording" | "stopped" | "error";
  duration: number;          // Seconds elapsed
  audioBlob: Blob | null;    // Recorded audio
  analyserNode: AnalyserNode | null; // For waveform visualization
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

export function useVoiceRecording(options?: {
  maxDuration?: number;       // Default 1800 (30 min)
  sampleRate?: number;        // Default 16000
}): UseVoiceRecordingReturn {
  // State machine:
  // idle → requesting (getUserMedia) → recording → stopped
  //                                  → error (permission denied, etc.)
  //
  // MediaRecorder collects chunks in ondataavailable
  // Timer increments duration every second
  // AnalyserNode connected for waveform data
  // Auto-stop at maxDuration
  // reset() clears audioBlob and returns to idle
}
```

### Step 2: Create VoiceRecorder Component

**File: `src/components/ai/VoiceRecorder.tsx`**

```typescript
interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

// Renders:
// State: idle → big "Start Recording" button with mic icon
// State: recording → waveform bars + timer + "Stop" button
// State: stopped → "Recording complete" + duration
//
// Waveform: <canvas> that draws amplitude bars from analyserNode
// Uses requestAnimationFrame for smooth 60fps animation
```

### Step 3: Create AudioWaveform Component

**File: `src/components/ai/AudioWaveform.tsx`**

```typescript
interface AudioWaveformProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  width: number;
  height: number;
}

// Canvas-based waveform visualization
// Draws vertical bars representing audio amplitude
// Bars animate in real-time during recording
// Uses requestAnimationFrame loop
// Stops animation when isRecording is false
```

### Step 4: Create Transcription API Endpoint

**File: `src/app/api/ai/transcribe/route.ts`**

```typescript
export async function POST(req: NextRequest) {
  // 1. Authenticate user (session)
  // 2. Parse multipart form data to get audio file
  // 3. Validate file size (< 25MB)
  // 4. Validate file is audio (check mime type)
  // 5. Get OpenAI API key from user's AI config
  // 6. Forward to OpenAI Whisper API:
  //    POST https://api.openai.com/v1/audio/transcriptions
  //    form-data: { file: audioBlob, model: "whisper-1", response_format: "text" }
  // 7. Return { text: transcribedText }
  // 8. Audio blob is NOT stored — discarded after forwarding
}
```

### Step 5: Create Meeting Notes System Prompt

**File: `src/lib/ai/meeting-notes-prompt.ts`**

```typescript
export function getMeetingNotesPrompt(metadata: {
  duration: string;
  date: string;
}): string {
  return `You are a meeting notes structurer.
Given a raw meeting transcript, create well-organized meeting notes.

Output format (markdown):
# [Infer a descriptive meeting title from the content]

**Date:** ${metadata.date}
**Duration:** ${metadata.duration}

## Attendees
- [List names mentioned in the transcript, or "Not specified" if none detected]

## Agenda
- [List the main topics that were discussed]

## Discussion
[Organize the conversation into coherent sections. Group related points together.
Use sub-headings (###) for distinct topics if the meeting covered multiple subjects.
Be concise but capture the key points and context.]

## Action Items
- [ ] [action item — assign to person if mentioned]
- [ ] [action item]

## Decisions
- [List any decisions that were made during the meeting]

## Key Takeaways
- [2-4 high-level takeaways from the meeting]

Rules:
- Extract actionable items and tag them as task list checkboxes
- Identify decisions explicitly made during the discussion
- Attribute action items to specific people when names are mentioned
- Remove filler words and verbal tics from the summary
- Keep the discussion section organized and scannable
- If the transcript is unclear or garbled, note "[unclear]" rather than guessing
- Output only markdown. No preamble.`;
}
```

### Step 6: Create MeetingNotesGenerator Component

**File: `src/components/ai/MeetingNotesGenerator.tsx`**

```typescript
interface MeetingNotesGeneratorProps {
  pageId: string;
  onComplete: () => void;
  onCancel: () => void;
}

// Orchestrates the full pipeline:
// 1. VoiceRecorder → audioBlob
// 2. Transcription → transcript text
// 3. TranscriptPreview (editable) → editedTranscript
// 4. AI Generation (via useAIPageGeneration) → structured notes
// 5. Save to page → onComplete()
//
// State machine: recording → transcribing → reviewing → generating → done
```

### Step 7: Create TranscriptPreview Component

**File: `src/components/ai/TranscriptPreview.tsx`**

```typescript
interface TranscriptPreviewProps {
  transcript: string;
  onEdit: (edited: string) => void;
  onGenerate: () => void;
  onBack: () => void; // Go back to recording
}

// Shows the raw transcript in an editable textarea
// "Generate Notes" button to proceed
// "Re-record" button to go back
// Word count indicator
// Helpful tip: "Edit the transcript to fix any errors before generating notes"
```

### Step 8: Wire into PageCreationMenu

**File: `src/components/page/PageCreationMenu.tsx`** (modify)

Replace the "AI Meeting Notes" placeholder:

```typescript
// When "AI Meeting Notes" clicked:
// 1. Set showMeetingNotes = true
// 2. Render MeetingNotesGenerator in place of creation menu
// 3. On complete: refetch page → BlockEditor shows structured notes
// 4. On cancel: return to creation menu
```

---

## Testing Requirements

### Unit Tests (25+ cases)

**File: `src/__tests__/hooks/useVoiceRecording.test.ts`**

- Initial state is "idle" with null audioBlob
- startRecording requests microphone permission
- State changes to "recording" after permission granted
- Duration increments every second during recording
- stopRecording produces a non-null audioBlob
- State changes to "stopped" after stopRecording
- reset() returns to "idle" and clears audioBlob
- Error state when permission denied
- Auto-stops at maxDuration (30 min default)
- Warning callback fires at 25 minutes

**File: `src/__tests__/components/ai/VoiceRecorder.test.tsx`**

- Idle state shows "Start Recording" button
- Recording state shows waveform and timer
- Recording state shows "Stop" button
- Stopped state shows completion message
- Cancel button fires onCancel
- Stop button fires onRecordingComplete with blob and duration

**File: `src/__tests__/components/ai/AudioWaveform.test.tsx`**

- Canvas renders with correct dimensions
- Animation starts when isRecording is true
- Animation stops when isRecording is false

**File: `src/__tests__/components/ai/MeetingNotesGenerator.test.tsx`**

- Initial state shows VoiceRecorder
- After recording: shows "Transcribing..." spinner
- After transcription: shows TranscriptPreview
- After generate: shows StreamingPreview
- Cancel at any stage returns to creation menu
- Privacy notice shown before first recording

**File: `src/__tests__/components/ai/TranscriptPreview.test.tsx`**

- Renders transcript text in textarea
- Textarea is editable
- "Generate Notes" button fires onGenerate
- "Re-record" button fires onBack
- Word count updates as user edits

**File: `src/__tests__/lib/ai/meeting-notes-prompt.test.ts`**

- Prompt includes date and duration metadata
- Prompt requests structured sections (Attendees, Agenda, etc.)
- Prompt instructs task list format for action items

### Integration Tests (10+ cases)

**File: `src/__tests__/integration/meeting-notes.test.tsx`**

- POST /api/ai/transcribe accepts audio file and returns transcript
- POST /api/ai/transcribe validates file size (< 25MB)
- POST /api/ai/transcribe rejects non-audio files
- POST /api/ai/transcribe returns 400 for files < 1 second
- Transcription returns empty string for silence → error handled
- POST /api/ai/generate-page with context="meeting-notes" uses meeting prompt
- Generated meeting notes contain all required sections
- Generated meeting notes have action items as checkboxes
- Page title set from generated heading
- Rate limiting on transcription endpoint

### E2E Tests (4+ cases)

**File: `src/__tests__/e2e/meeting-notes.test.ts`**

- Click "AI Meeting Notes" → recording panel appears → record 5s → stop → transcript appears
- Edit transcript → Generate Notes → structured notes stream in → page populated
- Generated page has sections: Attendees, Agenda, Discussion, Action Items, Decisions
- Cancel during recording → returns to creation menu, no page content saved

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useVoiceRecording.ts` | Create | MediaRecorder hook with state machine |
| `src/components/ai/VoiceRecorder.tsx` | Create | Recording UI with waveform and timer |
| `src/components/ai/AudioWaveform.tsx` | Create | Canvas-based audio amplitude visualization |
| `src/components/ai/MeetingNotesGenerator.tsx` | Create | Full pipeline orchestrator component |
| `src/components/ai/TranscriptPreview.tsx` | Create | Editable transcript review component |
| `src/app/api/ai/transcribe/route.ts` | Create | Whisper API proxy endpoint |
| `src/lib/ai/meeting-notes-prompt.ts` | Create | System prompt for meeting notes structuring |
| `src/components/page/PageCreationMenu.tsx` | Modify | Wire AI Meeting Notes into creation menu |
| `src/__tests__/hooks/useVoiceRecording.test.ts` | Create | Recording hook tests |
| `src/__tests__/components/ai/VoiceRecorder.test.tsx` | Create | Recorder UI tests |
| `src/__tests__/components/ai/AudioWaveform.test.tsx` | Create | Waveform tests |
| `src/__tests__/components/ai/MeetingNotesGenerator.test.tsx` | Create | Generator tests |
| `src/__tests__/components/ai/TranscriptPreview.test.tsx` | Create | Preview tests |
| `src/__tests__/lib/ai/meeting-notes-prompt.test.ts` | Create | Prompt tests |
| `src/__tests__/integration/meeting-notes.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/meeting-notes.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
