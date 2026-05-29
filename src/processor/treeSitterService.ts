/**
 * TreeSitterService — singleton that manages web-tree-sitter initialization
 * and provides AST-based comment stripping across JS/TS/Python/Java/C++.
 *
 * IMPORTANT: Grammar WASM files must be bundled in the extension's `wasm/` folder.
 * If a WASM file is missing, the service gracefully falls back to regex-based
 * comment removal instead of throwing a hard error.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';

// web-tree-sitter must be required at runtime (not a pure ES module)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parser = require('web-tree-sitter');

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'c';

const GRAMMAR_MAP: Record<SupportedLanguage, string> = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  python:     'tree-sitter-python.wasm',
  java:       'tree-sitter-java.wasm',
  cpp:        'tree-sitter-cpp.wasm',
  c:          'tree-sitter-c.wasm',
};

const COMMENT_NODE_TYPES = new Set([
  'comment',
  'block_comment',
  'line_comment',
  'multiline_comment',
  'expression_statement',
]);

export class TreeSitterService {
  private static instance: TreeSitterService;
  private initialized = false;
  private parserCache = new Map<SupportedLanguage, unknown>();

  static getInstance(): TreeSitterService {
    if (!TreeSitterService.instance) {
      TreeSitterService.instance = new TreeSitterService();
    }
    return TreeSitterService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await Parser.init();
      this.initialized = true;
    } catch (err) {
      // Tree-sitter init failed — service will fall back to regex removal
      console.warn('[commentasap] Tree-sitter init failed, using regex fallback:', err);
    }
  }

  /**
   * Check if the WASM grammar file actually exists on disk.
   * Returns false if the file is missing — used to decide fallback strategy.
   */
  private wasmExists(language: SupportedLanguage, extensionUri: vscode.Uri): boolean {
    const wasmFile = GRAMMAR_MAP[language];
    const wasmPath = vscode.Uri.joinPath(extensionUri, 'wasm', wasmFile).fsPath;
    return fs.existsSync(wasmPath);
  }

  private async getParser(
    language: SupportedLanguage,
    extensionUri: vscode.Uri
  ): Promise<unknown> {
    if (this.parserCache.has(language)) {
      return this.parserCache.get(language)!;
    }

    await this.initialize();
    if (!this.initialized) {
      throw new Error('Tree-sitter not initialized');
    }

    const wasmFile = GRAMMAR_MAP[language];
    const wasmPath = vscode.Uri.joinPath(extensionUri, 'wasm', wasmFile).fsPath;

    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM grammar not found for ${language}. Run: npx tree-sitter build-wasm node_modules/tree-sitter-${language}`);
    }

    const lang = await Parser.Language.load(wasmPath);
    const parser = new Parser();
    parser.setLanguage(lang);

    this.parserCache.set(language, parser);
    return parser;
  }

  /**
   * Remove all comments from source. If AST-based removal fails (missing WASM),
   * automatically falls back to regex-based removal with a warning shown to the user.
   */
  async removeComments(
    source: string,
    language: SupportedLanguage,
    extensionUri: vscode.Uri
  ): Promise<string> {
    // Fast path: if WASM doesn't exist, skip straight to regex fallback
    if (!this.wasmExists(language, extensionUri)) {
      vscode.window.showWarningMessage(
        `CommentASAP: WASM grammar for ${language} not found — using regex fallback. ` +
        `Results may be imperfect. See README to install grammar files.`
      );
      return this.removeCommentsRegex(source, language);
    }

    try {
      const parser = await this.getParser(language, extensionUri) as {
        parse: (src: string) => { rootNode: TreeNode };
      };

      const tree = parser.parse(source);
      const ranges = this.collectCommentRanges(tree.rootNode, source, language);

      ranges.sort((a, b) => b.startIndex - a.startIndex);

      let result = source;
      for (const range of ranges) {
        result = result.slice(0, range.startIndex) + result.slice(range.endIndex);
      }

      return this.normaliseBlankLines(result);
    } catch (err) {
      // AST failed — fall back to regex with user warning
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showWarningMessage(
        `CommentASAP: AST comment removal failed (${msg}). Using regex fallback.`
      );
      return this.removeCommentsRegex(source, language);
    }
  }

  private collectCommentRanges(
    node: TreeNode,
    source: string,
    language: SupportedLanguage
  ): Array<{ startIndex: number; endIndex: number }> {
    const ranges: Array<{ startIndex: number; endIndex: number }> = [];

    const walk = (n: TreeNode) => {
      if (COMMENT_NODE_TYPES.has(n.type)) {
        if (n.type === 'expression_statement' && language === 'python') {
          if (!this.isPythonDocstring(n)) {
            for (const child of n.children) walk(child);
            return;
          }
        }
        
        let end = n.endIndex;
        if (source[end] === '\n') end++;
        ranges.push({ startIndex: n.startIndex, endIndex: end });
        return;
      }
      for (const child of n.children) walk(child);
    };

    walk(node);
    return ranges;
  }

  private isPythonDocstring(node: TreeNode): boolean {
    const meaningful = node.children.filter(
      (c: TreeNode) => c.type !== 'comment' && c.type.trim() !== ''
    );
    if (meaningful.length !== 1) return false;
    const child = meaningful[0];
    return child.type === 'string' || child.type === 'concatenated_string';
  }

  private normaliseBlankLines(source: string): string {
    return source.replace(/(\r?\n){3,}/g, '\n\n').trimEnd() + '\n';
  }

  /**
   * Regex-based comment removal — used as fallback when WASM grammar is absent.
   * Handles JS/TS/Java/C/C++ and Python reasonably well for most codebases.
   */
  removeCommentsRegex(source: string, language: string): string {
    let result = source;

    if (['javascript', 'typescript', 'java', 'cpp', 'c'].includes(language)) {
      // Remove block comments /* ... */
      result = result.replace(/\/\*[\s\S]*?\*\//g, '');
      // Remove line comments // ...
      result = result.replace(/\/\/[^\n]*/g, '');
    } else if (language === 'python') {
      // Remove # line comments (but not inside strings — best-effort)
      result = result.replace(/#[^\n]*/g, '');
      // Remove triple-quoted docstrings (best-effort, not perfect)
      result = result.replace(/"""[\s\S]*?"""/g, '');
      result = result.replace(/'''[\s\S]*?'''/g, '');
    } else if (language === 'html' || language === 'htm') {
      result = result.replace(/<!--[\s\S]*?-->/g, '');
    } else if (['css', 'scss'].includes(language)) {
      result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    return this.normaliseBlankLines(result);
  }

  // Simple removal for HTML/CSS/SCSS (called directly from removeComments command)
  removeCommentsSimple(source: string, language: string): string {
    return this.removeCommentsRegex(source, language);
  }

  isSupportedLanguage(langId: string): langId is SupportedLanguage {
    return langId in GRAMMAR_MAP;
  }
}

interface TreeNode {
  type: string;
  startIndex: number;
  endIndex: number;
  children: TreeNode[];
}
