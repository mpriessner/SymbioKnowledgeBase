"use client";

import { useState, useCallback, useRef } from "react";
import { Mic, Loader2 } from "lucide-react";
import { VoiceRecorder } from "./VoiceRecorder";
import { AudioFileUpload } from "./AudioFileUpload";
import { TranscriptPreview } from "./TranscriptPreview";
import { StreamingPreview } from "./StreamingPreview";
import { useAIPageGeneration } from "@/hooks/useAIPageGeneration";

const AI_CONFIG_KEY = "skb-ai-config";

function getTranscriptionConfig(): { provider: string; model: string; apiKey?: string } {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(AI_CONFIG_KEY) : null;
    if (!stored) return { provider: "openai-whisper", model: "whisper-1" };
    const config = JSON.parse(stored);
    const provider = config.transcriptionProvider || "openai-whisper";
    const model = config.transcriptionModel || "whisper-1";

    let apiKey: string | undefined;
    if (provider === "openai-whisper" && config.useSharedTranscriptionKey !== false) {
      apiKey = config.openaiKey;
    } else {
      apiKey = config.transcriptionApiKey;
    }

    return { provider, model, apiKey };
  } catch {
    return { provider: "openai-whisper", model: "whisper-1" };
  }
}

interface MeetingNotesGeneratorProps {
  pageId: string;
  onComplete: (markdown: string) => void;
  onCancel: () => void;
}

type Stage = "recording" | "transcribing" | "reviewing" | "generating";

function formatDurationForPrompt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MeetingNotesGenerator({
  pageId,
  onComplete,
  onCancel,
}: MeetingNotesGeneratorProps) {
  const [stage, setStage] = useState<Stage>("recording");
  const [transcript, setTranscript] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  const { generate, content, isGenerating, error: genError, cancel, reset } =
    useAIPageGeneration();

  const transcribeAudio = useCallback(
    async (file: Blob, filename: string) => {
      const txConfig = getTranscriptionConfig();
      const formData = new FormData();
      formData.append("file", file, filename);
      formData.append("provider", txConfig.provider);
      formData.append("model", txConfig.model);
      if (txConfig.apiKey) {
        formData.append("apiKey", txConfig.apiKey);
      }

      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Transcription failed");
      }

      const data = await response.json();
      return data.data.text as string;
    },
    []
  );

  const handleRecordingComplete = useCallback(
    async (audioBlob: Blob, duration: number) => {
      setRecordingDuration(duration);
      setStage("transcribing");
      setTranscribeError(null);

      try {
        const text = await transcribeAudio(audioBlob, "recording.webm");
        setTranscript(text);
        setStage("reviewing");
      } catch (err) {
        setTranscribeError(
          err instanceof Error ? err.message : "Transcription failed"
        );
        setStage("recording");
      }
    },
    [transcribeAudio]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploadProcessing(true);
      setUploadError(null);
      setTranscribeError(null);

      try {
        const text = await transcribeAudio(file, file.name);
        setTranscript(text);
        setRecordingDuration(0); // Unknown duration for uploaded files
        setStage("reviewing");
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Transcription failed"
        );
      } finally {
        setIsUploadProcessing(false);
      }
    },
    [transcribeAudio]
  );

  const scrollToUpload = useCallback(() => {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleGenerateNotes = useCallback(() => {
    setStage("generating");
    generate(transcript, "meeting-notes", {
      duration: formatDurationForPrompt(recordingDuration),
      date: new Date().toISOString().slice(0, 10),
    });
  }, [transcript, recordingDuration, generate]);

  const handleBackToRecording = useCallback(() => {
    setStage("recording");
    setTranscript("");
    reset();
  }, [reset]);

  // Build the final content with raw transcript appended
  const buildFinalContent = useCallback(() => {
    const rawTranscriptSection = `\n\n---\n\n## Raw Transcript\n\n<details>\n<summary>Click to expand original transcript</summary>\n\n${transcript}\n\n</details>`;
    return content + rawTranscriptSection;
  }, [content, transcript]);

  // When generation is done
  const isDone = stage === "generating" && !isGenerating && content.trim().length > 0;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Mic className="w-4 h-4 text-red-500" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          AI Meeting Notes
        </span>
      </div>

      {/* Stage: Recording */}
      {stage === "recording" && (
        <>
          {transcribeError && (
            <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
              {transcribeError}
            </div>
          )}
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onCancel={onCancel}
            onUploadFallback={scrollToUpload}
          />

          {/* Divider */}
          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px bg-[var(--border-default)]" />
            <span className="text-[10px] text-[var(--text-tertiary)]">or</span>
            <div className="flex-1 h-px bg-[var(--border-default)]" />
          </div>

          {/* File upload */}
          <div ref={uploadSectionRef}>
            <AudioFileUpload
              onFileSelected={handleFileUpload}
              isProcessing={isUploadProcessing}
              error={uploadError ?? undefined}
            />
          </div>
        </>
      )}

      {/* Stage: Transcribing (from recording or file upload) */}
      {(stage === "transcribing" || (stage === "recording" && isUploadProcessing)) && (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-[var(--accent-primary)]" />
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Transcribing audio...
          </p>
        </div>
      )}

      {/* Stage: Reviewing */}
      {stage === "reviewing" && (
        <TranscriptPreview
          transcript={transcript}
          onEdit={setTranscript}
          onGenerate={handleGenerateNotes}
          onBack={handleBackToRecording}
        />
      )}

      {/* Stage: Generating */}
      {stage === "generating" && (
        <div>
          <StreamingPreview
            content={content}
            isStreaming={isGenerating}
            onStop={cancel}
          />

          {/* Raw transcript preview (shown after generation completes) */}
          {isDone && transcript && (
            <details className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <summary className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                Raw Transcript (will be included in saved page)
              </summary>
              <div className="px-3 pb-3 text-xs text-[var(--text-tertiary)] whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {transcript}
              </div>
            </details>
          )}

          {isDone && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={handleBackToRecording}
                className="px-3 py-1.5 text-xs rounded
                  border border-[var(--border-default)]
                  text-[var(--text-secondary)]
                  hover:bg-[var(--bg-hover)] transition-colors"
              >
                Start over
              </button>
              <button
                onClick={() => onComplete(buildFinalContent())}
                className="px-3 py-1.5 text-xs font-medium rounded
                  bg-[var(--accent-primary)] text-white
                  hover:opacity-90 transition-opacity"
              >
                Use these notes
              </button>
            </div>
          )}

          {genError && (
            <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
              {genError}
              <button
                onClick={handleGenerateNotes}
                className="ml-2 font-medium hover:underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
