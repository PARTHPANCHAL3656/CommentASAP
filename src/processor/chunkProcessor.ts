/**
 * ChunkProcessor — splits large source files into function/class-boundary chunks,
 * sends each chunk to the AI provider, then reassembles the output.
 *
 * Strategy:
 *  1. If file ≤ chunkSize lines → process as a single unit.
 *  2. Otherwise, find natural break points (blank lines before a function/class
 *     declaration) and split there.
 *  3. Process each chunk sequentially with small delay to respect rate limits.
 *  4. Reassemble by concatenation.
 */

import { AIProvider, GenerateOptions } from '../providers/aiProvider';

export interface ChunkResult {
  success: boolean;
  output: string;
  error?: string;
}

const CHUNK_DELAY_MS = 300; // Small delay between chunks to avoid rate-limit spikes

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Find indices of "natural break lines" — blank lines immediately before a
 * top-level function/class/def declaration.
 */
function findBreakPoints(lines: string[]): number[] {
  const breakPoints: number[] = [];

  // Patterns that signal the start of a top-level declaration
  const declarationPatterns = [
    /^(export\s+)?(default\s+)?(async\s+)?function\s+/,  // JS/TS function
    /^(export\s+)?(default\s+)?class\s+/,                // JS/TS/Java class
    /^def\s+/,                                            // Python function
    /^class\s+/,                                          // Python class
    /^(public|private|protected|static|abstract|final)[\s\w]*\s+\w+\s*\(/,  // Java method
    /^(void|int|bool|auto|std::|[A-Z]\w*)\s+\w+\s*\(/,  // C/C++ function
  ];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const isDeclaration = declarationPatterns.some(p => p.test(line));
    const prevLineBlank = lines[i - 1].trim() === '';

    if (isDeclaration && prevLineBlank) {
      breakPoints.push(i);
    }
  }

  return breakPoints;
}

/**
 * Split source into chunks of max `maxLines` lines, respecting natural break points.
 */
export function splitIntoChunks(source: string, maxLines: number): string[] {
  const lines = source.split('\n');

  if (lines.length <= maxLines) {
    return [source];
  }

  const breakPoints = findBreakPoints(lines);
  const chunks: string[] = [];
  let start = 0;

  for (const breakPoint of breakPoints) {
    if (breakPoint - start >= maxLines) {
      // Force a split at last seen break point within window
      chunks.push(lines.slice(start, breakPoint).join('\n'));
      start = breakPoint;
    }
  }

  // Tail chunk
  if (start < lines.length) {
    chunks.push(lines.slice(start).join('\n'));
  }

  return chunks.length > 0 ? chunks : [source];
}

/**
 * Process a full source string through the AI provider in chunks.
 * Returns the reassembled documented source.
 */
export async function processWithChunks(
  source: string,
  provider: AIProvider,
  opts: GenerateOptions,
  maxLines: number,
  onProgress?: (chunkIndex: number, total: number) => void
): Promise<string> {
  const chunks = splitIntoChunks(source, maxLines);
  const results: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);

    const documented = await provider.generate(chunks[i], opts);
    results.push(documented);

    if (i < chunks.length - 1) {
      await sleep(CHUNK_DELAY_MS);
    }
  }

  return results.join('\n');
}
