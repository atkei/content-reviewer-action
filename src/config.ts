import * as fs from 'fs/promises';
import { dirname, resolve } from 'path';
import {
  createReviewConfig,
  validateConfig,
  type ReviewConfigInput,
  type ReviewConfig,
  type FactCheckConfig,
} from '@content-reviewer/core';
import type { ActionInputs } from './inputs';

type UserConfigFile = Omit<ReviewConfigInput, 'factCheck'> &
  Readonly<{
    instructionFile?: string;
    factCheck?: Partial<FactCheckConfig> & {
      instructionFile?: string;
    };
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
  factCheckInstructionContent?: string;
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

  let factCheckInstructionContent: string | undefined;
  if (fileConfig.factCheck?.instructionFile) {
    const factCheckInstructionPath = resolve(configDir, fileConfig.factCheck.instructionFile);
    try {
      factCheckInstructionContent = await fs.readFile(factCheckInstructionPath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read factCheck.instructionFile "${fileConfig.factCheck.instructionFile}" from config: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return { fileConfig, configDir, instructionContent, factCheckInstructionContent };
}

async function loadOptionalInputFile(
  inputPath: string | undefined,
  label: string
): Promise<string | undefined> {
  if (!inputPath) {
    return undefined;
  }

  const absPath = resolve(process.cwd(), inputPath);
  try {
    return await fs.readFile(absPath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to read ${label} "${inputPath}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function buildFactCheckInput(
  fileFactCheck: UserConfigFile['factCheck'] | undefined,
  inputFactCheck: boolean | undefined,
  instruction: string | undefined
): ReviewConfigInput['factCheck'] | undefined {
  const enabled = inputFactCheck ?? fileFactCheck?.enabled ?? Boolean(instruction);

  if (!enabled) {
    return inputFactCheck === false ? { enabled: false } : undefined;
  }

  return {
    ...fileFactCheck,
    enabled: true,
    instruction: instruction ?? fileFactCheck?.instruction,
  };
}

export async function buildReviewConfig(inputs: ActionInputs): Promise<ReviewConfig> {
  const inputFactCheckInstruction = await loadOptionalInputFile(
    inputs.factCheckInstruction,
    'fact-check-instruction'
  );

  if (!inputs.config) {
    const config = createReviewConfig({
      language: inputs.language,
      llm: {
        provider: inputs.provider,
        apiKey: inputs.apiKey,
        model: inputs.model,
      },
      severityLevel: inputs.severity,
      factCheck: buildFactCheckInput(undefined, inputs.factCheck, inputFactCheckInstruction),
    });
    validateConfig(config);
    return config;
  }

  const { fileConfig, instructionContent, factCheckInstructionContent } = await loadUserConfigFile(
    inputs.config
  );
  const factCheckInstruction = inputFactCheckInstruction ?? factCheckInstructionContent;

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
    severityLevel: inputs.severity ?? fileConfig.severityLevel,
    factCheck: buildFactCheckInput(fileConfig.factCheck, inputs.factCheck, factCheckInstruction),
  });

  validateConfig(config);
  return config;
}
