"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Search,
  Filter,
  ArrowUpDown,
  Play,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Tag,
  Star,
  Edit,
  Heart,
  Upload,
  Trash2,
  Zap,
  Info,
} from "lucide-react";
import Link from "next/link";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { EditClipModal } from "./EditClipModal";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useAuth } from "@/lib/auth";
import type { AudioClip, AudioFilters, AudioSort, FilterPreferences } from "@/types/audio";

interface AudioBrowserProps {
  onRefresh?: () => void;
}

interface ClipWithStarInfo extends AudioClip {
  url: string;
  starCount: number;
  isStarredByUser: boolean;
}

export function AudioBrowser({ onRefresh }: AudioBrowserProps) {
  const { user, getAuthHeaders } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [clips, setClips] = useState<ClipWithStarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedClip, setExpandedClip] = useState<string | null>(null);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [editingClip, setEditingClip] = useState<ClipWithStarInfo | null>(null);
  const [deletingClip, setDeletingClip] = useState<ClipWithStarInfo | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Initialize state from URL params
  const [filters, setFilters] = useState<AudioFilters>(() => {
    const urlFilters: AudioFilters = {};
    if (!searchParams) return urlFilters;
    
    const language = searchParams.get("language");
    const speakerGender = searchParams.get("speakerGender");
    const speakerAgeRange = searchParams.get("speakerAgeRange");
    const speakerDialect = searchParams.get("speakerDialect");
    const tags = searchParams.get("tags");

    if (language) urlFilters.language = language;
    if (speakerGender) urlFilters.speakerGender = speakerGender as any;
    if (speakerAgeRange) urlFilters.speakerAgeRange = speakerAgeRange as any;
    if (speakerDialect) urlFilters.speakerDialect = speakerDialect;
    if (tags) urlFilters.tags = tags.split(",").filter(Boolean);

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

  // Use refs to track latest values for debounced updates
  const filtersRef = useRef(filters);
  const sortRef = useRef(sort);
  const showStarredRef = useRef(showStarred);
  const showMyUploadsRef = useRef(showMyUploads);
  const fetchClipsRef = useRef<typeof fetchClips>();
  const clipsLengthRef = useRef(clips.length);

  // Refs for preference management
  const preferencesLoadedRef = useRef(false);
  const lastSavedPreferencesRef = useRef<FilterPreferences | null>(null);
  
  // Track if initial load has completed (use state so we can use it in render)
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const hasInitialLoadRef = useRef(false);

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

  useEffect(() => {
    clipsLengthRef.current = clips.length;
  }, [clips.length]);

  // Save preferences when preference filters change (debounced)
  useEffect(() => {
    if (!user) return;
    // Allow saves immediately - if preferences haven't loaded yet, that's fine
    // We'll just overwrite whatever was there before

    // Extract only preference fields
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

    // Check if preferences have changed
    const lastSaved = lastSavedPreferencesRef.current;
    const hasChanged =
      !lastSaved ||
      lastSaved.language !== currentPreferences.language ||
      lastSaved.speakerGender !== currentPreferences.speakerGender ||
      lastSaved.speakerAgeRange !== currentPreferences.speakerAgeRange ||
      lastSaved.speakerDialect !== currentPreferences.speakerDialect;

    if (!hasChanged) return;

    // Debounce save (1.5 seconds, matching search term debounce)
    const timeoutId = setTimeout(async () => {
      try {
        const headers = getAuthHeaders();
        const response = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: {
            ...headers,
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
          // Update last saved preferences
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
        // Silently handle errors - don't break UI
        console.error("Failed to save preferences:", error);
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [filters.language, filters.speakerGender, filters.speakerAgeRange, filters.speakerDialect, user, getAuthHeaders]);

  // Fetch available dialects when language changes
  useEffect(() => {
    if (!filters.language) {
      setAvailableDialects([]);
      return;
    }

    const fetchDialects = async () => {
      setLoadingDialects(true);
      try {
        const response = await fetch(`/api/dialects?language=${encodeURIComponent(filters.language)}`);
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

      // Add filters
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

      // Add special filters
      if (newShowStarred) params.set("starred", "true");
      if (newShowMyUploads) params.set("myUploads", "true");

      // Add sorting
      params.set("sortField", newSort.field);
      params.set("sortDirection", newSort.direction);

      // Add search (only if not empty)
      if (newSearchTerm.trim()) params.set("search", newSearchTerm.trim());

      // Update URL without causing a page reload
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname]
  );

  // Load user preferences on mount (only if no URL params for preference fields)
  useEffect(() => {
    if (preferencesLoadedRef.current) return;
    if (!user) {
      preferencesLoadedRef.current = true; // Mark as loaded even if no user
      return;
    }

    // Check if URL has any preference filter params
    const hasUrlPreferenceParams =
      searchParams?.get("language") ||
      searchParams?.get("speakerGender") ||
      searchParams?.get("speakerAgeRange") ||
      searchParams?.get("speakerDialect");

    // If URL has preference params, still load saved preferences to sync lastSavedPreferencesRef
    // but don't apply them to filters (URL takes precedence)
    if (hasUrlPreferenceParams) {
      // Still load preferences to sync lastSavedPreferencesRef, but don't apply them
      const loadPreferencesForSync = async () => {
        try {
          const headers = getAuthHeaders();
          const response = await fetch("/api/user/preferences", {
            headers,
          });

          if (response.ok) {
            const data = await response.json();
            const preferences: FilterPreferences | null = data.preferences;
            // Sync lastSavedPreferencesRef so saves work correctly
            lastSavedPreferencesRef.current = preferences;
          } else {
            lastSavedPreferencesRef.current = null;
          }
        } catch (error) {
          console.error("Failed to load preferences for sync:", error);
          lastSavedPreferencesRef.current = null;
        } finally {
          preferencesLoadedRef.current = true;
        }
      };

      loadPreferencesForSync();
      return;
    }

    // Load preferences from API
    const loadPreferences = async () => {
      try {
        const headers = getAuthHeaders();
        const response = await fetch("/api/user/preferences", {
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          const preferences: FilterPreferences | null = data.preferences;

          if (preferences) {
            console.log("✅ Loaded preferences:", preferences);
            // Build new filters with preferences applied
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

            // Apply preferences to filters state
            setFilters(newFilters);

            // Update URL to reflect applied preferences (use setTimeout to avoid render warning)
            setTimeout(() => {
              updateURL(
                newFilters,
                sortRef.current,
                searchTerm,
                showStarredRef.current,
                showMyUploadsRef.current
              );
            }, 0);

            // Track last saved preferences
            lastSavedPreferencesRef.current = preferences;
          } else {
            // No preferences saved yet
            lastSavedPreferencesRef.current = null;
          }
        }
      } catch (error) {
        // Silently handle errors - don't break UI
        console.error("Failed to load preferences:", error);
        lastSavedPreferencesRef.current = null;
      } finally {
        preferencesLoadedRef.current = true;
      }
    };

    loadPreferences();
  }, [user, searchParams, getAuthHeaders, updateURL, searchTerm]);

  const fetchClips = useCallback(async (isFilterChange: boolean = false) => {
    // Only set loading: true on initial load, not when filters change
    if (isFilterChange) {
      setIsFiltering(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();

      // Add filters
      if (filters.language) params.append("language", filters.language);
      if (filters.speakerGender)
        params.append("speakerGender", filters.speakerGender);
      if (filters.speakerAgeRange)
        params.append("speakerAgeRange", filters.speakerAgeRange);
      if (filters.uploadedBy) params.append("uploadedBy", filters.uploadedBy);
      if (filters.tags && filters.tags.length > 0) {
        params.append("tags", filters.tags.join(","));
      }

      // Add special filters
      if (showStarred) params.append("starred", "true");
      if (showMyUploads) params.append("myUploads", "true");

      // Add sorting
      params.append("sortField", sort.field);
      params.append("sortDirection", sort.direction);

      const headers: HeadersInit = {
        ...getAuthHeaders(),
      };

      const response = await fetch(`/api/clips?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch clips");
      }

      const data = await response.json();
      setClips(data.clips);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load clips");
    } finally {
      if (isFilterChange) {
        setIsFiltering(false);
      } else {
        setLoading(false);
      }
    }
  }, [filters, sort, showStarred, showMyUploads, getAuthHeaders]);

  // Initial load only - use full-page spinner only if we have no clips
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      fetchClips(false);
      hasInitialLoadRef.current = true;
      setHasInitialLoad(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - fetchClips is stable on first render

  // Handle refresh from parent
  useEffect(() => {
    if (onRefresh) {
      // After initial load, always use background loading for refreshes too
      const isFilterChange = hasInitialLoadRef.current;
      fetchClips(isFilterChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh]); // Use background loading if initial load has completed

  // Keep fetchClips ref in sync
  useEffect(() => {
    fetchClipsRef.current = fetchClips;
  }, [fetchClips]);

  // Watch for filter/sort changes and fetch in background
  // This includes: filters, sort, showStarred, showMyUploads
  useEffect(() => {
    // Skip if initial load hasn't happened yet
    if (!hasInitialLoadRef.current) return;
    
    // ALWAYS use background loading after initial load completes
    // This ensures smooth transitions for ALL filter changes including Starred/My Uploads
    // The only time we show full-page spinner is on the very first mount
    const isFilterChange = true;
    
    // Fetch with isFilterChange=true to show subtle loading indicator
    // Use a timeout to batch rapid filter changes
    const timeoutId = setTimeout(() => {
      if (fetchClipsRef.current) {
        fetchClipsRef.current(isFilterChange);
      }
    }, 0);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, showStarred, showMyUploads]); // All filter changes use background loading

  const handleFilterChange = (key: keyof AudioFilters, value: any) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      updateURL(newFilters, sort, searchTerm, showStarred, showMyUploads);
      // fetchClips will be called by useEffect when filters change
      return newFilters;
    });
  };

  const handleLanguageFilterChange = (language: string) => {
    setFilters((prev) => {
      const newFilters = { 
        ...prev, 
        language: language || undefined,
        // Clear dialect when language changes
        speakerDialect: language ? prev.speakerDialect : undefined
      };
      updateURL(newFilters, sort, searchTerm, showStarred, showMyUploads);
      // fetchClips will be called by useEffect when filters change
      return newFilters;
    });
  };

  const handleSortChange = (field: AudioSort["field"]) => {
    setSort((prev) => {
      const newSort: AudioSort = {
        field,
        direction:
          prev.field === field && prev.direction === "asc"
            ? ("desc" as const)
            : ("asc" as const),
      };
      updateURL(filters, newSort, searchTerm, showStarred, showMyUploads);
      // fetchClips will be called by useEffect when sort changes
      return newSort;
    });
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
  };

  // Debounce search term URL updates (only for search term, other filters update immediately)
  // Use a longer debounce (1.5s) so URL only updates when user has stopped typing
  // This prevents reload-like behavior while still preserving search in URL
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Use refs to get latest values without causing re-renders
      updateURL(
        filtersRef.current,
        sortRef.current,
        searchTerm,
        showStarredRef.current,
        showMyUploadsRef.current
      );
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, updateURL]); // Only debounce search term changes

  const handleShowStarredChange = (value: boolean) => {
    setShowStarred(value);
    updateURL(filters, sort, searchTerm, value, showMyUploads);
    // fetchClips will be called by useEffect when showStarred changes
  };

  const handleShowMyUploadsChange = (value: boolean) => {
    setShowMyUploads(value);
    updateURL(filters, sort, searchTerm, showStarred, value);
    // fetchClips will be called by useEffect when showMyUploads changes
  };

  const toggleExpanded = (clipId: string) => {
    setExpandedClip((prev) => (prev === clipId ? null : clipId));
  };

  const handlePlay = (clipId: string) => {
    setPlayingClip(clipId);
    setExpandedClip(clipId);
  };

  const handleStar = async (clipId: string, isStarred: boolean) => {
    if (!user) return;

    try {
      const method = isStarred ? "DELETE" : "POST";
      const response = await fetch(`/api/clips/${clipId}/star`, {
        method,
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.ok) {
        // Update the clip in the local state
        setClips((prev) =>
          prev.map((clip) =>
            clip.id === clipId
              ? {
                  ...clip,
                  isStarredByUser: !isStarred,
                  starCount: isStarred
                    ? clip.starCount - 1
                    : clip.starCount + 1,
                }
              : clip
          )
        );
      }
    } catch (error) {
      console.error("Failed to star/unstar clip:", error);
    }
  };

  const handleEdit = (clip: ClipWithStarInfo) => {
    setEditingClip(clip);
  };

  const handleDeleteRequest = (clip: ClipWithStarInfo) => {
    setDeletingClip(clip);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user || !deletingClip) return;

    try {
      const response = await fetch(`/api/clips/${deletingClip.id}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.ok) {
        // Remove the clip from local state
        setClips((prev) => prev.filter((clip) => clip.id !== deletingClip.id));
        setDeleteConfirmOpen(false);
        setDeletingClip(null);

        // Close expanded view if this clip was expanded
        if (expandedClip === deletingClip.id) {
          setExpandedClip(null);
        }
        if (playingClip === deletingClip.id) {
          setPlayingClip(null);
        }
      } else {
        const errorData = await response.json();
        console.error("Delete failed:", errorData.error);
        // You could add a toast notification here
      }
    } catch (error) {
      console.error("Failed to delete clip:", error);
      // You could add a toast notification here
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingClip(null);
  };

  const handleEditSuccess = (updatedClip: AudioClip) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === updatedClip.id ? { ...clip, ...updatedClip } : clip
      )
    );
    setEditingClip(null);
  };

  const clearFilters = () => {
    const emptyFilters: AudioFilters = {};
    const defaultSort: AudioSort = { field: "createdAt", direction: "desc" };
    setFilters(emptyFilters);
    setSearchTerm("");
    setShowStarred(false);
    setShowMyUploads(false);
    updateURL(emptyFilters, defaultSort, "", false, false);
  };

  // Filter clips by search term (client-side for simplicity)
  const filteredClips = clips.filter((clip) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      clip.title.toLowerCase().includes(term) ||
      clip.metadata.language.toLowerCase().includes(term) ||
      clip.metadata.tags.some((tag) => tag.toLowerCase().includes(term)) ||
      (clip.metadata.transcript &&
        clip.metadata.transcript.toLowerCase().includes(term))
    );
  });

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Only show full-page spinner on initial load when we have no clips yet
  // After initial load, all changes use background loading (isFiltering state) and clips stay visible
  if (loading && clips.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
        <span className="ml-2 text-gray-600">Loading clips...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Audio Library</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div 
            className={`w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full transition-opacity duration-200 ${
              isFiltering ? 'opacity-100 animate-spin' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
          <span>{filteredClips.length} clips found</span>
        </div>
      </div>

      {/* Quick Filters */}
      {user && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleShowStarredChange(!showStarred)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border ${
              showStarred
                ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Star
              className={`w-4 h-4 ${
                showStarred ? "fill-yellow-400 text-yellow-400" : ""
              }`}
            />
            Starred Clips
          </button>
          <button
            onClick={() => handleShowMyUploadsChange(!showMyUploads)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border ${
              showMyUploads
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Upload className="w-4 h-4" />
            My Uploads
          </button>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search clips, languages, tags, or transcripts..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              showFilters
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <LanguageSelector
                value={filters.language || ""}
                onChange={handleLanguageFilterChange}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Speaker Gender
              </label>
              <select
                value={filters.speakerGender || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "speakerGender",
                    e.target.value || undefined
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age Range
              </label>
              <select
                value={filters.speakerAgeRange || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "speakerAgeRange",
                    e.target.value || undefined
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All ages</option>
                <option value="teen">Teen</option>
                <option value="younger-adult">Younger Adult</option>
                <option value="adult">Adult</option>
                <option value="senior">Senior</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1">
                  Dialect
                  {filters.language && (
                    <div className="relative group">
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded-md shadow-lg">
                        Don't see your target dialect? That's because no one has added clips for it yet! You can be the first.
                        <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                </div>
              </label>
              <select
                value={filters.speakerDialect || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "speakerDialect",
                    e.target.value || undefined
                  )
                }
                disabled={!filters.language || loadingDialects}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingDialects ? "Loading dialects..." : "All Dialects"}
                </option>
                {availableDialects.map((dialect) => (
                  <option key={dialect} value={dialect}>
                    {dialect}
                  </option>
                ))}
              </select>
              {!filters.language && (
                <p className="mt-1 text-xs text-gray-500">
                  Select a language first to choose a dialect
                </p>
              )}
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex gap-2 text-sm">
        <span className="text-gray-600">Sort by:</span>
        {(["title", "duration", "language", "createdAt"] as const).map(
          (field) => (
            <button
              key={field}
              onClick={() => handleSortChange(field)}
              className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 ${
                sort.field === field
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600"
              }`}
            >
              {field === "createdAt"
                ? "Date"
                : field.charAt(0).toUpperCase() + field.slice(1)}
              {sort.field === field && (
                <ArrowUpDown
                  className={`w-3 h-3 ${
                    sort.direction === "desc" ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>
          )
        )}
      </div>

      {/* Clips List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredClips.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-4">🎵</div>
            <p className="text-lg font-medium mb-2">No clips found</p>
            {filters.language ||
            filters.speakerGender ||
            filters.speakerAgeRange ||
            (filters.tags && filters.tags.length > 0) ||
            showStarred ||
            showMyUploads ||
            searchTerm ? (
              <div className="space-y-3">
                <p className="text-sm">
                  There are no clips matching your filters, but you can add some
                  with the Clip Creator!
                </p>
                <Link
                  href="/clip-creator"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium"
                >
                  Go to Clip Creator
                </Link>
              </div>
            ) : (
              <p className="text-sm">
                Try adjusting your search terms or filters
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredClips.map((clip, index) => (
              <div key={clip.id} className="hover:bg-gray-50">
                {/* Clip Header - Now fully clickable */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpanded(clip.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-gray-400 hover:text-gray-600">
                        {expandedClip === clip.id ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {clip.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(clip.duration)}
                          </span>
                          <span>{clip.metadata.language}</span>
                          {clip.metadata.speakerGender && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {clip.metadata.speakerGender}
                            </span>
                          )}
                          <span>{formatDate(clip.createdAt)}</span>
                          {clip.starCount > 0 && (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <Star className="w-3 h-3 fill-current" />
                              {clip.starCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* NEW: Chorus Now Button */}
                      <Link
                        href={`/chorus/${clip.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 text-sm font-medium"
                      >
                        <Zap className="w-4 h-4" />
                        Chorus Now!
                      </Link>

                      {user && (
                        <>
                          <button
                            onClick={() =>
                              handleStar(clip.id, clip.isStarredByUser)
                            }
                            className={`p-2 rounded-md hover:bg-gray-100 ${
                              clip.isStarredByUser
                                ? "text-yellow-500"
                                : "text-gray-400"
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                clip.isStarredByUser ? "fill-current" : ""
                              }`}
                            />
                          </button>
                          {/* Only show edit button for clips uploaded by current user or admins */}
                          {(clip.uploadedBy === user.id || user.isAdmin) && (
                            <button
                              onClick={() => handleEdit(clip)}
                              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {/* Only show delete button for clips uploaded by current user or admins */}
                          {(clip.uploadedBy === user.id || user.isAdmin) && (
                            <button
                              onClick={() => handleDeleteRequest(clip)}
                              className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                              title="Delete clip"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => handlePlay(clip.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        <Play className="w-4 h-4" />
                        Play
                      </button>
                    </div>
                  </div>

                  {/* Quick Info */}
                  {clip.metadata.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <div className="flex gap-1 flex-wrap">
                        {clip.metadata.tags.slice(0, 3).map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {clip.metadata.tags.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{clip.metadata.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedClip === clip.id && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-200 bg-gray-50">
                    {/* Audio Player */}
                    {playingClip === clip.id && (
                      <div className="bg-white rounded-lg p-4 mt-4">
                        <AudioPlayer
                          key={clip.id} // Force new instance for each clip
                          url={clip.url}
                          title={clip.title}
                          showControls={true}
                        />
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          Speaker Info
                        </h4>
                        <div className="space-y-1 text-gray-600">
                          {clip.metadata.speakerGender && (
                            <div>Gender: {clip.metadata.speakerGender}</div>
                          )}
                          {clip.metadata.speakerAgeRange && (
                            <div>
                              Age:{" "}
                              {clip.metadata.speakerAgeRange.replace("-", " ")}
                            </div>
                          )}
                          {clip.metadata.speakerDialect && (
                            <div>Dialect: {clip.metadata.speakerDialect}</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          File Info
                        </h4>
                        <div className="space-y-1 text-gray-600">
                          <div>
                            Size: {(clip.fileSize / 1024).toFixed(1)} KB
                          </div>
                          <div>Original: {clip.originalFilename}</div>
                          <div>Uploaded: {formatDate(clip.createdAt)}</div>
                        </div>
                      </div>
                    </div>

                    {clip.metadata.transcript && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          Transcript
                        </h4>
                        <p className="text-gray-600 bg-white rounded-md p-3">
                          &quot;{clip.metadata.transcript}&quot;
                        </p>
                      </div>
                    )}

                    {clip.metadata.sourceUrl && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          Source
                        </h4>
                        <a
                          href={clip.metadata.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 text-sm break-all"
                        >
                          {clip.metadata.sourceUrl}
                        </a>
                      </div>
                    )}

                    {clip.metadata.tags.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          All Tags
                        </h4>
                        <div className="flex gap-1 flex-wrap">
                          {clip.metadata.tags.map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingClip && (
        <EditClipModal
          clip={editingClip}
          isOpen={!!editingClip}
          onClose={() => setEditingClip(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && deletingClip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Audio Clip
                  </h3>
                  <p className="text-sm text-gray-600">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to delete{" "}
                  <strong>&quot;{deletingClip.title}&quot;</strong>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-800">
                    This will permanently delete the audio file and all its
                    metadata.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Clip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
