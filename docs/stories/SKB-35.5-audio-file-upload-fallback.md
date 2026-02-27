# SKB-35.5: Audio File Upload Fallback

**Story ID:** SKB-35.5
**Epic:** [EPIC-35 — AI Meeting Notes Full Workflow](EPIC-35-AI-MEETING-NOTES-FULL-WORKFLOW.md)
**Points:** 6
**Priority:** Medium
**Status:** Draft

---

## Summary

When the microphone is unavailable (permission denied, no device, corporate security restrictions) or the user has a pre-recorded meeting file (from Zoom, Teams, phone recording), they should be able to upload an audio file for transcription instead of recording in-browser.

---

## Current Behavior

- The only way to get a transcript is to record via the in-browser microphone
- If `getUserMedia()` fails, the user is stuck with an error message and no fallback
- There is no file upload UI anywhere in the Meeting Notes Generator
- The transcribe API (`/api/ai/transcribe`) already accepts a `FormData` with a file — it doesn't require the file to come from a live recording

---

## Acceptance Criteria

- An "Upload audio file" button/area is visible alongside the "Start Recording" button
- Alternatively, show "Upload audio file" as a fallback when microphone access fails
- Accepted file formats: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.webm`, `.mp4` (audio track)
- Maximum file size: 25MB (matches OpenAI Whisper limit)
- If the file exceeds 25MB, show a clear error message with the limit
- After upload, the file is sent to `/api/ai/transcribe` and the flow continues normally (transcript preview → LLM structuring)
- The upload supports drag-and-drop onto the upload area
- A progress indicator shows during upload/transcription
- The uploaded file name is displayed

---

## Implementation Approach

### 1. Create AudioFileUpload component

Create `src/components/ai/AudioFileUpload.tsx`:

```tsx
interface AudioFileUploadProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
  error?: string;
}

function AudioFileUpload({ onFileSelected, isProcessing, error }: AudioFileUploadProps) {
  return (
    <div className="border-2 border-dashed rounded-lg p-6 text-center">
      <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" />
      {/* Drag-and-drop zone */}
      {/* File size validation (25MB max) */}
      {/* Progress indicator */}
    </div>
  );
}
```

### 2. Integrate into MeetingNotesGenerator

Add the upload option to the recording step:

```tsx
{/* Recording step */}
<VoiceRecorder ... />

{/* Divider */}
<div className="flex items-center gap-2 my-4">
  <div className="flex-1 h-px bg-gray-200" />
  <span className="text-xs text-gray-400">or</span>
  <div className="flex-1 h-px bg-gray-200" />
</div>

{/* Upload option */}
<AudioFileUpload onFileSelected={handleFileUpload} />
```

### 3. Handle file upload

When a file is selected:
1. Validate file type and size
2. Create a `FormData` with the file
3. POST to `/api/ai/transcribe` (same endpoint as live recording)
4. Receive transcript text
5. Set the transcript state — from here the flow is identical to live recording

### 4. Update transcribe route

The transcribe endpoint already accepts file uploads via `FormData`. Verify it handles different audio formats correctly. Add format validation if needed.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ai/AudioFileUpload.tsx` | Create — drag-and-drop file upload component |
| `src/components/ai/MeetingNotesGenerator.tsx` | Add AudioFileUpload to recording step; handle file upload flow |
| `src/app/api/ai/transcribe/route.ts` | Verify support for all accepted audio formats |

---

## Do NOT Break

- Live recording flow (VoiceRecorder)
- Transcript preview and editing
- LLM note generation
- File size validation (existing 25MB check)
- API rate limiting

---

## Test Coverage

**Unit Tests:**
- AudioFileUpload accepts correct file types
- Files over 25MB show error message
- Invalid file types rejected
- `onFileSelected` called with valid file

**Integration Tests:**
- Upload .mp3 file → transcription API returns text
- Upload .wav file → transcription API returns text
- Upload too-large file → error displayed (API not called)

**E2E Tests:**
1. Open Meeting Notes Generator
2. Click "Upload audio file"
3. Select a .mp3 file under 25MB
4. File is uploaded and transcribed
5. Transcript appears in the editor
6. Continue with "Generate Notes" → structured notes produced
7. Drag-and-drop a file onto the upload area → same flow

---

## Verification Steps

1. Open AI Meeting Notes
2. Verify: "Upload audio file" option is visible alongside "Start Recording"
3. Click "Upload audio file" → file picker opens
4. Select an audio file (.mp3, .wav, or .m4a)
5. Upload starts → progress indicator shown
6. Transcription completes → transcript appears in the editor
7. Edit transcript if needed
8. Click "Generate Notes" → LLM structures the notes
9. Test drag-and-drop: drag an audio file onto the upload area
10. Test file too large: try uploading a >25MB file → error shown

---

**Last Updated:** 2026-02-27
