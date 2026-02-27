# SKB-35.2: Microphone Permission UX

**Story ID:** SKB-35.2
**Epic:** [EPIC-35 — AI Meeting Notes Full Workflow](EPIC-35-AI-MEETING-NOTES-FULL-WORKFLOW.md)
**Points:** 5
**Priority:** High
**Status:** Draft

---

## Summary

When the user clicks "Start Recording" for AI Meeting Notes, the microphone permission flow is confusing. If the browser blocks microphone access (previously denied, no microphone device, or user clicks "Block"), the error message "Microphone access required" appears with no guidance on how to fix it. The user needs clear instructions, a retry mechanism, and a fallback path.

---

## Current Problem

**File:** `src/hooks/useVoiceRecording.ts` (lines 59-138)

The hook calls `navigator.mediaDevices.getUserMedia()` in `startRecording()`. If it fails:
- Line 133: `setError("Microphone access required. Please allow microphone access and try again.")`
- No differentiation between "denied", "not found", "not supported", or "in use"
- No retry button — the user must refresh the page
- No guidance on how to reset browser permissions
- Browsers cache microphone denials — once denied, `getUserMedia()` throws immediately without re-prompting

**File:** `src/components/ai/VoiceRecorder.tsx` (lines 49-59)

The mic button calls `startRecording()` but doesn't handle the different failure states:
- If permission was previously denied, clicking the button does nothing useful
- The error text is generic and unhelpful

---

## Acceptance Criteria

- When microphone permission is requested, a clear message explains why it's needed ("Allow microphone access to record your meeting")
- If permission is **denied by the user**: Show specific instructions for re-enabling mic access in the browser (Chrome: click lock icon in URL bar → Site settings → Microphone → Allow)
- If permission was **previously denied** (cached): Detect this state and show instructions immediately (don't make the user click Start and fail)
- If **no microphone device** is found: Show "No microphone detected. Connect a microphone and try again."
- If **microphone is in use** by another app: Show "Microphone is being used by another application."
- A "Try Again" button is always available to re-attempt `getUserMedia()`
- A "Use audio file instead" link is visible as a fallback (links to SKB-35.5)
- All error states have clear, actionable guidance

---

## Implementation Approach

### 1. Detect permission state proactively

Before showing the recording UI, check the permission state:

```typescript
// In useVoiceRecording.ts or a new useMediaPermission hook
const checkMicPermission = async () => {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state; // "granted" | "denied" | "prompt"
  } catch {
    return "unknown"; // Firefox doesn't support permissions.query for microphone
  }
};
```

### 2. Differentiate error types

In the `catch` block of `startRecording()`:

```typescript
catch (err) {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        setError('permission-denied');
        break;
      case 'NotFoundError':
        setError('no-device');
        break;
      case 'NotReadableError':
        setError('device-in-use');
        break;
      default:
        setError('unknown');
    }
  }
}
```

### 3. Render contextual error messages

In `VoiceRecorder.tsx`, show different UI based on error type:

- **permission-denied**: Instructions with browser-specific screenshot for re-enabling
- **no-device**: "Connect a microphone" message with retry button
- **device-in-use**: "Close other apps using the microphone" with retry button
- All states: "Or upload an audio file instead" link

### 4. Safari/Firefox compatibility

- Safari uses `webkitAudioContext` — add fallback in `useVoiceRecording.ts` line 87
- Firefox doesn't support `navigator.permissions.query({ name: 'microphone' })` — handle gracefully

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useVoiceRecording.ts` | Differentiate error types (NotAllowedError, NotFoundError, NotReadableError); add `checkPermission()` method; fix Safari AudioContext compatibility |
| `src/components/ai/VoiceRecorder.tsx` | Render contextual error messages with instructions; add "Try Again" button; add "Upload file instead" link |

---

## Do NOT Break

- Successful recording flow (permission granted → record → stop → get blob)
- Audio quality settings (16kHz, mono, echo cancellation)
- Duration tracking and max duration limit
- Timer display during recording
- Stop recording functionality
- Data collection via MediaRecorder

---

## Test Coverage

**Unit Tests:**
- `useVoiceRecording`: `NotAllowedError` → `error === "permission-denied"`
- `useVoiceRecording`: `NotFoundError` → `error === "no-device"`
- `useVoiceRecording`: `NotReadableError` → `error === "device-in-use"`
- `VoiceRecorder`: Each error state renders correct guidance text
- `VoiceRecorder`: "Try Again" button visible in all error states

**Integration Tests:**
- Mock `getUserMedia` to throw `NotAllowedError` → correct error UI shown
- Click "Try Again" → `getUserMedia` called again

**E2E Tests:**
1. Open Meeting Notes Generator
2. Block microphone access → see "Permission denied" with browser instructions
3. Click "Try Again" → re-prompted (if possible) or same instructions
4. "Upload file instead" link is visible and clickable

---

## Verification Steps

1. Open AI Meeting Notes
2. Click "Start Recording"
3. In the browser permission prompt, click "Block"
4. Verify: Error message shows specific instructions for re-enabling the microphone
5. Verify: "Try Again" button is visible
6. Verify: "Upload audio file instead" fallback link is visible
7. Open browser settings, re-enable microphone for the site
8. Click "Try Again" — recording starts successfully

---

**Last Updated:** 2026-02-27
