"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AudioFilters, AudioSort } from "@/types/audio";
import type { ClipWithStarInfo } from "@/components/browse/AudioBrowser";

export interface UseClipFetchingReturn {
  clips: ClipWithStarInfo[];
  setClips: React.Dispatch<React.SetStateAction<ClipWithStarInfo[]>>;
  loading: boolean;
  isFiltering: boolean;
  error: string | null;
  hasInitialLoad: boolean;
  fetchClips: (isFilterChange?: boolean, retryCount?: number) => Promise<void>;
}

export function useClipFetching(
  filters: AudioFilters,
  sort: AudioSort,
  showStarred: boolean,
  showMyUploads: boolean,
  preferencesLoading: boolean,
  preferencesApplied: boolean,
  onRefresh?: () => void,
): UseClipFetchingReturn {
  const [clips, setClips] = useState<ClipWithStarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const hasInitialLoadRef = useRef(false);
  const clipsLengthRef = useRef(clips.length);
  const fetchClipsRef = useRef<typeof fetchClips>();

  useEffect(() => {
    clipsLengthRef.current = clips.length;
  }, [clips.length]);

  const fetchClips = useCallback(async (isFilterChange: boolean = false, retryCount = 0) => {
    if (isFilterChange) {
      setIsFiltering(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.language) params.append("language", filters.language);
      if (filters.speakerGender)
        params.append("speakerGender", filters.speakerGender);
      if (filters.speakerAgeRange)
        params.append("speakerAgeRange", filters.speakerAgeRange);
      if (filters.uploadedBy) params.append("uploadedBy", filters.uploadedBy);
      if (filters.tags && filters.tags.length > 0) {
        params.append("tags", filters.tags.join(","));
      }
      if (filters.speedFilter) {
        params.append("speedFilter", filters.speedFilter);
      }

      if (showStarred) params.append("starred", "true");
      if (showMyUploads) params.append("myUploads", "true");

      params.append("sortField", sort.field);
      params.append("sortDirection", sort.direction);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response: Response;
      try {
        response = await fetch(`/api/clips?${params.toString()}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);

        const errorMessage = fetchError instanceof Error ? fetchError.message : "";
        const errorName = fetchError instanceof Error ? fetchError.name : "";

        if (errorName === 'AbortError' || errorMessage.includes('fetch failed') || errorMessage.includes('network')) {
          if (retryCount < 2) {
            const backoffMs = Math.min(500 * Math.pow(2, retryCount), 2000);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            return fetchClips(isFilterChange, retryCount + 1);
          }
          throw new Error("Connection failed. Please check your internet connection and try again.");
        }
        throw fetchError;
      }

      if (!response.ok) {
        let errorMessage = "Failed to fetch clips";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }

        if (response.status >= 500 && response.status < 600 && retryCount < 2) {
          const backoffMs = Math.min(500 * Math.pow(2, retryCount), 2000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return fetchClips(isFilterChange, retryCount + 1);
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.clips && Array.isArray(data.clips)) {
        setClips(data.clips);
      } else {
        console.warn("Unexpected response format from /api/clips:", data);
        setClips([]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load clips";

      if (clipsLengthRef.current > 0 && isFilterChange) {
        console.warn("Failed to update clips:", errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      if (isFilterChange) {
        setIsFiltering(false);
      } else {
        setLoading(false);
      }
    }
  }, [filters, sort, showStarred, showMyUploads]);

  // Keep fetchClips ref in sync
  useEffect(() => {
    fetchClipsRef.current = fetchClips;
  }, [fetchClips]);

  // Initial load - wait for preferences to load AND be applied first
  useEffect(() => {
    if (hasInitialLoadRef.current || preferencesLoading || !preferencesApplied) return;

    const timeoutId = setTimeout(() => {
      fetchClips(false);
      hasInitialLoadRef.current = true;
      setHasInitialLoad(true);
    }, 50);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferencesLoading, preferencesApplied]);

  // Handle refresh from parent
  useEffect(() => {
    if (onRefresh) {
      const isFilterChange = hasInitialLoadRef.current;
      fetchClips(isFilterChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh]);

  // Watch for filter/sort changes and fetch in background
  useEffect(() => {
    if (!hasInitialLoadRef.current) return;

    const timeoutId = setTimeout(() => {
      if (fetchClipsRef.current) {
        fetchClipsRef.current(true);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, showStarred, showMyUploads]);

  return {
    clips,
    setClips,
    loading,
    isFiltering,
    error,
    hasInitialLoad,
    fetchClips,
  };
}
