import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'commento.selectProvider';
    this.updateIdle();
    this.item.show();
  }

  updateIdle(): void {
    this.item.text = '$(book) commento';
    this.item.tooltip = 'Click to switch AI provider';
    this.item.backgroundColor = undefined;
  }

  updateWorking(message: string): void {
    this.item.text = `$(sync~spin) commento: ${message}`;
    this.item.tooltip = 'Processing...';
  }

  updateDone(message: string): void {
    this.item.text = `$(check) commento: ${message}`;
    this.item.tooltip = message;
    setTimeout(() => this.updateIdle(), 3000);
  }

  updateError(message: string): void {
    this.item.text = `$(error) commento: Error`;
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
