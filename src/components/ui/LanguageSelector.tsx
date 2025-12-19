"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
  required?: boolean;
  className?: string;
}

// Comprehensive language list with English and native names
const LANGUAGES = [
  { code: "af", name: "Afrikaans", native: "Afrikaans" },
  { code: "sq", name: "Albanian", native: "Shqip" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hy", name: "Armenian", native: "Հայերեն" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycan" },
  { code: "eu", name: "Basque", native: "Euskera" },
  { code: "be", name: "Belarusian", native: "Беларуская" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "bs", name: "Bosnian", native: "Bosanski" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "ca", name: "Catalan", native: "Català" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "en", name: "English", native: "English" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "fr", name: "French", native: "Français" },
  { code: "ka", name: "Georgian", native: "ქართული" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "is", name: "Icelandic", native: "Íslenska" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ga", name: "Irish", native: "Gaeilge" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "kk", name: "Kazakh", native: "Қазақ" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "lv", name: "Latvian", native: "Latviešu" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių" },
  { code: "mk", name: "Macedonian", native: "Македонски" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mt", name: "Maltese", native: "Malti" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "mn", name: "Mongolian", native: "Монгол" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "fa", name: "Persian", native: "فارسی" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "sl", name: "Slovenian", native: "Slovenščina" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "cy", name: "Welsh", native: "Cymraeg" },
];

export function LanguageSelector({
  value,
  onChange,
  required = false,
  className = "",
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter languages based on search term
  const filteredLanguages = LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.native.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchTerm.toLowerCase())
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
          prev < filteredLanguages.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredLanguages.length - 1
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
                    <span className="font-medium">{language.name}</span>
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
