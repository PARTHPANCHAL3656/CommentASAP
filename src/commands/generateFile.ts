import * as vscode from "vscode";
import { resolveProvider, GenerateOptions } from "../providers/aiProvider";
import { detectLanguage } from "../scanner/workspaceScanner";
import { processWithChunks } from "../processor/chunkProcessor";
import { replaceFileContent, stripCodeFences } from "../utils/workspaceEdit";
import { showDiffAndConfirm, registerDiffProvider } from "../utils/diffPreview";
import { StatusBarManager } from "../utils/statusBar";

export async function generateForFile(
  context: vscode.ExtensionContext,
  statusBar: StatusBarManager,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("commentasap: No active editor.");
    return;
  }

  const language = detectLanguage(editor.document);
  if (!language) {
    vscode.window.showWarningMessage(
      `commentasap: Unsupported language "${editor.document.languageId}".`,
    );
    return;
  }

  const provider = await resolveProvider(context);
  if (!provider) return;

  // Register diff provider if not already done
  registerDiffProvider(context);

  const source = editor.document.getText();
  const config = vscode.workspace.getConfiguration("commentasap");
  const style = config.get<GenerateOptions["style"]>("commentStyle") ?? "jsdoc";
  const chunkSize = config.get<number>("chunkSize") ?? 80;

  const fileName = editor.document.fileName.split("/").pop() ?? "file";
  statusBar.updateWorking(`Documenting ${fileName}...`);

  try {
    const documented = await processWithChunks(
      source,
      provider,
      { language, style },
      chunkSize,
      (chunkIdx, total) => {
        statusBar.updateWorking(
          total > 1
            ? `Chunk ${chunkIdx}/${total} — ${fileName}`
            : `Documenting ${fileName}...`,
        );
      },
    );

    const cleaned = stripCodeFences(documented);

    if (cleaned.trim().length < source.trim().length * 0.5) {
      vscode.window.showErrorMessage(
        "CommentASAP: AI returned suspiciously short output. Aborting to protect your file.",
      );
      statusBar.updateIdle();
      return;
    }

    // Diff preview
    const confirmed = await showDiffAndConfirm(
      editor.document.uri,
      source,
      cleaned,
      fileName,
    );

    if (!confirmed) {
      statusBar.updateIdle();
      vscode.window.showInformationMessage("commentasap: Changes discarded.");
      return;
    }

    const success = await replaceFileContent(editor.document.uri, cleaned);
    if (success) {
      statusBar.updateDone(`${fileName} documented`);
    } else {
      throw new Error("WorkspaceEdit failed to apply.");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    statusBar.updateError(msg);
    vscode.window.showErrorMessage(`commentasap Error: ${msg}`);
  }
}
