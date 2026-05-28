import * as vscode from 'vscode';

/**
 * Replace the entire content of a file via WorkspaceEdit.
 * This is undo-safe — the user can Ctrl+Z after application.
 */
export async function replaceFileContent(
  uri: vscode.Uri,
  newContent: string
): Promise<boolean> {
  const doc = await vscode.workspace.openTextDocument(uri);
  const fullRange = new vscode.Range(
    doc.lineAt(0).range.start,
    doc.lineAt(doc.lineCount - 1).range.end
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, fullRange, newContent);

  return vscode.workspace.applyEdit(edit);
}

/**
 * Replace selected text in the active editor via WorkspaceEdit.
 */
export async function replaceSelection(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  newContent: string
): Promise<boolean> {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(editor.document.uri, selection, newContent);
  return vscode.workspace.applyEdit(edit);
}

/**
 * Strip leading/trailing code fences that some AI models insert
 * despite being told not to.
 */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}
