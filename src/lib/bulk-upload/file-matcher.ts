/**
 * File matching utility for bulk upload
 * Matches uploaded audio files to CSV entries with flexible matching
 */

export interface FileMatch {
  csvRowIndex: number;
  file: File;
  matchType: 'exact' | 'flexible';
}

export interface MatchingResult {
  matches: FileMatch[];
  unmatchedFiles: File[];
  unmatchedCSVRows: number[];
}

/**
 * Normalize filename for matching (lowercase, remove extension)
 */
function normalizeFilename(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  // Convert to lowercase and remove special characters
  return nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Match uploaded files to CSV entries
 * Uses flexible matching: case-insensitive, extension-agnostic
 */
export function matchFilesToCSV(
  files: File[],
  csvRows: Array<{ file_name: string; [key: string]: any }>
): MatchingResult {
  const matches: FileMatch[] = [];
  const unmatchedFiles: File[] = [];
  const unmatchedCSVRows: number[] = [];
  
  // Create a map of normalized CSV filenames to row indices
  const csvMap = new Map<string, { rowIndex: number; originalName: string }>();
  
  csvRows.forEach((row, index) => {
    const normalized = normalizeFilename(row.file_name);
    if (!csvMap.has(normalized)) {
      csvMap.set(normalized, { rowIndex: index, originalName: row.file_name });
    }
  });
  
  // Track which CSV rows have been matched
  const matchedCSVRows = new Set<number>();
  
  // Match each uploaded file
  for (const file of files) {
    const normalizedFile = normalizeFilename(file.name);
    const match = csvMap.get(normalizedFile);
    
    if (match) {
      matches.push({
        csvRowIndex: match.rowIndex,
        file,
        matchType: 'flexible', // All matches are flexible in this implementation
      });
      matchedCSVRows.add(match.rowIndex);
    } else {
      unmatchedFiles.push(file);
    }
  }
  
  // Find unmatched CSV rows
  csvRows.forEach((_, index) => {
    if (!matchedCSVRows.has(index)) {
      unmatchedCSVRows.push(index);
    }
  });
  
  return {
    matches,
    unmatchedFiles,
    unmatchedCSVRows,
  };
}
