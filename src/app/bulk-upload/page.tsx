'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { AlertCircle, Upload, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import { CSVUploader } from '@/components/bulk-upload/CSVUploader';
import { AudioFileUploader } from '@/components/bulk-upload/AudioFileUploader';
import { VerificationStep } from '@/components/bulk-upload/VerificationStep';
import { ProcessingStep } from '@/components/bulk-upload/ProcessingStep';
import { ConfirmationStep } from '@/components/bulk-upload/ConfirmationStep';
import type { ParseResult, CSVRow } from '@/lib/bulk-upload/csv-parser';
import type { MatchingResult, FileMatch } from '@/lib/bulk-upload/file-matcher';
import type { AudioClip } from '@/types/audio';

type Step = 'upload' | 'verify' | 'process' | 'confirm';

export default function BulkUploadPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCsvData] = useState<ParseResult | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [matches, setMatches] = useState<MatchingResult | null>(null);
  const [completedClips, setCompletedClips] = useState<AudioClip[]>([]);

  // Redirect if not logged in
  if (!isLoading && !user) {
    router.push('/');
    return null;
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const handleCSVParse = (result: ParseResult) => {
    setCsvData(result);
  };

  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files);
  };

  const handleVerify = () => {
    if (csvData && csvData.rows.length > 0 && uploadedFiles.length > 0) {
      setStep('verify');
    }
  };

  const handleVerified = (matchingResult: MatchingResult) => {
    setMatches(matchingResult);
    setStep('process');
  };

  const handleProcessingComplete = (clips: AudioClip[]) => {
    setCompletedClips(clips);
    setStep('confirm');
  };

  const handleDelete = (clipIds: string[]) => {
    setCompletedClips(prev => prev.filter(c => !clipIds.includes(c.id)));
  };

  const canProceedToVerify = csvData && csvData.rows.length > 0 && uploadedFiles.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Upload className="w-6 h-6 text-indigo-600" />
            Bulk Upload
          </h1>
          <p className="text-gray-600">
            Upload multiple audio clips at once using a CSV/TSV file and matching audio files.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            {[
              { key: 'upload', label: 'Upload', icon: Upload },
              { key: 'verify', label: 'Verify', icon: FileText },
              { key: 'process', label: 'Process', icon: ArrowRight },
              { key: 'confirm', label: 'Confirm', icon: CheckCircle },
            ].map((stepInfo, index) => {
              const Icon = stepInfo.icon;
              const stepIndex = ['upload', 'verify', 'process', 'confirm'].indexOf(step);
              const isActive = step === stepInfo.key;
              const isCompleted = stepIndex > index;
              
              return (
                <div key={stepInfo.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        isActive
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {stepInfo.label}
                    </span>
                  </div>
                  {index < 3 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          {step === 'upload' && (
            <div className="space-y-6">
              <CSVUploader onParse={handleCSVParse} />
              <AudioFileUploader onFilesChange={handleFilesChange} />
              
              {csvData && csvData.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 mb-1">
                        {csvData.errors.length} warning{csvData.errors.length !== 1 ? 's' : ''} found
                      </p>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        {csvData.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>
                            Row {error.row}: {error.message}
                          </li>
                        ))}
                        {csvData.errors.length > 5 && (
                          <li>... and {csvData.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!canProceedToVerify}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Verify Files
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'verify' && csvData && (
            <VerificationStep
              csvRows={csvData.rows}
              uploadedFiles={uploadedFiles}
              onVerified={handleVerified}
              onBack={() => setStep('upload')}
            />
          )}

          {step === 'process' && matches && csvData && (
            <ProcessingStep
              matches={matches.matches}
              csvRows={csvData.rows}
              onComplete={handleProcessingComplete}
              onBack={() => setStep('verify')}
            />
          )}

          {step === 'confirm' && (
            <ConfirmationStep
              clips={completedClips}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
    </main>
  );
}
