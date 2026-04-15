"use client";

import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Star,
  Upload,
  Info,
} from "lucide-react";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import type { AudioFilters, AudioSort } from "@/types/audio";

interface FilterPanelProps {
  filters: AudioFilters;
  sort: AudioSort;
  searchTerm: string;
  showFilters: boolean;
  showStarred: boolean;
  showMyUploads: boolean;
  availableDialects: string[];
  loadingDialects: boolean;
  hasUser: boolean;
  onFilterChange: (key: keyof AudioFilters, value: string | string[] | undefined) => void;
  onLanguageFilterChange: (language: string) => void;
  onSortChange: (field: AudioSort["field"]) => void;
  onSearchChange: (term: string) => void;
  onShowStarredChange: (value: boolean) => void;
  onShowMyUploadsChange: (value: boolean) => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
}

export function FilterPanel({
  filters,
  sort,
  searchTerm,
  showFilters,
  showStarred,
  showMyUploads,
  availableDialects,
  loadingDialects,
  hasUser,
  onFilterChange,
  onLanguageFilterChange,
  onSortChange,
  onSearchChange,
  onShowStarredChange,
  onShowMyUploadsChange,
  onToggleFilters,
  onClearFilters,
}: FilterPanelProps) {
  return (
    <>
      {/* Quick Filters */}
      {hasUser && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onShowStarredChange(!showStarred)}
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
            onClick={() => onShowMyUploadsChange(!showMyUploads)}
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
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search clips, languages, tags, or transcripts..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={onToggleFilters}
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
                onChange={onLanguageFilterChange}
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
                  onFilterChange(
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
                  onFilterChange(
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
                        Don&apos;t see your target dialect? That&apos;s because no one has added clips for it yet! You can be the first.
                        <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                </div>
              </label>
              <select
                value={filters.speakerDialect || ""}
                onChange={(e) =>
                  onFilterChange(
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Speech Speed
              </label>
              <select
                value={filters.speedFilter || ""}
                onChange={(e) =>
                  onFilterChange(
                    "speedFilter",
                    e.target.value || undefined
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Speeds</option>
                <option value="slow">Slow (bottom 33%)</option>
                <option value="medium">Medium (middle 33%)</option>
                <option value="fast">Fast (top 33%)</option>
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end">
              <button
                onClick={onClearFilters}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2 text-sm flex-wrap">
        <span className="text-gray-600">Sort by:</span>
        {([
          { field: "voteScore" as const, label: "Vote Score (Best First)" },
          { field: "difficulty" as const, label: "Difficulty (Easiest First)" },
          { field: "charactersPerSecond" as const, label: "Speed (Slowest First)" },
          { field: "title" as const, label: "Title" },
          { field: "duration" as const, label: "Duration" },
          { field: "language" as const, label: "Language" },
          { field: "createdAt" as const, label: "Newest First" },
        ] as const).map(
          ({ field, label }) => (
            <button
              key={field}
              onClick={() => onSortChange(field)}
              className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 ${
                sort.field === field
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600"
              }`}
            >
              {label}
              {sort.field === field && (
                sort.direction === "asc" ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )
              )}
            </button>
          )
        )}
      </div>
    </>
  );
}
