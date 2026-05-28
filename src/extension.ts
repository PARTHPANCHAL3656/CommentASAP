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
  console.log('[commentfast] Extension activating...');

  // Boot Tree-sitter (async, non-blocking)
  const treeSitter = TreeSitterService.getInstance();
  treeSitter.initialize().catch(err =>
    console.warn('[commentfast] Tree-sitter init warning:', err)
  );

  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // ── Commands ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('commentfast.generateForSelection', () =>
      generateForSelection(context, statusBar)
    ),
    vscode.commands.registerCommand('commentfast.generateForFile', () =>
      generateForFile(context, statusBar)
    ),
    vscode.commands.registerCommand('commentfast.generateForProject', () =>
      generateForProject(context, statusBar)
    ),
    vscode.commands.registerCommand('commentfast.removeComments', () =>
      removeCommentsFromFile(context, statusBar)
    ),
    vscode.commands.registerCommand('commentfast.removeCommentsProject', () =>
      removeCommentsFromProject(context, statusBar)
    ),
    vscode.commands.registerCommand('commentfast.configureApiKey', () =>
      configureApiKey(context)
    ),
    vscode.commands.registerCommand('commentfast.selectProvider', () =>
      selectProvider(context)
    )
  );

  console.log('[commentfast] Extension active.');
}

export function deactivate() {
  console.log('[commentfast] Deactivated.');
}
