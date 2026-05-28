import * as vscode from 'vscode';
import { ProviderName } from '../providers/aiProvider';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: 'OpenAI (GPT-4o)',
  anthropic: 'Anthropic (Claude Sonnet)',
  gemini: 'Google (Gemini 1.5 Pro)',
  openrouter: 'OpenRouter (free & paid models)',
};

/**
 * Prompt user to enter their API key for the currently selected provider,
 * then store it in VS Code SecretStorage (encrypted, local, never synced).
 */
export async function configureApiKey(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration('commento');
  const currentProvider = (config.get<string>('provider') ?? 'openai') as ProviderName;
  const providerLabel = PROVIDER_LABELS[currentProvider];

  const apiKey = await vscode.window.showInputBox({
    title: `commento: API Key for ${providerLabel}`,
    prompt: `Enter your ${providerLabel} API key. It will be stored securely in VS Code's secret storage.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) =>
      v.trim().length < 10 ? 'API key seems too short' : null,
  });

  if (!apiKey) return; // User cancelled

  await context.secrets.store(
    `commento.apiKey.${currentProvider}`,
    apiKey.trim()
  );

  vscode.window.showInformationMessage(
    `commento: API key saved for ${providerLabel}.`
  );
}

/**
 * Show a quick-pick to switch the active AI provider.
 * Also prompts to set an API key if one isn't configured yet.
 */
export async function selectProvider(
  context: vscode.ExtensionContext
): Promise<void> {
  const items = (Object.entries(PROVIDER_LABELS) as [ProviderName, string][]).map(
    ([id, label]) => ({
      label,
      description: id,
      id,
    })
  );

  const picked = await vscode.window.showQuickPick(items, {
    title: 'commento: Select AI Provider',
    placeHolder: 'Which AI provider should commento use?',
  });

  if (!picked) return;

  const config = vscode.workspace.getConfiguration('commento');
  await config.update('provider', picked.id, vscode.ConfigurationTarget.Global);

  const existingKey = await context.secrets.get(
    `commento.apiKey.${picked.id}`
  );

  if (!existingKey) {
    const configure = 'Add API Key';
    const skip = 'Skip for Now';
    const choice = await vscode.window.showInformationMessage(
      `Switched to ${picked.label}. No API key found — add one now?`,
      configure,
      skip
    );
    if (choice === configure) {
      await configureApiKey(context);
    }
  } else {
    vscode.window.showInformationMessage(
      `commento: Now using ${picked.label}.`
    );
  }
}
