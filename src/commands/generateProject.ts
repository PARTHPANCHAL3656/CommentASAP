import * as vscode from "vscode";
import { resolveProvider, GenerateOptions } from "../providers/aiProvider";
import { scanWorkspace, readFile } from "../scanner/workspaceScanner";
import { processWithChunks } from "../processor/chunkProcessor";
import { replaceFileContent, stripCodeFences } from "../utils/workspaceEdit";
import { StatusBarManager } from "../utils/statusBar";

interface QueueItem {
  uri: vscode.Uri;
  language: string;
  relativePath: string;
}

async function processFile(
  item: QueueItem,
  provider: ReturnType<typeof resolveProvider> extends Promise<infer T>
    ? T
    : never,
  style: GenerateOptions["style"],
  chunkSize: number,
): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    if (!provider) throw new Error("No provider");
    const source = await readFile(item.uri);

    if (source.trim().length === 0) {
      return { success: true, path: item.relativePath };
    }

    const documented = await processWithChunks(
      source,
      provider,
      { language: item.language, style },
      chunkSize,
    );

    const cleaned = stripCodeFences(documented);
    await replaceFileContent(item.uri, cleaned);

    return { success: true, path: item.relativePath };
  } catch (err: unknown) {
    return {
      success: false,
      path: item.relativePath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function generateForProject(
  context: vscode.ExtensionContext,
  statusBar: StatusBarManager,
): Promise<void> {
  const provider = await resolveProvider(context);
  if (!provider) return;

  statusBar.updateWorking("Scanning project...");

  const files = await scanWorkspace();

  if (files.length === 0) {
    statusBar.updateIdle();
    vscode.window.showInformationMessage(
      "commento: No supported source files found in workspace.",
    );
    return;
  }

  // Confirm with user before modifying many files
  const confirm = await vscode.window.showWarningMessage(
    `commento: About to add documentation to ${files.length} file(s). 
      This will modify all supported source files. 
      Commento: Make sure you have committed to Git first. Continue?`,
    { modal: true },
    "Yes, Document All",
    "Cancel",
  );

  if (confirm !== "Yes, Document All") {
    statusBar.updateIdle();
    return;
  }

  const config = vscode.workspace.getConfiguration("commento");
  const style = config.get<GenerateOptions["style"]>("commentStyle") ?? "jsdoc";
  const chunkSize = config.get<number>("chunkSize") ?? 80;
  const concurrency = config.get<number>("concurrentFiles") ?? 3;

  const errors: string[] = [];
  let completed = 0;

  // Process with bounded concurrency
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "commento: Documenting project",
      cancellable: true,
    },
    async (progress, token) => {
      const queue = [...files];
      const inFlight = new Set<Promise<void>>();

      const processNext = (): void => {
        if (queue.length === 0 || token.isCancellationRequested) return;

        const item = queue.shift()!;
        const task = processFile(item, provider, style, chunkSize).then(
          (result) => {
            completed++;
            if (!result.success && result.error) {
              errors.push(`${result.path}: ${result.error}`);
            }
            progress.report({
              increment: (1 / files.length) * 100,
              message: `${completed}/${files.length} — ${item.relativePath}`,
            });
            inFlight.delete(task);
            processNext(); // pull next item
          },
        );
        inFlight.add(task);
      };

      // Seed initial concurrent batch
      for (let i = 0; i < concurrency && i < files.length; i++) {
        processNext();
      }

      // Wait for all in-flight tasks
      while (inFlight.size > 0) {
        await Promise.race([...inFlight]);
      }
    },
  );

  if (errors.length > 0) {
    const errList = errors.slice(0, 5).join("\n");
    vscode.window.showWarningMessage(
      `commento: Completed with ${errors.length} error(s):\n${errList}`,
    );
    statusBar.updateError(`${errors.length} file(s) failed`);
  } else {
    statusBar.updateDone(`${completed} file(s) documented`);
    vscode.window.showInformationMessage(
      `commento: Successfully documented ${completed} file(s).`,
    );
  }
}
