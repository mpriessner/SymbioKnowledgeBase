# SKB-35.3: Transcription Provider Settings

**Story ID:** SKB-35.3
**Epic:** [EPIC-35 — AI Meeting Notes Full Workflow](EPIC-35-AI-MEETING-NOTES-FULL-WORKFLOW.md)
**Points:** 5
**Priority:** High
**Status:** Draft

---

## Summary

The transcription step in Meeting Notes is hardcoded to use OpenAI Whisper with the `whisper-1` model. Users should be able to choose their transcription provider and model in the AI settings, just like they can choose their LLM provider for text generation.

---

## Current Problem

**File:** `src/app/api/ai/transcribe/route.ts` (lines 70-83)

```typescript
const transcription = await openaiClient.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",  // ← hardcoded model
  response_format: "text",
});
```

- The model `"whisper-1"` is hardcoded — no way to change it
- Only OpenAI is supported as a transcription provider
- The API key comes from the user's AI config, but the model/provider does not
- `AIConfigSection.tsx` has no transcription settings section — only LLM model selection

**File:** `src/components/settings/AIConfigSection.tsx`

The settings page has provider selection for text generation (OpenAI, Anthropic, Google) but no section for transcription settings. The config structure (`skb-ai-config` in localStorage) includes:
- `provider` (for text generation)
- `model` (for text generation)
- `apiKey` (for text generation)

But nothing for:
- `transcriptionProvider`
- `transcriptionModel`
- `transcriptionApiKey` (if different from the main key)

---

## Acceptance Criteria

- AI Settings page includes a "Transcription" section below the existing LLM settings
- User can select a transcription provider: OpenAI Whisper (default), ElevenLabs, or AssemblyAI
- User can select a transcription model from available models for the chosen provider
- If the transcription provider uses the same API key as the LLM provider, show "Using same API key as above" with an option to override
- If a different API key is needed, a separate input field is shown
- The transcribe API endpoint reads the provider/model from the request (passed by the client) instead of using hardcoded values
- Default is OpenAI Whisper `whisper-1` if no setting is configured (backward compatible)

### Supported Providers

| Provider | Models | API Key Format |
|----------|--------|---------------|
| OpenAI Whisper | `whisper-1` | `sk-...` |
| ElevenLabs | Default STT model | `xi-...` or similar |
| AssemblyAI | `best`, `nano` | AssemblyAI key |

---

## Implementation Approach

### 1. Update AI Config type

Add transcription fields to the config:

```typescript
interface AIConfig {
  // Existing
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  apiKey: string;
  // New
  transcriptionProvider: 'openai-whisper' | 'elevenlabs' | 'assemblyai';
  transcriptionModel: string;
  transcriptionApiKey?: string; // Optional override
}
```

### 2. Add UI to AIConfigSection.tsx

Below the existing LLM settings, add:
- Dropdown for transcription provider
- Dropdown for transcription model (populated based on provider)
- Optional API key field (with toggle "Use same API key as LLM provider")

### 3. Update transcribe endpoint

In `route.ts`, read the provider from the request body/headers:
- If `openai-whisper`: use existing OpenAI code
- If `elevenlabs`: call ElevenLabs Speech-to-Text API
- If `assemblyai`: call AssemblyAI transcription API
- Fall back to `whisper-1` if no provider specified

### 4. Update MeetingNotesGenerator

Pass the transcription provider/model when calling the transcribe endpoint.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/settings/AIConfigSection.tsx` | Add transcription provider/model settings section |
| `src/app/api/ai/transcribe/route.ts` | Read provider/model from request; support multiple providers |
| `src/components/ai/MeetingNotesGenerator.tsx` | Pass transcription config when calling transcribe API |

---

## Do NOT Break

- Existing LLM settings (provider, model, API key)
- Text generation flow (page generation, meeting notes structuring)
- Default Whisper transcription for users who haven't configured settings
- AI config localStorage structure (must be backward compatible)

---

## Test Coverage

**Unit Tests:**
- Default config includes `transcriptionProvider: 'openai-whisper'`
- Settings UI renders transcription section
- Provider dropdown changes update model options

**Integration Tests:**
- Transcribe endpoint uses provider from request body
- Unknown provider falls back to Whisper
- API key override works when specified

**E2E Tests:**
1. Open Settings → AI Configuration
2. Transcription section visible below LLM settings
3. Change transcription provider to ElevenLabs
4. Enter ElevenLabs API key
5. Save settings
6. Start a meeting recording → transcription uses ElevenLabs

---

## Verification Steps

1. Open Settings → AI Configuration
2. Scroll down to the Transcription section
3. Verify: Provider dropdown shows OpenAI Whisper (default), ElevenLabs, AssemblyAI
4. Select OpenAI Whisper → model shows "whisper-1"
5. Save settings
6. Start a meeting notes recording → speak → stop → transcription works with selected provider
7. Change to a different provider → verify it uses the new provider

---

**Last Updated:** 2026-02-27
