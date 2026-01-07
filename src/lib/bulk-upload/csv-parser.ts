/**
 * CSV/TSV parsing utility for bulk upload
 * Auto-detects format and validates required columns
 */

export interface CSVRow {
  file_name: string;
  transcription: string;
  title: string;
  speaker_gender: string;
  speaker_age: string;
  language: string;
  speaker_dialect?: string; // Optional
  tags: string;
  source_url: string;
  [key: string]: string | undefined; // Allow other columns
}

export interface ParseResult {
  rows: CSVRow[];
  errors: ParseError[];
  format: 'csv' | 'tsv';
}

export interface ParseError {
  row: number;
  column?: string;
  message: string;
}

const REQUIRED_COLUMNS = [
  'file_name',
  'transcription',
  'title',
  'speaker_gender',
  'speaker_age',
  'language',
  'tags',
  'source_url',
] as const;

const OPTIONAL_COLUMNS = [
  'speaker_dialect',
] as const;

/**
 * Normalize column name (lowercase, trim, replace spaces with underscores)
 */
function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse CSV line (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

/**
 * Parse TSV line (simpler, no quotes needed)
 */
function parseTSVLine(line: string): string[] {
  return line.split('\t').map(field => field.trim());
}

/**
 * Auto-detect CSV vs TSV format
 */
function detectFormat(text: string): 'csv' | 'tsv' {
  const firstLine = text.split('\n')[0];
  
  // Count tabs and commas
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  
  // If tabs are present and more than commas, it's TSV
  if (tabCount > 0 && tabCount >= commaCount) {
    return 'tsv';
  }
  
  // Default to CSV
  return 'csv';
}

/**
 * Parse CSV/TSV file content
 */
export function parseCSVFile(content: string, format?: 'csv' | 'tsv'): ParseResult {
  const errors: ParseError[] = [];
  const rows: CSVRow[] = [];
  
  // Auto-detect format if not specified
  const detectedFormat = format || detectFormat(content);
  
  // Split into lines
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    errors.push({
      row: 0,
      message: 'File is empty',
    });
    return { rows, errors, format: detectedFormat };
  }
  
  // Parse header
  const headerLine = lines[0];
  const parseLine = detectedFormat === 'csv' ? parseCSVLine : parseTSVLine;
  const headerFields = parseLine(headerLine);
  
  // Normalize column names
  const columnMap = new Map<string, string>();
  const normalizedHeaders = headerFields.map(normalizeColumnName);
  
  // Map original column names to normalized names
  headerFields.forEach((original, index) => {
    const normalized = normalizedHeaders[index];
    columnMap.set(normalized, original);
  });
  
    // Validate required columns
    const missingColumns: string[] = [];
    for (const requiredCol of REQUIRED_COLUMNS) {
      if (!normalizedHeaders.includes(requiredCol)) {
        missingColumns.push(requiredCol);
      }
    }
    
    if (missingColumns.length > 0) {
      errors.push({
        row: 1,
        message: `Missing required columns: ${missingColumns.join(', ')}`,
      });
    }
    
    // Note: Optional columns like speaker_dialect are allowed but not required
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const fields = parseLine(line);
    
    // Create row object
    const row: Partial<CSVRow> = {};
    let hasData = false;
    
    // Map fields to columns
    normalizedHeaders.forEach((normalizedCol, index) => {
      const value = fields[index] || '';
      const originalCol = columnMap.get(normalizedCol) || normalizedCol;
      
      if (value.trim().length > 0) {
        hasData = true;
      }
      
      // Map to required column names
      if (REQUIRED_COLUMNS.includes(normalizedCol as any)) {
        row[normalizedCol] = value;
      } else {
        row[originalCol] = value;
      }
    });
    
    // Skip empty rows
    if (!hasData) {
      continue;
    }
    
    // Validate required fields for this row
    for (const requiredCol of REQUIRED_COLUMNS) {
      if (!row[requiredCol] || row[requiredCol].trim().length === 0) {
        errors.push({
          row: i + 1,
          column: requiredCol,
          message: `Missing required field: ${requiredCol}`,
        });
      }
    }
    
    // Optional fields like speaker_dialect can be empty - set to empty string if not present
    if (!row.speaker_dialect) {
      row.speaker_dialect = '';
    }
    
    // Validate speaker_gender
    if (row.speaker_gender && !['male', 'female', 'other'].includes(row.speaker_gender.toLowerCase())) {
      errors.push({
        row: i + 1,
        column: 'speaker_gender',
        message: `Invalid speaker_gender: ${row.speaker_gender}. Must be male, female, or other`,
      });
    }
    
    // Validate speaker_age
    if (row.speaker_age && !['teen', 'younger-adult', 'adult', 'senior'].includes(row.speaker_age.toLowerCase())) {
      errors.push({
        row: i + 1,
        column: 'speaker_age',
        message: `Invalid speaker_age: ${row.speaker_age}. Must be teen, younger-adult, adult, or senior`,
      });
    }
    
    // Validate language (should be 2-letter code, but we'll be lenient)
    if (row.language && row.language.length < 2) {
      errors.push({
        row: i + 1,
        column: 'language',
        message: `Language code should be at least 2 characters`,
      });
    }
    
    rows.push(row as CSVRow);
  }
  
  return {
    rows,
    errors,
    format: detectedFormat,
  };
}

/**
 * Generate example TSV content
 */
export function generateExampleTSV(): string {
  // Include optional columns in header
  const allColumns = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
  const headers = allColumns.join('\t');
  
  const examples = [
    {
      file_name: 'sample1.mp3',
      transcription: 'Hello, how are you today?',
      title: 'Greeting',
      speaker_gender: 'male',
      speaker_age: 'adult',
      language: 'en',
      speaker_dialect: 'American',
      tags: 'beginner,greetings,conversation',
      source_url: 'https://example.com/source1',
    },
    {
      file_name: 'sample2.wav',
      transcription: 'Good morning, nice to meet you.',
      title: 'Morning Greeting',
      speaker_gender: 'female',
      speaker_age: 'younger-adult',
      language: 'en',
      speaker_dialect: '', // Optional - can be empty
      tags: 'beginner,formal,greetings',
      source_url: 'https://example.com/source2',
    },
    {
      file_name: 'sample3.mp3',
      transcription: 'What time is it?',
      title: 'Asking Time',
      speaker_gender: 'other',
      speaker_age: 'teen',
      language: 'es',
      speaker_dialect: 'Mexican',
      tags: 'beginner,questions,time',
      source_url: 'https://example.com/source3',
    },
  ];
  
  const rows = examples.map(example => 
    allColumns.map(col => example[col as keyof typeof example] || '').join('\t')
  );
  
  return [headers, ...rows].join('\n');
}
