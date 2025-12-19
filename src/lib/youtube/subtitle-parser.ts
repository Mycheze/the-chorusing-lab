/**
 * Subtitle parsing utilities for YouTube videos
 * Supports SRT and VTT formats
 */

export interface SubtitleEntry {
  start: number; // in seconds
  end: number; // in seconds
  text: string;
}

/**
 * Parse SRT subtitle format
 */
export function parseSRT(srtContent: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // Skip the index line (first line)
    const timeLine = lines[1];
    const textLines = lines.slice(2);

    // Parse timecode: "00:00:00,000 --> 00:00:00,000"
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!timeMatch) continue;

    const start =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;

    const end =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;

    // Clean up text (remove HTML tags, normalize whitespace)
    const text = textLines
      .join(" ")
      .replace(/<[^>]+>/g, "") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    if (text) {
      entries.push({ start, end, text });
    }
  }

  return entries;
}

/**
 * Parse VTT subtitle format
 */
export function parseVTT(vttContent: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const lines = vttContent.split("\n");

  let currentEntry: Partial<SubtitleEntry> | null = null;
  const textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip VTT header and metadata
    if (line.startsWith("WEBVTT") || line.startsWith("NOTE") || !line) {
      continue;
    }

    // Check for timestamp line: "00:00:00.000 --> 00:00:00.000"
    const timeMatch = line.match(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
    );
    if (timeMatch) {
      // Save previous entry if exists
      if (
        currentEntry &&
        currentEntry.start !== undefined &&
        currentEntry.end !== undefined &&
        textLines.length > 0
      ) {
        const text = textLines
          .join(" ")
          .replace(/<[^>]+>/g, "") // Remove HTML tags
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();

        if (text) {
          entries.push({
            start: currentEntry.start,
            end: currentEntry.end,
            text,
          });
        }
      }

      // Start new entry
      const start =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;

      const end =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;

      currentEntry = { start, end };
      textLines.length = 0;
      continue;
    }

    // If we have a current entry, collect text lines
    if (currentEntry && line) {
      textLines.push(line);
    }
  }

  // Don't forget the last entry
  if (
    currentEntry &&
    currentEntry.start !== undefined &&
    currentEntry.end !== undefined &&
    textLines.length > 0
  ) {
    const text = textLines
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      entries.push({
        start: currentEntry.start,
        end: currentEntry.end,
        text,
      });
    }
  }

  return entries;
}

/**
 * Parse subtitle content (auto-detect format)
 */
export function parseSubtitles(
  content: string,
  format?: "srt" | "vtt"
): SubtitleEntry[] {
  if (
    format === "srt" ||
    (!format && content.includes("-->") && !content.startsWith("WEBVTT"))
  ) {
    return parseSRT(content);
  } else if (format === "vtt" || (!format && content.startsWith("WEBVTT"))) {
    return parseVTT(content);
  } else {
    // Try SRT first, then VTT
    try {
      return parseSRT(content);
    } catch {
      return parseVTT(content);
    }
  }
}

/**
 * Extract transcript text for a specific time range
 * Returns concatenated text from all subtitle entries that overlap with the range
 */
export function getTranscriptForRange(
  entries: SubtitleEntry[],
  startTime: number,
  endTime: number
): string {
  const relevantEntries = entries.filter((entry) => {
    // Entry overlaps with range if:
    // - Entry starts before range ends AND entry ends after range starts
    return entry.start < endTime && entry.end > startTime;
  });

  // Sort by start time
  relevantEntries.sort((a, b) => a.start - b.start);

  // Concatenate text
  return relevantEntries
    .map((entry) => entry.text)
    .join(" ")
    .trim();
}

/**
 * Get full transcript (all entries concatenated)
 */
export function getFullTranscript(entries: SubtitleEntry[]): string {
  return entries
    .map((entry) => entry.text)
    .join(" ")
    .trim();
}
