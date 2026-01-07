'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, FileText, Music, ArrowRight } from 'lucide-react';
import { matchFilesToCSV, type MatchingResult } from '@/lib/bulk-upload/file-matcher';
import type { CSVRow } from '@/lib/bulk-upload/csv-parser';

interface VerificationStepProps {
  csvRows: CSVRow[];
  uploadedFiles: File[];
  onVerified: (matches: MatchingResult) => void;
  onBack: () => void;
}

export function VerificationStep({
  csvRows,
  uploadedFiles,
  onVerified,
  onBack,
}: VerificationStepProps) {
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null);

  useEffect(() => {
    // Perform matching when component mounts or data changes
    const result = matchFilesToCSV(uploadedFiles, csvRows);
    setMatchingResult(result);
  }, [uploadedFiles, csvRows]);

  const handleProceed = () => {
    if (matchingResult) {
      onVerified(matchingResult);
    }
  };

  if (!matchingResult) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const { matches, unmatchedFiles, unmatchedCSVRows } = matchingResult;
  const allMatched = unmatchedFiles.length === 0 && unmatchedCSVRows.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Results</h2>
        <p className="text-sm text-gray-600">
          Review the matching between your CSV entries and uploaded audio files.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">Matched</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{matches.length}</p>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-900">Unmatched Files</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{unmatchedFiles.length}</p>
        </div>
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Unmatched CSV Rows</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">{unmatchedCSVRows.length}</p>
        </div>
      </div>

      {/* Matched entries */}
      {matches.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Matched Entries ({matches.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {matches.map((match, index) => {
              const csvRow = csvRows[match.csvRowIndex];
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md"
                >
                  <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {csvRow.title}
                    </p>
                    <p className="text-xs text-gray-600">
                      CSV: {csvRow.file_name} → File: {match.file.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unmatched files */}
      {unmatchedFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Music className="w-4 h-4 text-yellow-600" />
            Unmatched Audio Files ({unmatchedFiles.length})
          </h3>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800 mb-2">
              These files were uploaded but don&apos;t match any CSV entries:
            </p>
            <ul className="space-y-1">
              {unmatchedFiles.map((file, index) => (
                <li key={index} className="text-sm text-yellow-700">
                  • {file.name}
                </li>
              ))}
            </ul>
            <p className="text-xs text-yellow-600 mt-2">
              You can go back and add matching entries to your CSV, or these files will be ignored.
            </p>
          </div>
        </div>
      )}

      {/* Unmatched CSV rows */}
      {unmatchedCSVRows.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-600" />
            Unmatched CSV Rows ({unmatchedCSVRows.length})
          </h3>
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-sm text-orange-800 mb-2">
              These CSV entries don&apos;t have matching audio files:
            </p>
            <ul className="space-y-1">
              {unmatchedCSVRows.map((rowIndex) => {
                const row = csvRows[rowIndex];
                return (
                  <li key={rowIndex} className="text-sm text-orange-700">
                    • Row {rowIndex + 2}: {row.title} (file_name: {row.file_name})
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-orange-600 mt-2">
              You can go back and upload the missing audio files, or these entries will be skipped.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleProceed}
          disabled={matches.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allMatched ? 'Proceed to Processing' : 'Proceed with Matched Entries Only'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {matches.length === 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">
            No matches found. Please go back and ensure your file names in the CSV match your uploaded audio files.
          </p>
        </div>
      )}
    </div>
  );
}
