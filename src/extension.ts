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

  // Boot Tree-sitter async — non-blocking
  TreeSitterService.getInstance().initialize().catch(err =>
    console.warn('[commentasap] Tree-sitter init warning:', err)
  );

  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // ── Register ALL commands first ──────────────────────────────────────────
  // IMPORTANT: every command must be registered before anything tries to call
  // them (status bar click, onboarding, resolveProvider error button, etc.)

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

  // ── NOW safe to wire up the status bar click ─────────────────────────────
  statusBar.setReady();

  // ── First-install onboarding ─────────────────────────────────────────────
  const onboardingDone = context.globalState.get<boolean>(ONBOARDING_KEY, false);
  if (!onboardingDone) {
    await context.globalState.update(ONBOARDING_KEY, true);
    setTimeout(() => runOnboarding(context), 1500);
  }

  console.log('[commentasap] Extension active — all commands registered.');
}

async function runOnboarding(context: vscode.ExtensionContext): Promise<void> {
  const setup = 'Set Up Now';
  const later = 'Later';

  const choice = await vscode.window.showInformationMessage(
    'Welcome to CommentASAP! Select an AI provider and add your API key to get started.',
    { modal: false },
    setup,
    later
  );

  if (choice !== setup) return;

  await vscode.commands.executeCommand('commentasap.selectProvider');

  vscode.window.showInformationMessage(
    'CommentASAP ready! Right-click any code or use Ctrl+Shift+P → "CommentASAP".'
  );
}

export function deactivate() {
  console.log('[commentasap] Deactivated.');
}