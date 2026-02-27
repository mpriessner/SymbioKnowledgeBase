"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingState = "idle" | "requesting" | "recording" | "stopped" | "error";

export type MicErrorType =
  | "permission-denied"
  | "no-device"
  | "device-in-use"
  | "not-supported"
  | "unknown";

interface UseVoiceRecordingOptions {
  maxDuration?: number; // seconds, default 1800 (30 min)
}

interface UseVoiceRecordingReturn {
  state: RecordingState;
  duration: number;
  audioBlob: Blob | null;
  analyserNode: AnalyserNode | null;
  error: string | null;
  errorType: MicErrorType | null;
  permissionState: PermissionState | "unknown";
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  checkPermission: () => Promise<PermissionState | "unknown">;
}

export function useVoiceRecording(
  options?: UseVoiceRecordingOptions
): UseVoiceRecordingReturn {
  const maxDuration = options?.maxDuration ?? 1800;

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<MicErrorType | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | "unknown">("unknown");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mediaRecorderRef.current = null;
    setAnalyserNode(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const checkPermission = useCallback(async (): Promise<PermissionState | "unknown"> => {
    try {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setPermissionState(result.state);
      // Listen for changes
      result.onchange = () => setPermissionState(result.state);
      return result.state;
    } catch {
      // Firefox doesn't support permissions.query for microphone
      setPermissionState("unknown");
      return "unknown";
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const startRecording = useCallback(async () => {
    if (state === "recording") return;

    setState("requesting");
    setError(null);
    setErrorType(null);
    setAudioBlob(null);
    setDuration(0);
    chunksRef.current = [];

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setErrorType("not-supported");
      setError("Your browser doesn't support audio recording. Try Chrome or Firefox.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      setPermissionState("granted");

      // Set up AudioContext and AnalyserNode for waveform
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAnalyserNode(analyser);

      // Determine mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setState("stopped");
        cleanup();
      };

      recorder.start(1000); // Collect data every second
      setState("recording");

      // Duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);

        if (elapsed >= maxDuration) {
          recorder.stop();
        }
      }, 1000);
    } catch (err) {
      cleanup();
      setState("error");

      if (err instanceof DOMException) {
        switch (err.name) {
          case "NotAllowedError":
            setErrorType("permission-denied");
            setPermissionState("denied");
            setError("Microphone access was denied.");
            break;
          case "NotFoundError":
            setErrorType("no-device");
            setError("No microphone detected. Connect a microphone and try again.");
            break;
          case "NotReadableError":
          case "AbortError":
            setErrorType("device-in-use");
            setError("Microphone is being used by another application. Close it and try again.");
            break;
          default:
            setErrorType("unknown");
            setError("Failed to start recording. Check your microphone.");
        }
      } else {
        setErrorType("unknown");
        setError("Failed to start recording. Check your microphone.");
      }
    }
  }, [state, maxDuration, cleanup, checkPermission]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState("idle");
    setDuration(0);
    setAudioBlob(null);
    setError(null);
    setErrorType(null);
    chunksRef.current = [];
  }, [cleanup]);

  return {
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
    checkPermission,
  };
}
