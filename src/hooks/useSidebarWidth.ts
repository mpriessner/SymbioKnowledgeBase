"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "symbio-sidebar-width";
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 256;

/**
 * Manages the resizable width of the sidebar with localStorage persistence.
 */
export function useSidebarWidth() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);

  // Load saved width from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
          setWidth(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save width to localStorage
  const saveWidth = useCallback((newWidth: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(newWidth));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Clamp width within bounds
  const clampWidth = useCallback((w: number) => {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
  }, []);

  // Start resizing
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    setIsResizing(true);
  }, [width]);

  // Handle mouse move during resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = clampWidth(startWidthRef.current + delta);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save final width to localStorage
      saveWidth(width);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Prevent text selection while resizing
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, width, clampWidth, saveWidth]);

  // Save width when it changes and we're not actively resizing
  useEffect(() => {
    if (!isResizing) {
      saveWidth(width);
    }
  }, [width, isResizing, saveWidth]);

  return {
    width,
    isResizing,
    startResize,
    MIN_WIDTH,
    MAX_WIDTH,
  };
}
