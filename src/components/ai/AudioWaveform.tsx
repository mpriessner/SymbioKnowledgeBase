"use client";

import { useRef, useEffect } from "react";

interface AudioWaveformProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  width?: number;
  height?: number;
}

export function AudioWaveform({
  analyserNode,
  isRecording,
  width = 200,
  height = 40,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || !isRecording) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!ctx || !canvas || !analyserNode) return;

      animRef.current = requestAnimationFrame(draw);
      analyserNode.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 24;
      const barWidth = (canvas.width - (barCount - 1) * 2) / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        // Average amplitude for this bar
        let sum = 0;
        for (let j = 0; j < step; j++) {
          const idx = i * step + j;
          if (idx < bufferLength) {
            sum += Math.abs(dataArray[idx] - 128);
          }
        }
        const avg = sum / step;
        const barHeight = Math.max(2, (avg / 128) * canvas.height);

        const x = i * (barWidth + 2);
        const y = (canvas.height - barHeight) / 2;

        // Use CSS custom property color via a fallback
        ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--accent-primary").trim() || "#3b82f6";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1);
        ctx.fill();
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [analyserNode, isRecording]);

  // Clear canvas when not recording
  useEffect(() => {
    if (!isRecording && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block"
      aria-label="Audio waveform visualization"
    />
  );
}
