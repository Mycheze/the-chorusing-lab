import { supportedFormats } from '@/lib/audio/config';

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const extension = originalName.split('.').pop()?.toLowerCase() || '';
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\-_]/g, '_');
  return `${timestamp}-${random}-${baseName}.${extension}`;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !supportedFormats.includes(extension)) {
    return `Unsupported format. Supported formats: ${supportedFormats.join(', ')}`;
  }

  return null;
}
