"use client";

import { Mic, Square } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { AudioWaveform } from "./AudioWaveform";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
}: VoiceRecorderProps) {
  const {
    state,
    duration,
    audioBlob,
    analyserNode,
    error,
    startRecording,
    stopRecording,
    reset,
  } = useVoiceRecording();

  // When stopped and blob is ready, notify parent
  if (state === "stopped" && audioBlob) {
    onRecordingComplete(audioBlob, duration);
  }

  return (
    <div className="text-center">
      {/* Privacy notice */}
      {state === "idle" && (
        <p className="text-[10px] text-[var(--text-tertiary)] mb-4">
          Audio is processed via AI and not stored on our servers.
        </p>
      )}

      {/* Idle / Start */}
      {(state === "idle" || state === "requesting") && (
        <button
          onClick={startRecording}
          disabled={state === "requesting"}
          className="mx-auto flex items-center justify-center w-16 h-16 rounded-full
            bg-red-500 text-white hover:bg-red-600
            transition-colors disabled:opacity-50"
          aria-label="Start recording"
        >
          <Mic className="w-7 h-7" />
        </button>
      )}

      {state === "requesting" && (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Requesting microphone access...
        </p>
      )}

      {/* Recording */}
      {state === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Recording... {formatDuration(duration)}
            </span>
          </div>

          <div className="flex justify-center">
            <AudioWaveform
              analyserNode={analyserNode}
              isRecording={true}
              width={200}
              height={40}
            />
          </div>

          {duration >= 1500 && (
            <p className="text-[10px] text-yellow-600">
              Recording will stop in {Math.max(0, 1800 - duration)} seconds
            </p>
          )}

          <button
            onClick={stopRecording}
            className="mx-auto flex items-center justify-center w-12 h-12 rounded-full
              bg-[var(--bg-secondary)] border-2 border-red-500
              text-red-500 hover:bg-red-500/10 transition-colors"
            aria-label="Stop recording"
          >
            <Square className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Error */}
      {state === "error" && error && (
        <div className="space-y-2">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={reset}
            className="text-xs text-[var(--text-secondary)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Cancel */}
      <div className="mt-4">
        <button
          onClick={onCancel}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
