import type { TranscriptionDiff } from "@/types/audio";

/**
 * Normalizes text for comparison (trim, lowercase, normalize whitespace)
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Calculates the Levenshtein edit distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to transform one string into another.
 */
export function calculateEditDistance(original: string, user: string): number {
  const orig = normalizeText(original);
  const usr = normalizeText(user);

  const m = orig.length;
  const n = usr.length;

  // Create DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Base cases: transforming empty string requires all insertions/deletions
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i; // Delete all characters from original
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j; // Insert all characters from user
  }

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (orig[i - 1] === usr[j - 1]) {
        // Characters match, no operation needed
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Take minimum of: delete, insert, or substitute
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // Delete from original
          dp[i][j - 1] + 1, // Insert from user
          dp[i - 1][j - 1] + 1 // Substitute
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculates accuracy percentage based on edit distance
 * Formula: (1 - editDistance / maxLength) * 100
 */
export function calculateAccuracy(original: string, user: string): number {
  const orig = normalizeText(original);
  const usr = normalizeText(user);

  if (orig.length === 0 && usr.length === 0) {
    return 100;
  }

  const editDist = calculateEditDistance(original, user);
  const maxLength = Math.max(orig.length, usr.length);

  if (maxLength === 0) {
    return 100;
  }

  const accuracy = Math.round((1 - editDist / maxLength) * 100);
  return Math.max(0, accuracy); // Ensure non-negative
}

/**
 * Operation types for backtracking
 */
type Operation = "match" | "delete" | "insert" | "substitute";

/**
 * Generates a detailed diff between original and user text using optimal alignment
 * Uses dynamic programming with backtracking to find the best alignment
 */
export function generateDiff(
  original: string,
  user: string
): TranscriptionDiff[] {
  const orig = normalizeText(original);
  const usr = normalizeText(user);

  const m = orig.length;
  const n = usr.length;

  // Create DP table for edit distance
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Create operation table to track which operation was chosen
  const ops: Operation[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill("match" as Operation));

  // Base cases
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
    if (i > 0) ops[i][0] = "delete";
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
    if (j > 0) ops[0][j] = "insert";
  }

  // Fill DP table and track operations
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (orig[i - 1] === usr[j - 1]) {
        // Match
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = "match";
      } else {
        // Find minimum operation
        const deleteCost = dp[i - 1][j] + 1;
        const insertCost = dp[i][j - 1] + 1;
        const substituteCost = dp[i - 1][j - 1] + 1;

        const minCost = Math.min(deleteCost, insertCost, substituteCost);
        dp[i][j] = minCost;

        if (minCost === deleteCost) {
          ops[i][j] = "delete";
        } else if (minCost === insertCost) {
          ops[i][j] = "insert";
        } else {
          ops[i][j] = "substitute";
        }
      }
    }
  }

  // Backtrack to build diff segments
  const diffs: TranscriptionDiff[] = [];
  let i = m;
  let j = n;

  // Track current position in original string for insert operations
  let currentOrigPos = m;

  while (i > 0 || j > 0) {
    const op = ops[i][j];

    if (op === "match") {
      // Group consecutive matches together for better visualization
      const matchChars: string[] = [];
      let matchStartI = i;
      let matchStartJ = j;

      // Collect consecutive matches
      while (i > 0 && j > 0 && ops[i][j] === "match") {
        matchChars.unshift(orig[i - 1]);
        i--;
        j--;
      }

      const matchText = matchChars.join("");
      const matchEndI = matchStartI;
      const matchStartI_actual = i;

      diffs.unshift({
        type: "match",
        originalText: matchText,
        userText: matchText,
        startIndex: matchStartI_actual,
        endIndex: matchEndI,
      });

      currentOrigPos = i;
    } else if (op === "delete") {
      // Character missing in user text
      const char = orig[i - 1];
      diffs.unshift({
        type: "delete",
        originalText: char,
        userText: "",
        startIndex: i - 1,
        endIndex: i,
      });
      i--;
      currentOrigPos = i;
    } else if (op === "insert") {
      // Extra character in user text
      const char = usr[j - 1];
      diffs.unshift({
        type: "insert",
        originalText: "",
        userText: char,
        startIndex: currentOrigPos,
        endIndex: currentOrigPos,
      });
      j--;
      // Don't change currentOrigPos for inserts
    } else if (op === "substitute") {
      // Character replacement
      const origChar = orig[i - 1];
      const userChar = usr[j - 1];
      diffs.unshift({
        type: "replace",
        originalText: origChar,
        userText: userChar,
        startIndex: i - 1,
        endIndex: i,
      });
      i--;
      j--;
      currentOrigPos = i;
    }
  }

  return diffs;
}
