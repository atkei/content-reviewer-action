import * as fs from 'fs/promises';
import { dirname, resolve } from 'path';
import {
  createReviewConfig,
  validateConfig,
  type ReviewConfigInput,
  type ReviewConfig,
} from '@content-reviewer/core';
import type { ActionInputs } from './inputs';

type UserConfigFile = ReviewConfigInput &
  Readonly<{
    instructionFile?: string;
  }>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUserConfigFile(raw: unknown): UserConfigFile {
  // We keep this intentionally permissive; validateConfig() will do strict checks later.
  if (!isObject(raw)) return {};
  return raw as UserConfigFile;
}

async function loadUserConfigFile(configPath: string): Promise<{
  fileConfig: UserConfigFile;
  configDir: string;
  instructionContent?: string;
}> {
  const absConfigPath = resolve(process.cwd(), configPath);
  let rawText: string;
  try {
    rawText = await fs.readFile(absConfigPath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to read config file "${configPath}": ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error(
      `Failed to parse config file "${configPath}" as JSON. Please check the syntax. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const fileConfig = normalizeUserConfigFile(parsed);
  const configDir = dirname(absConfigPath);

  let instructionContent: string | undefined;
  if (fileConfig.instructionFile) {
    const instructionPath = resolve(configDir, fileConfig.instructionFile);
    try {
      instructionContent = await fs.readFile(instructionPath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read instructionFile "${fileConfig.instructionFile}" from config: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return { fileConfig, configDir, instructionContent };
}

export async function buildReviewConfig(inputs: ActionInputs): Promise<ReviewConfig> {
  if (!inputs.config) {
    const config = createReviewConfig({
      language: inputs.language,
      llm: {
        provider: inputs.provider,
        apiKey: inputs.apiKey,
        model: inputs.model,
      },
    });
    validateConfig(config);
    return config;
  }

  const { fileConfig, instructionContent } = await loadUserConfigFile(inputs.config);

  const config = createReviewConfig({
    ...fileConfig,
    instruction: instructionContent ?? fileConfig.instruction,
    language: inputs.language ?? fileConfig.language,
    llm: {
      ...fileConfig.llm,
      provider: inputs.provider ?? fileConfig.llm?.provider,
      apiKey: inputs.apiKey ?? fileConfig.llm?.apiKey,
      model: inputs.model ?? fileConfig.llm?.model,
    },
  });

  validateConfig(config);
  return config;
}
