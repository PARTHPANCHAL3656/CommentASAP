import * as vscode from 'vscode';
import { generateForSelection } from './commands/generateSelection';
import { generateForFile } from './commands/generateFile';
import { generateForProject } from './commands/generateProject';
import { removeCommentsFromFile, removeCommentsFromProject } from './commands/removeComments';
import { configureApiKey } from './commands/configure';
import { selectProvider } from './commands/configure';
import { TreeSitterService } from './processor/treeSitterService';
import { StatusBarManager } from './utils/statusBar';

export async function activate(context: vscode.ExtensionContext) {
  console.log('[commento] Extension activating...');

  // Boot Tree-sitter (async, non-blocking)
  const treeSitter = TreeSitterService.getInstance();
  treeSitter.initialize().catch(err =>
    console.warn('[commento] Tree-sitter init warning:', err)
  );

  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // ── Commands ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('commento.generateForSelection', () =>
      generateForSelection(context, statusBar)
    ),
    vscode.commands.registerCommand('commento.generateForFile', () =>
      generateForFile(context, statusBar)
    ),
    vscode.commands.registerCommand('commento.generateForProject', () =>
      generateForProject(context, statusBar)
    ),
    vscode.commands.registerCommand('commento.removeComments', () =>
      removeCommentsFromFile(context, statusBar)
    ),
    vscode.commands.registerCommand('commento.removeCommentsProject', () =>
      removeCommentsFromProject(context, statusBar)
    ),
    vscode.commands.registerCommand('commento.configureApiKey', () =>
      configureApiKey(context)
    ),
    vscode.commands.registerCommand('commento.selectProvider', () =>
      selectProvider(context)
    )
  );

  console.log('[commento] Extension active.');
}

export function deactivate() {
  console.log('[commento] Deactivated.');
}
