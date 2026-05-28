import * as vscode from 'vscode';
import { resolveProvider, GenerateOptions } from '../providers/aiProvider';
import { detectLanguage } from '../scanner/workspaceScanner';
import { replaceSelection, stripCodeFences } from '../utils/workspaceEdit';
import { StatusBarManager } from '../utils/statusBar';
import { showDiffAndConfirm, registerDiffProvider } from '../utils/diffPreview';

export async function generateForSelection(
  context: vscode.ExtensionContext,
  statusBar: StatusBarManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('commentasap: No active editor.');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('commentasap: No text selected. Select code first.');
    return;
  }

  const language = detectLanguage(editor.document);
  if (!language) {
    vscode.window.showWarningMessage(
      `commentasap: Unsupported language "${editor.document.languageId}".`
    );
    return;
  }
  
  registerDiffProvider(context);
  const provider = await resolveProvider(context);
  if (!provider) return;

  const selectedText = editor.document.getText(selection);
  const config = vscode.workspace.getConfiguration('commentasap');
  const style = config.get<GenerateOptions['style']>('commentStyle') ?? 'jsdoc';

  statusBar.updateWorking('Documenting selection...');

  try {
    const result = await provider.generate(selectedText, { language, style });
    const cleaned = stripCodeFences(result);

  if (cleaned.trim().length < selectedText.trim().length * 0.7) {
    vscode.window.showErrorMessage(
      'CommentASAP: AI returned shorter output than input — aborting to protect your code. Try again.'
    );
    statusBar.updateIdle();
    return;
  }

  const confirmed = await showDiffAndConfirm(
    editor.document.uri,
    selectedText,
    cleaned,
    'selection'
  );

  if (!confirmed) {
    statusBar.updateIdle();
    return;
  }

  await replaceSelection(editor, selection, cleaned);

    statusBar.updateDone('Selection documented');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    statusBar.updateError(msg);
    vscode.window.showErrorMessage(`commentasap Error: ${msg}`);
  }
}
