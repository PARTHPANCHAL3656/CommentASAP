import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    // NOTE: command is set AFTER registration in extension.ts via setReady()
    // Do NOT set it here — the command doesn't exist yet when the item is created
    this.updateIdle();
    this.item.show();
  }

  /** Call this after all commands are registered in extension.ts activate() */
  setReady(): void {
    this.item.command = 'commentasap.selectProvider';
    this.item.tooltip = 'Click to switch AI provider';
  }

  updateIdle(): void {
    this.item.text = '$(book) commentasap';
    this.item.tooltip = 'CommentASAP — loading...';
  }

  updateWorking(message: string): void {
    this.item.text = `$(sync~spin) commentasap: ${message}`;
    this.item.tooltip = 'Processing...';
  }

  updateDone(message: string): void {
    this.item.text = `$(check) commentasap: ${message}`;
    this.item.tooltip = message;
    setTimeout(() => this.updateIdle(), 3000);
  }

  updateError(message: string): void {
    this.item.text = `$(error) commentasap: Error`;
    this.item.tooltip = message;
    this.item.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground'
    );
    setTimeout(() => this.updateIdle(), 5000);
  }

  dispose(): void {
    this.item.dispose();
  }
}
