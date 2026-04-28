"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { AudioFilters, AudioSort, FilterPreferences } from "@/types/audio";

export interface UseClipFiltersReturn {
  filters: AudioFilters;
  sort: AudioSort;
  searchTerm: string;
  showFilters: boolean;
  showStarred: boolean;
  showMyUploads: boolean;
  availableDialects: string[];
  loadingDialects: boolean;
  preferencesLoading: boolean;
  preferencesApplied: boolean;
  // Refs for latest values (avoids stale closures)
  filtersRef: React.RefObject<AudioFilters>;
  sortRef: React.RefObject<AudioSort>;
  showStarredRef: React.RefObject<boolean>;
  showMyUploadsRef: React.RefObject<boolean>;
  // Setters
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  handleFilterChange: (key: keyof AudioFilters, value: string | string[] | undefined) => void;
  handleLanguageFilterChange: (language: string) => void;
  handleSortChange: (field: AudioSort["field"]) => void;
  handleSearchChange: (term: string) => void;
  handleShowStarredChange: (value: boolean) => void;
  handleShowMyUploadsChange: (value: boolean) => void;
  clearFilters: () => void;
  setSort: React.Dispatch<React.SetStateAction<AudioSort>>;
}

export function useClipFilters(userId?: string): UseClipFiltersReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize state from URL params
  const [filters, setFilters] = useState<AudioFilters>(() => {
    const urlFilters: AudioFilters = {};
    if (!searchParams) return urlFilters;

    const language = searchParams.get("language");
    const speakerGender = searchParams.get("speakerGender");
    const speakerAgeRange = searchParams.get("speakerAgeRange");
    const speakerDialect = searchParams.get("speakerDialect");
    const tags = searchParams.get("tags");
    const speedFilter = searchParams.get("speedFilter");

    if (language) urlFilters.language = language;
    if (speakerGender) urlFilters.speakerGender = speakerGender as AudioFilters["speakerGender"];
    if (speakerAgeRange) urlFilters.speakerAgeRange = speakerAgeRange as AudioFilters["speakerAgeRange"];
    if (speakerDialect) urlFilters.speakerDialect = speakerDialect;
    if (tags) urlFilters.tags = tags.split(",").filter(Boolean);
    if (speedFilter && ["slow", "medium", "fast"].includes(speedFilter)) {
      urlFilters.speedFilter = speedFilter as "slow" | "medium" | "fast";
    }

    return urlFilters;
  });

  const [sort, setSort] = useState<AudioSort>(() => {
    if (!searchParams) return { field: "createdAt", direction: "desc" };

    const field = searchParams.get("sortField") || "createdAt";
    const direction = (searchParams.get("sortDirection") || "desc") as
      | "asc"
      | "desc";
    return { field: field as AudioSort["field"], direction };
  });

  const [searchTerm, setSearchTerm] = useState(
    () => searchParams?.get("search") || ""
  );
  const [showFilters, setShowFilters] = useState(true);
  const [showStarred, setShowStarred] = useState(
    () => searchParams?.get("starred") === "true"
  );
  const [showMyUploads, setShowMyUploads] = useState(
    () => searchParams?.get("myUploads") === "true"
  );

  // Refs to track latest values for debounced updates
  const filtersRef = useRef(filters);
  const sortRef = useRef(sort);
  const showStarredRef = useRef(showStarred);
  const showMyUploadsRef = useRef(showMyUploads);

  // Refs for preference management
  const preferencesLoadedRef = useRef(false);
  const lastSavedPreferencesRef = useRef<FilterPreferences | null>(null);

  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesApplied, setPreferencesApplied] = useState(false);

  // State for available dialects
  const [availableDialects, setAvailableDialects] = useState<string[]>([]);
  const [loadingDialects, setLoadingDialects] = useState(false);

  // Keep refs in sync
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    sortRef.current = sort;
  }, [sort]);

  useEffect(() => {
    showStarredRef.current = showStarred;
  }, [showStarred]);

  useEffect(() => {
    showMyUploadsRef.current = showMyUploads;
  }, [showMyUploads]);

  // Update URL when filters change
  const updateURL = useCallback(
    (
      newFilters: AudioFilters,
      newSort: AudioSort,
      newSearchTerm: string,
      newShowStarred: boolean,
      newShowMyUploads: boolean
    ) => {
      const params = new URLSearchParams();

      if (newFilters.language) params.set("language", newFilters.language);
      if (newFilters.speakerGender)
        params.set("speakerGender", newFilters.speakerGender);
      if (newFilters.speakerAgeRange)
        params.set("speakerAgeRange", newFilters.speakerAgeRange);
      if (newFilters.speakerDialect)
        params.set("speakerDialect", newFilters.speakerDialect);
      if (newFilters.tags && newFilters.tags.length > 0) {
        params.set("tags", newFilters.tags.join(","));
      }
      if (newFilters.speedFilter) {
        params.set("speedFilter", newFilters.speedFilter);
      }

      if (newShowStarred) params.set("starred", "true");
      if (newShowMyUploads) params.set("myUploads", "true");

      params.set("sortField", newSort.field);
      params.set("sortDirection", newSort.direction);

      if (newSearchTerm.trim()) params.set("search", newSearchTerm.trim());

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname]
  );

  // Save preferences when preference filters change (debounced)
  useEffect(() => {
    if (!userId) return;

    const currentPreferences: FilterPreferences = {};
    if (filters.language) {
      currentPreferences.language = filters.language;
    }
    if (filters.speakerGender) {
      currentPreferences.speakerGender = filters.speakerGender;
    }
    if (filters.speakerAgeRange) {
      currentPreferences.speakerAgeRange = filters.speakerAgeRange;
    }
    if (filters.speakerDialect) {
      currentPreferences.speakerDialect = filters.speakerDialect;
    }
    if (filters.speedFilter) {
      currentPreferences.speedFilter = filters.speedFilter;
    }
    currentPreferences.defaultSort = sort;

    const lastSaved = lastSavedPreferencesRef.current;
    const hasChanged =
      !lastSaved ||
      lastSaved.language !== currentPreferences.language ||
      lastSaved.speakerGender !== currentPreferences.speakerGender ||
      lastSaved.speakerAgeRange !== currentPreferences.speakerAgeRange ||
      lastSaved.speakerDialect !== currentPreferences.speakerDialect ||
      lastSaved.speedFilter !== currentPreferences.speedFilter ||
      lastSaved.defaultSort?.field !== currentPreferences.defaultSort?.field ||
      lastSaved.defaultSort?.direction !== currentPreferences.defaultSort?.direction;

    if (!hasChanged) return;

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preferences:
              Object.keys(currentPreferences).length > 0
                ? currentPreferences
                : null,
          }),
        });

        if (response.ok) {
          lastSavedPreferencesRef.current =
            Object.keys(currentPreferences).length > 0
              ? currentPreferences
              : null;
          console.log("✅ Preferences saved:", currentPreferences);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error("Failed to save preferences:", errorData);
        }
      } catch (error) {
        console.error("Failed to save preferences:", error);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [filters.language, filters.speakerGender, filters.speakerAgeRange, filters.speakerDialect, filters.speedFilter, sort, userId]);

  // Fetch available dialects when language changes
  useEffect(() => {
    const language = filters.language;
    if (!language) {
      setAvailableDialects([]);
      return;
    }

    const fetchDialects = async () => {
      setLoadingDialects(true);
      try {
        const response = await fetch(`/api/dialects?language=${encodeURIComponent(language)}`);
        if (response.ok) {
          const data = await response.json();
          setAvailableDialects(data.dialects || []);
        } else {
          setAvailableDialects([]);
        }
      } catch (error) {
        console.error("Failed to fetch dialects:", error);
        setAvailableDialects([]);
      } finally {
        setLoadingDialects(false);
      }
    };

    fetchDialects();
  }, [filters.language]);

  // Reset preferences loaded flag on unmount so returning to /library re-applies them
  useEffect(() => {
    return () => {
      preferencesLoadedRef.current = false;
    };
  }, []);

  // Load user preferences BEFORE initial fetch to avoid flashing
  useEffect(() => {
    if (preferencesLoadedRef.current) return;

    const loadPreferences = async () => {
      setPreferencesLoading(true);
      setPreferencesApplied(false);

      if (!userId) {
        preferencesLoadedRef.current = true;
        setPreferencesApplied(true);
        lastSavedPreferencesRef.current = null;
        setPreferencesLoading(false);
        return;
      }

      const hasUrlPreferenceParams =
        searchParams?.get("language") ||
        searchParams?.get("speakerGender") ||
        searchParams?.get("speakerAgeRange") ||
        searchParams?.get("speakerDialect") ||
        searchParams?.get("speedFilter") ||
        searchParams?.get("sortField");

      try {
        const response = await fetch("/api/user/preferences");

        if (response.ok) {
          const data = await response.json();
          const preferences: FilterPreferences | null = data.preferences;

          if (hasUrlPreferenceParams) {
            lastSavedPreferencesRef.current = preferences;
            setPreferencesApplied(true);
          } else if (preferences) {
            console.log("✅ Loaded preferences:", preferences);

            const newFilters: AudioFilters = {
              ...filtersRef.current,
            };
            if (preferences.language) {
              newFilters.language = preferences.language;
            }
            if (preferences.speakerGender) {
              newFilters.speakerGender = preferences.speakerGender;
            }
            if (preferences.speakerAgeRange) {
              newFilters.speakerAgeRange = preferences.speakerAgeRange;
            }
            if (preferences.speakerDialect) {
              newFilters.speakerDialect = preferences.speakerDialect;
            }
            if (preferences.speedFilter) {
              newFilters.speedFilter = preferences.speedFilter;
            }

            let newSort = sortRef.current;
            if (preferences.defaultSort) {
              newSort = preferences.defaultSort;
              setSort(newSort);
              sortRef.current = newSort;
            }

            setFilters(() => {
              filtersRef.current = newFilters;
              return newFilters;
            });

            updateURL(
              newFilters,
              newSort,
              searchTerm,
              showStarredRef.current,
              showMyUploadsRef.current
            );

            lastSavedPreferencesRef.current = preferences;
            setPreferencesApplied(true);
          } else {
            lastSavedPreferencesRef.current = null;
            setPreferencesApplied(true);
          }
        } else {
          lastSavedPreferencesRef.current = null;
          setPreferencesApplied(true);
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
        lastSavedPreferencesRef.current = null;
        setPreferencesApplied(true);
      } finally {
        preferencesLoadedRef.current = true;
        setPreferencesLoading(false);
      }
    };

    loadPreferences();
  }, [userId, searchParams, updateURL, searchTerm]);

  // Debounce search term URL updates
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateURL(
        filtersRef.current,
        sortRef.current,
        searchTerm,
        showStarredRef.current,
        showMyUploadsRef.current
      );
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, updateURL]);

  const handleFilterChange = useCallback((key: keyof AudioFilters, value: string | string[] | undefined) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      updateURL(newFilters, sortRef.current, searchTerm, showStarredRef.current, showMyUploadsRef.current);
      return newFilters;
    });
  }, [updateURL, searchTerm]);

  const handleLanguageFilterChange = useCallback((language: string) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        language: language || undefined,
        speakerDialect: language ? prev.speakerDialect : undefined
      };
      updateURL(newFilters, sortRef.current, searchTerm, showStarredRef.current, showMyUploadsRef.current);
      return newFilters;
    });
  }, [updateURL, searchTerm]);

  const handleSortChange = useCallback((field: AudioSort["field"]) => {
    setSort((prev) => {
      let newDirection: "asc" | "desc";

      if (prev.field === field) {
        newDirection = prev.direction === "asc" ? "desc" : "asc";
      } else {
        if (field === "voteScore" || field === "createdAt") {
          newDirection = "desc";
        } else {
          newDirection = "asc";
        }
      }

      const newSort: AudioSort = {
        field,
        direction: newDirection,
      };
      updateURL(filtersRef.current, newSort, searchTerm, showStarredRef.current, showMyUploadsRef.current);
      return newSort;
    });
  }, [updateURL, searchTerm]);

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleShowStarredChange = useCallback((value: boolean) => {
    setShowStarred(value);
    updateURL(filtersRef.current, sortRef.current, searchTerm, value, showMyUploadsRef.current);
  }, [updateURL, searchTerm]);

  const handleShowMyUploadsChange = useCallback((value: boolean) => {
    setShowMyUploads(value);
    updateURL(filtersRef.current, sortRef.current, searchTerm, showStarredRef.current, value);
  }, [updateURL, searchTerm]);

  const clearFilters = useCallback(() => {
    const emptyFilters: AudioFilters = {};
    const defaultSort: AudioSort = { field: "createdAt", direction: "desc" };
    setFilters(emptyFilters);
    setSearchTerm("");
    setShowStarred(false);
    setShowMyUploads(false);
    updateURL(emptyFilters, defaultSort, "", false, false);
  }, [updateURL]);

  return {
    filters,
    sort,
    searchTerm,
    showFilters,
    showStarred,
    showMyUploads,
    availableDialects,
    loadingDialects,
    preferencesLoading,
    preferencesApplied,
    filtersRef,
    sortRef,
    showStarredRef,
    showMyUploadsRef,
    setShowFilters,
    handleFilterChange,
    handleLanguageFilterChange,
    handleSortChange,
    handleSearchChange,
    handleShowStarredChange,
    handleShowMyUploadsChange,
    clearFilters,
    setSort,
  };
}
