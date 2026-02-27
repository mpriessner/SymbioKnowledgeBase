"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileAudio, X, AlertCircle } from "lucide-react";

const ACCEPTED_FORMATS = ".mp3,.wav,.m4a,.ogg,.webm,.mp4";
const ACCEPTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

interface AudioFileUploadProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioFileUpload({
  onFileSelected,
  isProcessing,
  error,
}: AudioFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setValidationError(null);

      // Validate file type
      const isValidType =
        ACCEPTED_MIME_TYPES.some((t) => file.type.startsWith(t.split("/")[0]) && file.type.includes(t.split("/")[1])) ||
        /\.(mp3|wav|m4a|ogg|webm|mp4)$/i.test(file.name);

      if (!isValidType) {
        setValidationError(
          "Unsupported file format. Please use MP3, WAV, M4A, OGG, WebM, or MP4."
        );
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(
          `File too large (${formatFileSize(file.size)}). Maximum size is 25 MB.`
        );
        return;
      }

      if (file.size < 1000) {
        setValidationError("File too small. Please upload an audio file with content.");
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [validateAndSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const displayError = validationError || error;

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
            : displayError
            ? "border-red-500/30 hover:border-red-500/50"
            : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
        } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS}
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />

        {selectedFile && !displayError ? (
          <div className="flex items-center justify-center gap-2">
            <FileAudio className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm text-[var(--text-primary)]">
              {selectedFile.name}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              ({formatFileSize(selectedFile.size)})
            </span>
            {!isProcessing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
              >
                <X className="w-3 h-3 text-[var(--text-tertiary)]" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="w-5 h-5 mx-auto text-[var(--text-tertiary)]" />
            <p className="text-xs text-[var(--text-secondary)]">
              {isDragging
                ? "Drop your audio file here"
                : "Upload audio file"}
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              MP3, WAV, M4A, OGG, WebM, or MP4 — max 25 MB
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {displayError && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}
