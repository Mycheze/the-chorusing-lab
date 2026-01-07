'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { parseCSVFile, generateExampleTSV, type ParseResult, type CSVRow } from '@/lib/bulk-upload/csv-parser';

interface CSVUploaderProps {
  onParse: (result: ParseResult) => void;
  disabled?: boolean;
}

export function CSVUploader({ onParse, disabled }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'tsv' && extension !== 'txt') {
      setError('Please upload a CSV or TSV file');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();
      const result = parseCSVFile(text);
      
      if (result.errors.length > 0) {
        // Show errors but still allow proceeding if there are valid rows
        const criticalErrors = result.errors.filter(e => e.message.includes('Missing required columns'));
        if (criticalErrors.length > 0) {
          setError(criticalErrors.map(e => e.message).join('; '));
          setIsProcessing(false);
          return;
        }
      }

      if (result.rows.length === 0) {
        setError('No valid rows found in the file');
        setIsProcessing(false);
        return;
      }

      onParse(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDownloadExample = () => {
    const exampleContent = generateExampleTSV();
    const blob = new Blob([exampleContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-upload-example.tsv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          CSV/TSV File *
        </label>
        <button
          type="button"
          onClick={handleDownloadExample}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
          disabled={disabled}
        >
          <Download className="w-4 h-4" />
          Download Example TSV
        </button>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50'
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div>
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-indigo-600 hover:text-indigo-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Choose CSV/TSV file
          </button>
          <p className="text-sm text-gray-500 mt-2">
            CSV or TSV format (auto-detected)
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Required columns: file_name, transcription, title, speaker_gender, speaker_age, language, tags, source_url
            <br />
            Optional: speaker_dialect
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
          Processing file...
        </div>
      )}
    </div>
  );
}
