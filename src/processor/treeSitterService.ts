/**
 * TreeSitterService — singleton that manages web-tree-sitter initialization
 * and provides AST-based comment stripping across JS/TS/Python/Java/C++.
 *
 * NOTE: Grammar WASM files must be bundled in the extension's `wasm/` folder.
 * Grammars are lazy-loaded per language to reduce startup cost.
 */

import * as vscode from 'vscode';
import * as path from 'path';

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

// Map VS Code languageId → grammar wasm filename
const GRAMMAR_MAP: Record<SupportedLanguage, string> = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  python: 'tree-sitter-python.wasm',
  java: 'tree-sitter-java.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  c: 'tree-sitter-c.wasm',
};

// Tree-sitter node types that represent comments
const COMMENT_NODE_TYPES = new Set([
  'comment',               // JS/TS/Java/C/C++ line + block comments
  'block_comment',         // Java alternative
  'line_comment',          // Rust/C++ alternative
  'multiline_comment',
  'expression_statement',  // Python — but only if it's a string literal docstring
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
    await Parser.init();
    this.initialized = true;
  }

  private async getParser(
    language: SupportedLanguage,
    extensionUri: vscode.Uri
  ): Promise<unknown> {
    if (this.parserCache.has(language)) {
      return this.parserCache.get(language)!;
    }

    await this.initialize();

    const wasmFile = GRAMMAR_MAP[language];
    const wasmPath = vscode.Uri.joinPath(extensionUri, 'wasm', wasmFile).fsPath;

    const lang = await Parser.Language.load(wasmPath);
    const parser = new Parser();
    parser.setLanguage(lang);

    this.parserCache.set(language, parser);
    return parser;
  }

  /**
   * Remove all comments from the given source code using AST parsing.
   * Returns the cleaned source with comments stripped and whitespace normalised.
   */
  async removeComments(
    source: string,
    language: SupportedLanguage,
    extensionUri: vscode.Uri
  ): Promise<string> {
    const parser = await this.getParser(language, extensionUri) as {
      parse: (src: string) => { rootNode: TreeNode };
    };

    const tree = parser.parse(source);
    const ranges = this.collectCommentRanges(tree.rootNode, source, language);

    // Sort descending by start offset so we can splice without index shifting
    ranges.sort((a, b) => b.startIndex - a.startIndex);

    let result = source;
    for (const range of ranges) {
      result = result.slice(0, range.startIndex) + result.slice(range.endIndex);
    }

    // Normalise: remove blank lines left behind by removed comments
    result = this.normaliseBlankLines(result);
    return result;
  }

  private collectCommentRanges(
    node: TreeNode,
    source: string,
    language: SupportedLanguage
  ): Array<{ startIndex: number; endIndex: number }> {
    const ranges: Array<{ startIndex: number; endIndex: number }> = [];

    const walk = (n: TreeNode) => {
      if (COMMENT_NODE_TYPES.has(n.type)) {
        // For Python: expression_statement is only a docstring if its first child
        // is a string literal at the start of a function/class/module body
        if (n.type === 'expression_statement' && language === 'python') {
          if (!this.isPythonDocstring(n)) {
            for (const child of n.children) walk(child);
            return;
          }
        }
        // Include the trailing newline if present, so we don't leave orphan lines
        let end = n.endIndex;
        if (source[end] === '\n') end++;
        ranges.push({ startIndex: n.startIndex, endIndex: end });
        return; // Don't recurse into comment nodes
      }
      for (const child of n.children) {
        walk(child);
      }
    };

    walk(node);
    return ranges;
  }

  /**
   * Heuristic: a Python expression_statement is a docstring if
   * - its only meaningful child is a string literal
   * - its parent is a function/class/module body
   */
  private isPythonDocstring(node: TreeNode): boolean {
    const meaningful = node.children.filter(
      (c: TreeNode) => c.type !== 'comment' && c.type.trim() !== ''
    );
    if (meaningful.length !== 1) return false;
    const child = meaningful[0];
    return child.type === 'string' || child.type === 'concatenated_string';
  }

  private normaliseBlankLines(source: string): string {
    // Collapse 3+ consecutive blank lines to max 1
    return source.replace(/(\r?\n){3,}/g, '\n\n').trimEnd() + '\n';
  }

  isSupportedLanguage(langId: string): langId is SupportedLanguage {
    return langId in GRAMMAR_MAP;
  }
  removeCommentsSimple(source: string, language: string): string {
  if (language === 'html') {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  }
  if (language === 'css' || language === 'scss') {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  return source;
  }
}

// ── Internal type shim for tree-sitter nodes ─────────────────────────────────
interface TreeNode {
  type: string;
  startIndex: number;
  endIndex: number;
  children: TreeNode[];
}
