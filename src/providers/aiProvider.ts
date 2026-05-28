import * as vscode from 'vscode';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'openrouter';

export interface GenerateOptions {
  language: string;
  style: 'jsdoc' | 'inline' | 'both';
  model?: string;
}

// ── Default models per provider ──────────────────────────────────────────────

const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-1.5-pro-latest',
  openrouter: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
};

// ── Language-aware prompt builder ────────────────────────────────────────────

function buildSystemPrompt(language: string, style: string): string {
  const styleGuide =
    style === 'jsdoc'
      ? 'Use JSDoc/docstring-style block comments before each function/class/method.'
      : style === 'inline'
      ? 'Add concise inline comments on complex logic lines only. Do NOT over-comment obvious lines.'
      : 'Use JSDoc/docstring-style block comments for functions/classes AND inline comments for complex logic.';

  const langNote: Record<string, string> = {
    javascript: 'Use /** JSDoc */ for functions/classes.',
    typescript: 'Use /** TSDoc */ for functions/classes and interfaces.',
    python: 'Use Google-style or NumPy-style docstrings for functions/classes.',
    java: 'Use Javadoc /** */ for classes and public methods.',
    cpp: 'Use Doxygen /** */ style for functions and classes.',
    c: 'Use Doxygen /** */ style.',
  };

  return [
    `You are a senior software engineer writing production-quality documentation for ${language} code.`,
    styleGuide,
    langNote[language] ?? `Follow standard ${language} documentation conventions.`,
    'RULES:',
    '1. Return ONLY the original code with comments added. No markdown, no explanations, no code fences.',
    '2. Preserve ALL original code exactly — only add comments, never modify or remove code.',
    '3. Keep comments concise and informative — explain WHY, not WHAT when possible.',
    '4. Do not add comments to trivial single-line assignments.',
    '5. Match the indentation of the surrounding code.',
  ].join('\n');
}

function buildUserPrompt(code: string, language: string): string {
  return `Add documentation comments to the following ${language} code:\n\n${code}`;
}

// ── Provider factory ──────────────────────────────────────────────────────────

export class AIProvider {
  private name: ProviderName;
  private apiKey: string;
  private modelOverride?: string;

  constructor(name: ProviderName, apiKey: string, modelOverride?: string) {
    this.name = name;
    this.apiKey = apiKey;
    this.modelOverride = modelOverride;
  }

  private get model(): string {
    return this.modelOverride || DEFAULT_MODELS[this.name];
  }

  async generate(code: string, opts: GenerateOptions): Promise<string> {
    const systemPrompt = buildSystemPrompt(opts.language, opts.style);
    const userPrompt = buildUserPrompt(code, opts.language);

    switch (this.name) {
      case 'openai':
        return this.callOpenAI(systemPrompt, userPrompt);
      case 'anthropic':
        return this.callAnthropic(systemPrompt, userPrompt);
      case 'gemini':
        return this.callGemini(systemPrompt, userPrompt);
      case 'openrouter':
        return this.callOpenRouter(systemPrompt, userPrompt);
    }
  }

  private async callOpenAI(system: string, user: string): Promise<string> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const res = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  }

  private async callAnthropic(system: string, user: string): Promise<string> {
    const client = new Anthropic({ apiKey: this.apiKey });
    const res = await client.messages.create({
      model: this.model,
      system,
      messages: [{ role: 'user', content: user }],
      temperature: 0.2,
      max_tokens: 4096,
    });
    const block = res.content[0];
    return block.type === 'text' ? block.text.trim() : '';
  }

  private async callGemini(system: string, user: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(`${system}\n\n${user}`);
    return result.response.text().trim();
  }

  private async callOpenRouter(system: string, user: string): Promise<string> {
  const client = new OpenAI({
    apiKey: this.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/commento-vscode',
      'X-Title': 'Commento VS Code Extension',
    },
  });
  const res = await client.chat.completions.create({
    model: this.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}

}
  

// ── Resolve active provider from VS Code config + SecretStorage ───────────────

export async function resolveProvider(
  context: vscode.ExtensionContext
): Promise<AIProvider | null> {

  const config = vscode.workspace.getConfiguration('commento');

  const providerName = (config.get<string>('provider') ?? 'openai') as ProviderName;
  const modelOverride = config.get<string>('model') ?? undefined;

  const apiKey = await context.secrets.get(`commento.apiKey.${providerName}`);

  if (!apiKey) {
    const configure = 'Configure Now';
    const choice = await vscode.window.showErrorMessage(
      `Commento: No API key found for ${providerName}. Please configure it first.`,
      configure
    );
    if (choice === configure) {
      vscode.commands.executeCommand('Commento.configureApiKey');
    }
    return null;
  }

  return new AIProvider(providerName, apiKey, modelOverride);
}
