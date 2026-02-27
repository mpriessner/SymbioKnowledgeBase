# Epic 35: AI Meeting Notes — Full Workflow & Transcription Settings

**Epic ID:** EPIC-35
**Created:** 2026-02-27
**Total Story Points:** 26
**Priority:** High
**Status:** Draft

---

## Epic Overview

The AI Meeting Notes feature is partially built but has several issues preventing it from working end-to-end:

1. **Sidebar button creates a blank page** instead of opening the Meeting Notes Generator workflow
2. **Microphone permission UX is poor** — no clear prompt, no recovery path when permission is denied, no guidance for the user
3. **Transcription provider is hardcoded** — always uses OpenAI Whisper ("whisper-1") with no way to choose a provider or model in settings
4. **Workflow gaps** — the raw transcript is shown during editing but not included in the final generated page; the LLM structuring step works but the connection is fragile
5. **No audio file upload fallback** — if the microphone is unavailable or the user has a pre-recorded file, there's no way to upload it

**Current architecture (partially working):**
```
Sidebar "AI Meeting Notes" → creates blank page (BUG)
                                          ↓ (should be)
                              MeetingNotesGenerator.tsx
                                     ↓
                              VoiceRecorder.tsx
                              (useVoiceRecording hook)
                                     ↓
                              POST /api/ai/transcribe
                              (OpenAI Whisper, hardcoded)
                                     ↓
                              TranscriptPreview.tsx
                              (edit raw transcript)
                                     ↓
                              POST /api/ai/generate-page
                              (LLM structures notes)
                                     ↓
                              StreamingPreview.tsx
                              (live generation display)
                                     ↓
                              Final page created
                              (raw transcript NOT included)
```

---

## Business Value

- **Meeting notes** are a core productivity workflow — record a meeting, get structured notes automatically
- **Microphone issues** block the entire feature — users see "Microphone access required" with no next steps
- **Transcription flexibility** — different users have different providers; some have Whisper keys, others prefer ElevenLabs or other services
- **Audio upload** — users who record meetings externally (phone, Zoom recording) need to upload files instead of recording in-browser
- **Raw transcript** — users need the original transcript alongside the structured notes for reference and compliance

---

## Stories

| ID | Story | Points | Priority | File |
|----|-------|--------|----------|------|
| SKB-35.1 | Fix Sidebar AI Meeting Notes Button | 2 | Critical | [SKB-35.1](SKB-35.1-fix-sidebar-ai-meeting-notes-button.md) |
| SKB-35.2 | Microphone Permission UX | 5 | High | [SKB-35.2](SKB-35.2-microphone-permission-ux.md) |
| SKB-35.3 | Transcription Provider Settings | 5 | High | [SKB-35.3](SKB-35.3-transcription-provider-settings.md) |
| SKB-35.4 | Complete Meeting Notes Workflow | 8 | High | [SKB-35.4](SKB-35.4-complete-meeting-notes-workflow.md) |
| SKB-35.5 | Audio File Upload Fallback | 6 | Medium | [SKB-35.5](SKB-35.5-audio-file-upload-fallback.md) |

---

## Implementation Order

```
35.1 must be done first (unblocks the feature entirely).
35.2 and 35.3 can run in parallel (independent concerns).
35.4 depends on 35.1 + 35.3.
35.5 can run after 35.2 (shares mic permission logic).

┌──────┐
│ 35.1 │ ← First (unblocks everything)
│Button│
│ Fix  │
└──┬───┘
   │
   ├──────────┐
   │          │
┌──┴───┐  ┌──┴───┐
│ 35.2 │  │ 35.3 │  ← Parallel
│ Mic  │  │Trans │
│ UX   │  │ cfg  │
└──┬───┘  └──┬───┘
   │          │
   │       ┌──┴───┐
   │       │ 35.4 │  ← After 35.1 + 35.3
   │       │ Full │
   │       │ Flow │
   │       └──────┘
┌──┴───┐
│ 35.5 │  ← After 35.2
│Upload│
│Fallbk│
└──────┘
```

---

## Shared Constraints

- **No Breaking Changes:** The existing AI chat, page generation, and settings flows must continue working
- **API Key Security:** Transcription API keys stored in localStorage (same as existing AI config pattern, with security notice)
- **Error Handling:** Every step must have clear error messages and recovery paths
- **Loading States:** Show progress indicators during transcription and generation (both can take 10-30 seconds)
- **File Size Limits:** Audio files limited to 25MB (OpenAI Whisper limit); show clear error if exceeded

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 35.1 | Sidebar button opens MeetingNotesGenerator (not blank page) | Page created with correct meeting-notes type | Click "AI Meeting Notes" in sidebar → MeetingNotesGenerator appears |
| 35.2 | Permission states render correctly; retry button visible on denial | `getUserMedia()` called; error messages match permission state | Deny mic → see guidance; allow mic → recording starts |
| 35.3 | AI config includes transcription section; model selection works | Transcribe endpoint reads provider from config; correct API called | Change transcription provider in settings → transcription uses new provider |
| 35.4 | Raw transcript included in final output; all steps complete | Full flow: record → transcribe → edit → generate → page created | Record meeting → structured notes page created with raw transcript section |
| 35.5 | File upload input accepts audio formats; file sent to transcribe API | Upload .mp3 → transcription returned | Upload audio file → transcription → structured notes |

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/components/workspace/Sidebar.tsx` | Modify | Fix "AI Meeting Notes" button to open MeetingNotesGenerator |
| `src/hooks/useVoiceRecording.ts` | Modify | Improve error handling, permission state tracking |
| `src/components/ai/VoiceRecorder.tsx` | Modify | Add permission UX, guidance text, retry button |
| `src/components/ai/MeetingNotesGenerator.tsx` | Modify | Add file upload option; include raw transcript in output |
| `src/app/api/ai/transcribe/route.ts` | Modify | Support configurable provider/model |
| `src/components/settings/AIConfigSection.tsx` | Modify | Add transcription provider/model settings |
| `src/lib/ai/meeting-notes-prompt.ts` | Modify | Include raw transcript section in prompt |
| `src/components/ai/AudioFileUpload.tsx` | Create | File upload component for audio files |

---

**Last Updated:** 2026-02-27
