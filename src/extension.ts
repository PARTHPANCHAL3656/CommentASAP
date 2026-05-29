import * as vscode from 'vscode';
import { generateForSelection } from './commands/generateSelection';
import { generateForFile } from './commands/generateFile';
import { generateForProject } from './commands/generateProject';
import { removeCommentsFromFile, removeCommentsFromProject } from './commands/removeComments';
import { configureApiKey, selectProvider } from './commands/configure';
import { TreeSitterService } from './processor/treeSitterService';
import { StatusBarManager } from './utils/statusBar';

const ONBOARDING_KEY = 'commentasap.onboardingComplete';

export async function activate(context: vscode.ExtensionContext) {
  console.log('[commentasap] Extension activating...');

  // Boot Tree-sitter async — non-blocking, errors are soft-handled inside the service
  TreeSitterService.getInstance().initialize().catch(err =>
    console.warn('[commentasap] Tree-sitter init warning:', err)
  );

  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // ── Register all commands ────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('commentasap.generateForSelection', () =>
      generateForSelection(context, statusBar)
    ),
    vscode.commands.registerCommand('commentasap.generateForFile', () =>
      generateForFile(context, statusBar)
    ),
    vscode.commands.registerCommand('commentasap.generateForProject', () =>
      generateForProject(context, statusBar)
    ),
    vscode.commands.registerCommand('commentasap.removeComments', () =>
      removeCommentsFromFile(context, statusBar)
    ),
    vscode.commands.registerCommand('commentasap.removeCommentsProject', () =>
      removeCommentsFromProject(context, statusBar)
    ),
    vscode.commands.registerCommand('commentasap.configureApiKey', () =>
      configureApiKey(context)
    ),
    vscode.commands.registerCommand('commentasap.selectProvider', () =>
      selectProvider(context)
    )
  );

  // ── First-install onboarding ─────────────────────────────────────────────
  // Show setup prompt once — the first time the extension activates on a machine.
  // Uses globalState so it only triggers once per install, not per workspace.

  const onboardingDone = context.globalState.get<boolean>(ONBOARDING_KEY, false);
  if (!onboardingDone) {
    await context.globalState.update(ONBOARDING_KEY, true);
    // Small delay so VS Code finishes loading before showing the modal
    setTimeout(() => runOnboarding(context), 1500);
  }

  console.log('[commentasap] Extension active.');
}

async function runOnboarding(context: vscode.ExtensionContext): Promise<void> {
  const setup = 'Set Up Now';
  const later = 'Later';

  const choice = await vscode.window.showInformationMessage(
    'Welcome to CommentASAP! To get started, select an AI provider and add your API key.',
    { modal: false },
    setup,
    later
  );

  if (choice !== setup) return;

  // Step 1: pick a provider
  await vscode.commands.executeCommand('commentasap.selectProvider');

  // Step 2: selectProvider already prompts for API key if none exists,
  // so we're done. Show a final tip.
  vscode.window.showInformationMessage(
    'CommentASAP ready! Right-click code in the editor or use Ctrl+Shift+P → "CommentASAP".'
  );
}

export function deactivate() {
  console.log('[commentasap] Deactivated.');
}