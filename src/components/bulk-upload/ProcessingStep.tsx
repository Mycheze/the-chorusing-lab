'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, ExternalLink, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { CSVRow } from '@/lib/bulk-upload/csv-parser';
import type { FileMatch } from '@/lib/bulk-upload/file-matcher';
import type { AudioClip } from '@/types/audio';

interface ProcessingStepProps {
  matches: FileMatch[];
  csvRows: CSVRow[];
  onComplete: (clips: AudioClip[]) => void;
  onBack: () => void;
}

type ProcessingStatus = 'pending' | 'processing' | 'success' | 'error';

interface ClipProcessingState {
  csvRowIndex: number;
  status: ProcessingStatus;
  clip?: AudioClip;
  error?: string;
}

const BATCH_SIZE = 2;

export function ProcessingStep({
  matches,
  csvRows,
  onComplete,
  onBack,
}: ProcessingStepProps) {
  const { getAuthHeaders } = useAuth();
  const [processingStates, setProcessingStates] = useState<ClipProcessingState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [hasCalledComplete, setHasCalledComplete] = useState(false);

  useEffect(() => {
    // Initialize processing states
    const states: ClipProcessingState[] = matches.map(match => ({
      csvRowIndex: match.csvRowIndex,
      status: 'pending',
    }));
    setProcessingStates(states);
  }, [matches]);

  const calculateDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
      };
      
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Audio duration calculation timeout'));
      }, 10000);
      
      audio.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout);
        cleanup();
        
        const duration = audio.duration;
        
        if (!duration || isNaN(duration) || duration <= 0 || !isFinite(duration)) {
          reject(new Error('Invalid audio duration from file metadata'));
          return;
        }
        
        resolve(duration);
      });
      
      audio.addEventListener('error', () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Failed to load audio for duration calculation'));
      });
      
      audio.src = objectUrl;
    });
  };

  const processClip = async (
    match: FileMatch,
    csvRow: CSVRow
  ): Promise<{ success: boolean; clip?: AudioClip; error?: string }> => {
    try {
      // Calculate duration client-side
      let duration: number;
      try {
        duration = await calculateDuration(match.file);
      } catch (error) {
        return {
          success: false,
          error: 'Could not determine audio duration. Please ensure the file is a valid audio file.',
        };
      }

      const formData = new FormData();
      formData.append('file', match.file);
      formData.append('title', csvRow.title);
      formData.append('duration', duration.toString());
      formData.append('language', csvRow.language);
      formData.append('speakerGender', csvRow.speaker_gender || '');
      formData.append('speakerAgeRange', csvRow.speaker_age || '');
      formData.append('speakerDialect', csvRow.speaker_dialect || '');
      formData.append('transcript', csvRow.transcription || '');
      formData.append('sourceUrl', csvRow.source_url || '');
      formData.append('tags', csvRow.tags || '');

      const response = await fetch('/api/bulk-upload/process', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Upload failed',
        };
      }

      const result = await response.json();
      return {
        success: true,
        clip: result.clip,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const processBatch = async (batch: FileMatch[]) => {
    const results = await Promise.all(
      batch.map(async (match) => {
        const csvRow = csvRows[match.csvRowIndex];
        
        // Update status to processing
        setProcessingStates(prev =>
          prev.map(state =>
            state.csvRowIndex === match.csvRowIndex
              ? { ...state, status: 'processing' }
              : state
          )
        );

        const result = await processClip(match, csvRow);

        // Update status based on result
        setProcessingStates(prev =>
          prev.map(state =>
            state.csvRowIndex === match.csvRowIndex
              ? {
                  ...state,
                  status: result.success ? 'success' : 'error',
                  clip: result.clip,
                  error: result.error,
                }
              : state
          )
        );

        if (result.success) {
          setCompletedCount(prev => prev + 1);
        } else {
          setErrorCount(prev => prev + 1);
        }

        return result;
      })
    );

    return results;
  };

  const startProcessing = async () => {
    setIsProcessing(true);
    setCompletedCount(0);
    setErrorCount(0);

    // Process in batches
    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);
      await processBatch(batch);
    }

    setIsProcessing(false);
  };

  // Call onComplete when all processing is done (only once)
  useEffect(() => {
    if (!isProcessing && processingStates.length > 0 && !hasCalledComplete) {
      const allComplete = processingStates.every(state => state.status === 'success' || state.status === 'error');
      if (allComplete) {
        const successfulClips = processingStates
          .filter(state => state.status === 'success' && state.clip)
          .map(state => state.clip!);
        if (successfulClips.length > 0 || processingStates.length > 0) {
          setHasCalledComplete(true);
          onComplete(successfulClips);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, processingStates, hasCalledComplete]);

  useEffect(() => {
    // Auto-start processing when component mounts and states are initialized
    if (matches.length > 0 && processingStates.length === matches.length && !isProcessing && processingStates.every(s => s.status === 'pending')) {
      startProcessing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length, processingStates.length]);

  const allComplete = processingStates.length > 0 && 
    processingStates.every(state => state.status === 'success' || state.status === 'error');
  const hasSuccess = processingStates.some(state => state.status === 'success');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Clips</h2>
        <p className="text-sm text-gray-600">
          Uploading and processing your clips in batches of {BATCH_SIZE}...
        </p>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-900 mb-1">Total</div>
          <p className="text-2xl font-bold text-blue-700">{matches.length}</p>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-900 mb-1">Completed</div>
          <p className="text-2xl font-bold text-green-700">{completedCount}</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-medium text-red-900 mb-1">Errors</div>
          <p className="text-2xl font-bold text-red-700">{errorCount}</p>
        </div>
      </div>

      {/* Processing List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {processingStates.map((state, index) => {
          const csvRow = csvRows[state.csvRowIndex];
          const match = matches.find(m => m.csvRowIndex === state.csvRowIndex);

          return (
            <div
              key={index}
              className={`p-4 rounded-md border ${
                state.status === 'success'
                  ? 'bg-green-50 border-green-200'
                  : state.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : state.status === 'processing'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {state.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                  {state.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  {state.status === 'processing' && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                  )}
                  {state.status === 'pending' && (
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {csvRow.title}
                    </p>
                    <p className="text-xs text-gray-600">
                      {match?.file.name}
                    </p>
                    {state.error && (
                      <p className="text-xs text-red-600 mt-1">{state.error}</p>
                    )}
                  </div>
                </div>
                {state.status === 'success' && state.clip && (
                  <a
                    href={`/chorus/${state.clip.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                    title="View clip"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {allComplete && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Back
          </button>
          {hasSuccess && (
            <button
              type="button"
              onClick={() => {
                const successfulClips = processingStates
                  .filter(state => state.status === 'success' && state.clip)
                  .map(state => state.clip!);
                onComplete(successfulClips);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Continue to Confirmation
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {!allComplete && isProcessing && (
        <div className="text-center py-4">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Processing clips...</p>
        </div>
      )}
    </div>
  );
}
