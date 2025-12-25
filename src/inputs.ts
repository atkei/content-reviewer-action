import * as core from '@actions/core';

export type Provider = 'openai' | 'anthropic' | 'google';
export type Language = 'ja' | 'en';

export type ActionInputs = Readonly<{
  files: string[];
  apiKey?: string;
  provider?: Provider;
  model?: string;
  language?: Language;
  config?: string;
  failOnError: boolean;
  commentPr: boolean;
}>;

function isValidProvider(value: string): value is Provider {
  return ['openai', 'anthropic', 'google'].includes(value);
}

function isValidLanguage(value: string): value is Language {
  return ['ja', 'en'].includes(value);
}

export function getInputs(): ActionInputs {
  const filesInput = core.getInput('files', { required: true });
  const files = filesInput.split(/\s+/).filter((f) => f.length > 0);

  if (files.length === 0) {
    throw new Error('No files specified');
  }

  const config = core.getInput('config') || undefined;

  const providerRaw = core.getInput('provider') || undefined;
  let provider: Provider | undefined;
  if (providerRaw) {
    if (!isValidProvider(providerRaw)) {
      throw new Error(
        `Invalid provider: ${providerRaw}. Must be one of: openai, anthropic, google`
      );
    }
    provider = providerRaw;
  } else if (!config) {
    // When config is not provided, default in code for backward compatibility.
    provider = 'openai';
  }

  // API key is intentionally NOT resolved from env vars here.
  // @content-reviewer/core resolves provider-specific env vars based on the final merged config.
  const apiKey = core.getInput('api-key') || undefined;

  const model = core.getInput('model') || undefined;

  const languageRaw = core.getInput('language') || undefined;
  let language: Language | undefined;
  if (languageRaw) {
    if (!isValidLanguage(languageRaw)) {
      throw new Error(`Invalid language: ${languageRaw}. Must be one of: ja, en`);
    }
    language = languageRaw;
  } else if (!config) {
    // When config is not provided, default in code for backward compatibility.
    language = 'en';
  }

  const failOnError = core.getBooleanInput('fail-on-error');
  const commentPr = core.getBooleanInput('comment-pr');

  return {
    files,
    apiKey,
    provider,
    model,
    language,
    config,
    failOnError,
    commentPr,
  };
}
