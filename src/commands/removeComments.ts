import * as vscode from 'vscode';
import { TreeSitterService } from '../processor/treeSitterService';
import { detectLanguage, scanWorkspace, readFile } from '../scanner/workspaceScanner';
import { replaceFileContent } from '../utils/workspaceEdit';
import { showDiffAndConfirm, registerDiffProvider } from '../utils/diffPreview';
import { StatusBarManager } from '../utils/statusBar';

export async function removeCommentsFromFile(
  context: vscode.ExtensionContext,
  statusBar: StatusBarManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('commentfast: No active editor.');
    return;
  }

  const language = detectLanguage(editor.document);
  if (!language) {
    vscode.window.showWarningMessage(
      `commentfast: Unsupported language "${editor.document.languageId}".`
    );
    return;
  }

  const treeSitter = TreeSitterService.getInstance();
  if (!treeSitter.isSupportedLanguage(language)) {
  if (['html', 'css', 'scss'].includes(language)) {
    registerDiffProvider(context);
    const source = editor.document.getText();
    const cleaned = treeSitter.removeCommentsSimple(source, language);
    const confirmed = await showDiffAndConfirm(editor.document.uri, source, cleaned, editor.document.fileName.split('/').pop() ?? 'file');
    if (confirmed) await replaceFileContent(editor.document.uri, cleaned);
    statusBar.updateIdle();
  } else {
    vscode.window.showWarningMessage(`CommentFast: Comment removal not yet supported for ${language}.`);
  }
  return;
}

  registerDiffProvider(context);

  const source = editor.document.getText();
  const fileName = editor.document.fileName.split('/').pop() ?? 'file';

  statusBar.updateWorking(`Removing comments from ${fileName}...`);

  try {
    const cleaned = await treeSitter.removeComments(
      source,
      language,
      context.extensionUri
    );

    const confirmed = await showDiffAndConfirm(
      editor.document.uri,
      source,
      cleaned,
      `${fileName} (remove comments)`
    );

    if (!confirmed) {
      statusBar.updateIdle();
      vscode.window.showInformationMessage('commentfast: Changes discarded.');
      return;
    }

    const success = await replaceFileContent(editor.document.uri, cleaned);
    if (success) {
      statusBar.updateDone('Comments removed');
    } else {
      throw new Error('WorkspaceEdit apply failed.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    statusBar.updateError(msg);
    vscode.window.showErrorMessage(`commentfast Error: ${msg}`);
  }
}

export async function removeCommentsFromProject(
  context: vscode.ExtensionContext,
  statusBar: StatusBarManager
): Promise<void> {
  const treeSitter = TreeSitterService.getInstance();
  const files = await scanWorkspace();

  // Only include files with Tree-sitter support
  const supported = files.filter(f => treeSitter.isSupportedLanguage(f.language));

  if (supported.length === 0) {
    vscode.window.showInformationMessage('commentfast: No supported files found.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `commentfast: Remove all comments from ${supported.length} file(s)? This cannot be undone except via Git.`,
    { modal: true },
    'Yes, Remove All',
    'Cancel'
  );

  if (confirm !== 'Yes, Remove All') {
    statusBar.updateIdle();
    return;
  }

  let completed = 0;
  const errors: string[] = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'commentfast: Removing comments',
      cancellable: true,
    },
    async (progress, token) => {
      for (const file of supported) {
        if (token.isCancellationRequested) break;

        try {
          const source = await readFile(file.uri);
          const cleaned = await treeSitter.removeComments(
            source,
            file.language as Parameters<typeof treeSitter.removeComments>[1],
            context.extensionUri
          );
          await replaceFileContent(file.uri, cleaned);
          completed++;
        } catch (err: unknown) {
          errors.push(
            `${file.relativePath}: ${err instanceof Error ? err.message : String(err)}`
          );
        }

        progress.report({
          increment: (1 / supported.length) * 100,
          message: `${completed}/${supported.length} — ${file.relativePath}`,
        });
      }
    }
  );

  if (errors.length > 0) {
    statusBar.updateError(`${errors.length} error(s)`);
    vscode.window.showWarningMessage(
      `commentfast: Done with ${errors.length} error(s). First: ${errors[0]}`
    );
  } else {
    statusBar.updateDone(`Comments removed from ${completed} file(s)`);
    vscode.window.showInformationMessage(
      `commentfast: Removed comments from ${completed} file(s).`
    );
  }
}
