"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { LANGUAGES } from "@/lib/language";

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
  required?: boolean;
  className?: string;
  /** Map of language name to clip count -- languages with clips sort first by count */
  clipCounts?: Record<string, number>;
}

export function LanguageSelector({
  value,
  onChange,
  required = false,
  className = "",
  clipCounts,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sort languages: those with clips first (by count desc), then rest alphabetically
  const sortedLanguages = useMemo(() => {
    if (!clipCounts) return LANGUAGES;

    const withClips = LANGUAGES.filter(
      (lang) => (clipCounts[lang.name] || 0) > 0,
    ).sort((a, b) => (clipCounts[b.name] || 0) - (clipCounts[a.name] || 0));

    const withoutClips = LANGUAGES.filter(
      (lang) => !(clipCounts[lang.name] || 0),
    ).sort((a, b) => a.name.localeCompare(b.name));

    return [...withClips, ...withoutClips];
  }, [clipCounts]);

  // Filter languages based on search term
  const filteredLanguages = sortedLanguages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.native.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Find selected language object
  const selectedLanguage = LANGUAGES.find((lang) => lang.name === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredLanguages.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredLanguages.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredLanguages.length
        ) {
          handleSelect(filteredLanguages[highlightedIndex].name);
        }
        break;
    }
  };

  const handleSelect = (languageName: string) => {
    onChange(languageName);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
  };

  const displayText = selectedLanguage
    ? `${selectedLanguage.name} (${selectedLanguage.native})`
    : "";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-left flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={displayText ? "text-gray-900" : "text-gray-500"}>
          {displayText || "Select language"}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search languages..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          {/* Language list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredLanguages.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                No languages found
              </div>
            ) : (
              filteredLanguages.map((language, index) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => handleSelect(language.name)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm ${
                    index === highlightedIndex ? "bg-gray-50" : ""
                  } ${
                    selectedLanguage?.code === language.code
                      ? "bg-indigo-50 text-indigo-900"
                      : "text-gray-900"
                  }`}
                  role="option"
                  aria-selected={selectedLanguage?.code === language.code}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {language.name}
                      {clipCounts && clipCounts[language.name] ? (
                        <span className="text-gray-400 font-normal ml-1">
                          ({clipCounts[language.name]})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {language.native}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
