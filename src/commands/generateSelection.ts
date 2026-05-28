import * as vscode from 'vscode';
import { resolveProvider, GenerateOptions } from '../providers/aiProvider';
import { detectLanguage } from '../scanner/workspaceScanner';
import { replaceSelection, stripCodeFences } from '../utils/workspaceEdit';
import { StatusBarManager } from '../utils/statusBar';

export async function generateForSelection(
  context: vscode.ExtensionContext,
  statusBar: StatusBarManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('commentfast: No active editor.');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('commentfast: No text selected. Select code first.');
    return;
  }

  const language = detectLanguage(editor.document);
  if (!language) {
    vscode.window.showWarningMessage(
      `commentfast: Unsupported language "${editor.document.languageId}".`
    );
    return;
  }

  const provider = await resolveProvider(context);
  if (!provider) return;

  const selectedText = editor.document.getText(selection);
  const config = vscode.workspace.getConfiguration('commentfast');
  const style = config.get<GenerateOptions['style']>('commentStyle') ?? 'jsdoc';

  statusBar.updateWorking('Documenting selection...');

  try {
    const result = await provider.generate(selectedText, { language, style });
    const cleaned = stripCodeFences(result);

    await replaceSelection(editor, selection, cleaned);
    statusBar.updateDone('Selection documented');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    statusBar.updateError(msg);
    vscode.window.showErrorMessage(`commentfast Error: ${msg}`);
  }
}
