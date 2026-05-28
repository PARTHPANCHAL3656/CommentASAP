/**
 * DiffPreview — opens a side-by-side diff view in VS Code before applying
 * AI-generated documentation to a file.
 *
 * The user sees "Before" (original) vs "After" (documented) and can
 * choose to Apply or Discard.
 */

import * as vscode from 'vscode';

// Virtual document content provider for diff view
const SCHEME = 'commento-diff';

const contentMap = new Map<string, string>();

class commentoContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return contentMap.get(uri.toString()) ?? '';
  }

  update(uri: vscode.Uri, content: string): void {
    contentMap.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }
}

let _provider: commentoContentProvider | undefined;

export function registerDiffProvider(context: vscode.ExtensionContext): void {
  _provider = new commentoContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, _provider)
  );
}

/**
 * Show a diff view between `original` and `documented` content.
 * Returns true if the user confirms they want to apply the changes.
 *
 * Falls back to silent apply if showDiffPreview setting is false.
 */
export async function showDiffAndConfirm(
  fileUri: vscode.Uri,
  original: string,
  documented: string,
  label: string
): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('commento');
  const showDiff = config.get<boolean>('showDiffPreview', true);

  if (!showDiff) return true;

  if (!_provider) {
    // Provider not registered — skip diff
    return true;
  }

  const key = fileUri.toString();

  const originalUri = vscode.Uri.parse(
    `${SCHEME}:${encodeURIComponent(key)}-original`
  );
  const documentedUri = vscode.Uri.parse(
    `${SCHEME}:${encodeURIComponent(key)}-documented`
  );

  _provider.update(originalUri, original);
  _provider.update(documentedUri, documented);

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalUri,
    documentedUri,
    `commento: ${label} ← Before | After →`,
    { preview: true }
  );

  const apply = 'Apply Changes';
  const discard = 'Discard';

  const choice = await vscode.window.showInformationMessage(
    `commento: Review changes for ${label}. Apply?`,
    { modal: true },
    apply,
    discard
  );

  // Clean up virtual docs
  contentMap.delete(originalUri.toString());
  contentMap.delete(documentedUri.toString());

  return choice === apply;
}
