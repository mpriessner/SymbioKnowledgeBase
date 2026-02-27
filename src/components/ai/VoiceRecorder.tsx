"use client";

import { Mic, Square, AlertTriangle, Upload } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import type { MicErrorType } from "@/hooks/useVoiceRecording";
import { AudioWaveform } from "./AudioWaveform";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  onUploadFallback?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MicErrorGuidance({
  errorType,
  errorMessage,
  onRetry,
  onUploadFallback,
}: {
  errorType: MicErrorType;
  errorMessage: string;
  onRetry: () => void;
  onUploadFallback?: () => void;
}) {
  return (
    <div className="space-y-3 text-left">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
          {errorType === "permission-denied" && (
            <div className="text-[10px] text-[var(--text-tertiary)] space-y-1">
              <p>To re-enable microphone access:</p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1">
                <li>Click the lock/settings icon in your browser&apos;s address bar</li>
                <li>Find &quot;Microphone&quot; in the permissions list</li>
                <li>Change it to &quot;Allow&quot;</li>
                <li>Reload the page and try again</li>
              </ol>
            </div>
          )}
          {errorType === "no-device" && (
            <p className="text-[10px] text-[var(--text-tertiary)]">
              Make sure a microphone is connected and recognized by your system.
            </p>
          )}
          {errorType === "device-in-use" && (
            <p className="text-[10px] text-[var(--text-tertiary)]">
              Close any other apps that may be using your microphone (e.g., Zoom, Teams, FaceTime).
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium rounded-md
            border border-[var(--border-default)] text-[var(--text-primary)]
            hover:bg-[var(--bg-hover)] transition-colors"
        >
          Try again
        </button>
        {onUploadFallback && (
          <button
            onClick={onUploadFallback}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs
              text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Upload className="w-3 h-3" />
            Upload audio file instead
          </button>
        )}
      </div>
    </div>
  );
}

export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  onUploadFallback,
}: VoiceRecorderProps) {
  const {
    state,
    duration,
    audioBlob,
    analyserNode,
    error,
    errorType,
    permissionState,
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

      {/* Permission denied warning (proactive, before user clicks Start) */}
      {state === "idle" && permissionState === "denied" && (
        <div className="mb-4">
          <MicErrorGuidance
            errorType="permission-denied"
            errorMessage="Microphone access was previously denied."
            onRetry={startRecording}
            onUploadFallback={onUploadFallback}
          />
        </div>
      )}

      {/* Idle / Start */}
      {(state === "idle" || state === "requesting") && permissionState !== "denied" && (
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
          Allow microphone access to record your meeting...
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

      {/* Error — contextual guidance */}
      {state === "error" && error && errorType && (
        <MicErrorGuidance
          errorType={errorType}
          errorMessage={error}
          onRetry={reset}
          onUploadFallback={onUploadFallback}
        />
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
