/**
 * WorkspaceScanner — discovers source files in the workspace,
 * filtering out ignored/generated directories and unsupported file types.
 */

import * as vscode from 'vscode';
import * as path from 'path';

export const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
};

export interface DiscoveredFile {
  uri: vscode.Uri;
  language: string;
  relativePath: string;
}

/**
 * Resolve the detected language from VS Code's languageId OR file extension fallback.
 */
export function detectLanguage(
  doc: vscode.TextDocument
): string | null {
  const byLangId = doc.languageId;
  if (byLangId && SUPPORTED_EXTENSIONS[`.${byLangId}`]) {
    return byLangId;
  }
  const ext = path.extname(doc.uri.fsPath).toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] ?? null;
}

/**
 * Detect language from a URI's file extension (used for files not open in editor).
 */
export function detectLanguageFromUri(uri: vscode.Uri): string | null {
  const ext = path.extname(uri.fsPath).toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] ?? null;
}

/**
 * Scan the workspace (or a specific folder) for all supported source files,
 * excluding ignored patterns from config + defaults.
 */
export async function scanWorkspace(
  rootUri?: vscode.Uri
): Promise<DiscoveredFile[]> {
  const config = vscode.workspace.getConfiguration('commento');
  const skipPatterns: string[] = config.get('skipPatterns') ?? [];

  // Build a glob exclude pattern
  const excludeGlob = `{${skipPatterns.map(p => `**/${p}/**`).join(',')}}`;

  const extensions = Object.keys(SUPPORTED_EXTENSIONS);
  const includeGlob = `**/*{${extensions.join(',')}}`;

  const workspaceRoot = rootUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) return [];

  const uris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceRoot, includeGlob),
    new vscode.RelativePattern(workspaceRoot, excludeGlob),
    5000 // hard cap at 5000 files
  );

  const files: DiscoveredFile[] = [];

  for (const uri of uris) {
    const language = detectLanguageFromUri(uri);
    if (!language) continue;

    const relativePath = vscode.workspace.asRelativePath(uri, false);
    files.push({ uri, language, relativePath });
  }

  // Sort: alphabetical by relative path for deterministic output
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return files;
}

/**
 * Read source content from a URI.
 */
export async function readFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder().decode(bytes);
}
