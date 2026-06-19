import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { checkRateLimit } from "@/lib/rateLimit";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

/**
 * Allowed model id shape — same character class the AI chat/generate-page routes use.
 * Bounded length keeps a hostile multipart field from carrying arbitrary data.
 */
const MODEL_ID_PATTERN = /^[A-Za-z0-9._\-:]+$/;

/**
 * Validation for the multipart fields (the audio file itself is validated separately).
 * `provider` is an allowlist enum so unknown providers are rejected; `apiKey` is
 * length-bounded; `model` is regex-constrained.
 */
const transcribeFieldsSchema = z.object({
  provider: z.enum(["openai-whisper", "elevenlabs", "assemblyai"]).default("openai-whisper"),
  model: z.string().max(100).regex(MODEL_ID_PATTERN, "Invalid model identifier").default("whisper-1"),
  apiKey: z.string().min(1).max(500).optional(),
});

async function transcribeWithWhisper(file: Blob, apiKey: string, model: string): Promise<string> {
  const whisperForm = new FormData();
  whisperForm.append("file", file, "recording.webm");
  whisperForm.append("model", model);
  whisperForm.append("response_format", "text");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    }
  );

  if (!response.ok) {
    // Status only — never read/log the raw provider error body.
    console.error("[Transcribe] Whisper upstream error: HTTP", response.status);
    throw new Error("Transcription failed. Check your API key or try again.");
  }

  return (await response.text()).trim();
}

async function transcribeWithElevenLabs(file: Blob, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, "recording.webm");
  formData.append("model_id", "scribe_v1");

  const response = await fetch(
    "https://api.elevenlabs.io/v1/speech-to-text",
    {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: formData,
    }
  );

  if (!response.ok) {
    console.error("[Transcribe] ElevenLabs upstream error: HTTP", response.status);
    throw new Error("ElevenLabs transcription failed. Check your API key or try again.");
  }

  const data = await response.json();
  return (data.text || "").trim();
}

async function transcribeWithAssemblyAI(file: Blob, apiKey: string, model: string): Promise<string> {
  // Step 1: Upload audio
  const arrayBuffer = await file.arrayBuffer();
  const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: arrayBuffer,
  });

  if (!uploadResponse.ok) {
    console.error("[Transcribe] AssemblyAI upload error:", uploadResponse.status);
    throw new Error("AssemblyAI upload failed. Check your API key.");
  }

  const { upload_url } = await uploadResponse.json();

  // Step 2: Create transcription
  const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: upload_url,
      speech_model: model === "nano" ? "nano" : "best",
    }),
  });

  if (!transcriptResponse.ok) {
    console.error("[Transcribe] AssemblyAI transcript error:", transcriptResponse.status);
    throw new Error("AssemblyAI transcription failed.");
  }

  const { id } = await transcriptResponse.json();

  // Step 3: Poll for completion
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: apiKey },
    });

    if (!pollResponse.ok) {
      throw new Error("AssemblyAI polling failed.");
    }

    const result = await pollResponse.json();

    if (result.status === "completed") {
      return (result.text || "").trim();
    }
    if (result.status === "error") {
      // Don't propagate the provider's raw error string to the client/logs.
      console.error("[Transcribe] AssemblyAI reported transcription error");
      throw new Error("AssemblyAI transcription failed.");
    }
  }

  throw new Error("AssemblyAI transcription timed out.");
}

export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    if (!checkRateLimit(`ai:transcribe:${ctx.tenantId}`, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS }).allowed) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", undefined, 429);
    }

    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof Blob)) {
        return errorResponse("VALIDATION_ERROR", "No audio file provided", undefined, 400);
      }

      // Validate the string fields (provider allowlist, model regex, bounded apiKey).
      // Empty-string form fields are treated as absent so defaults apply.
      const rawProvider = formData.get("provider");
      const rawModel = formData.get("model");
      const rawApiKey = formData.get("apiKey");
      const parsedFields = transcribeFieldsSchema.safeParse({
        provider: typeof rawProvider === "string" && rawProvider ? rawProvider : undefined,
        model: typeof rawModel === "string" && rawModel ? rawModel : undefined,
        apiKey: typeof rawApiKey === "string" && rawApiKey ? rawApiKey : undefined,
      });
      if (!parsedFields.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid transcription request", undefined, 400);
      }
      const { provider, model, apiKey: clientApiKey } = parsedFields.data;

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Recording too long for transcription. Try recording in shorter segments.",
          undefined,
          400
        );
      }

      // Validate minimum size (~1 second of audio)
      if (file.size < 1000) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Recording too short. Please record at least a few seconds.",
          undefined,
          400
        );
      }

      let text: string;

      switch (provider) {
        case "elevenlabs": {
          const apiKey = clientApiKey;
          if (!apiKey) {
            return errorResponse(
              "CONFIG_ERROR",
              "ElevenLabs API key required. Configure in Settings > AI.",
              undefined,
              503
            );
          }
          text = await transcribeWithElevenLabs(file, apiKey);
          break;
        }
        case "assemblyai": {
          const apiKey = clientApiKey;
          if (!apiKey) {
            return errorResponse(
              "CONFIG_ERROR",
              "AssemblyAI API key required. Configure in Settings > AI.",
              undefined,
              503
            );
          }
          text = await transcribeWithAssemblyAI(file, apiKey, model);
          break;
        }
        case "openai-whisper":
        default: {
          const apiKey = clientApiKey || process.env.OPENAI_API_KEY;
          if (!apiKey) {
            return errorResponse(
              "CONFIG_ERROR",
              "Voice transcription requires an OpenAI API key. Configure in Settings > AI.",
              undefined,
              503
            );
          }
          text = await transcribeWithWhisper(file, apiKey, model || "whisper-1");
          break;
        }
      }

      if (!text) {
        return errorResponse(
          "AI_ERROR",
          "No speech detected in the recording. Try speaking more clearly.",
          undefined,
          422
        );
      }

      return successResponse({ text });
    } catch (error) {
      console.error("[Transcribe] Error:", error);
      if (error instanceof Error && error.message.includes("failed")) {
        return errorResponse("AI_ERROR", error.message, undefined, 502);
      }
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to process audio",
        undefined,
        500
      );
    }
  }
);
