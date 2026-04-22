"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import type { AudioClip } from "@/types/audio";

interface UseClipSessionTrackingProps {
  clip: AudioClip;
  isPlaying: boolean;
  onLoop?: () => void;
  onRestart?: () => void;
}

export function useClipSessionTracking({
  clip,
  isPlaying,
  onLoop,
  onRestart,
}: UseClipSessionTrackingProps) {
  const { user, getAuthHeaders } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedRef = useRef(false);
  const accumulatedSecondsRef = useRef(0);
  const loopCountRef = useRef(0);
  const restartCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBatchUpdateRef = useRef(Date.now());
  const sessionStartTimeRef = useRef<Date | null>(null);
  const mountedRef = useRef(true);

  // Stable refs for values used in sendSessionData to avoid dependency churn
  const clipIdRef = useRef(clip.id);
  const clipLanguageRef = useRef(clip.metadata.language);
  const getAuthHeadersRef = useRef(getAuthHeaders);
  const userRef = useRef(user);

  // Keep refs in sync
  useEffect(() => {
    clipIdRef.current = clip.id;
  }, [clip.id]);
  useEffect(() => {
    clipLanguageRef.current = clip.metadata.language;
  }, [clip.metadata.language]);
  useEffect(() => {
    getAuthHeadersRef.current = getAuthHeaders;
  }, [getAuthHeaders]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Track loops (called from parent component)
  const trackLoop = useCallback(() => {
    if (mountedRef.current) {
      loopCountRef.current += 1;
      onLoop?.();
    }
  }, [onLoop]);

  // Track restarts (called from parent component)
  const trackRestart = useCallback(() => {
    if (mountedRef.current) {
      restartCountRef.current += 1;
      onRestart?.();
    }
  }, [onRestart]);

  // Send session data to API
  const sendSessionData = useCallback(
    async (isFinal: boolean = false) => {
      if (
        !userRef.current ||
        !sessionStartedRef.current ||
        accumulatedSecondsRef.current === 0
      ) {
        return;
      }

      const now = new Date().toISOString();
      const sessionData = {
        session_id: sessionIdRef.current,
        clip_id: clipIdRef.current,
        time_seconds: accumulatedSecondsRef.current,
        loop_count: loopCountRef.current,
        restart_count: restartCountRef.current,
        language: clipLanguageRef.current,
        started_at: sessionStartTimeRef.current?.toISOString() || now,
        ended_at: isFinal ? now : null,
      };

      try {
        const response = await fetch("/api/tracking/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeadersRef.current(),
          },
          body: JSON.stringify(sessionData),
          keepalive: isFinal,
        });

        if (!response.ok) {
          console.warn("Failed to track session:", await response.text());
        }
      } catch (error) {
        console.warn("Error tracking session:", error);
      }
    },
    [], // No dependencies — uses only refs
  );

  // Start session when user first starts playing
  useEffect(() => {
    if (!user || !isPlaying || sessionStartedRef.current) {
      return;
    }

    // User just started playing - create session
    sessionIdRef.current = crypto.randomUUID();
    sessionStartedRef.current = true;
    sessionStartTimeRef.current = new Date();
    accumulatedSecondsRef.current = 0;
    loopCountRef.current = 0;
    restartCountRef.current = 0;
    lastBatchUpdateRef.current = Date.now();
  }, [user, isPlaying]);

  // Track playback time - increment counter every second when playing
  useEffect(() => {
    if (!sessionStartedRef.current || !isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Set up interval to accumulate seconds while playing
    intervalRef.current = setInterval(() => {
      if (mountedRef.current && isPlaying) {
        accumulatedSecondsRef.current += 1;

        // Batch update every 15 seconds
        const timeSinceLastBatch = Date.now() - lastBatchUpdateRef.current;
        if (timeSinceLastBatch >= 15000) {
          sendSessionData(false);
          lastBatchUpdateRef.current = Date.now();
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, sendSessionData]);

  // Cleanup on unmount - send final session data
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Send final session data with keepalive to survive unmount
      if (sessionStartedRef.current && accumulatedSecondsRef.current > 0) {
        sendSessionData(true);
      }
    };
  }, [sendSessionData]);

  return {
    trackLoop,
    trackRestart,
  };
}
