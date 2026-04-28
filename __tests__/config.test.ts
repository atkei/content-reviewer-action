import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'path';
import type { ActionInputs } from '../src/inputs';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  createReviewConfigMock: vi.fn(),
  validateConfigMock: vi.fn(),
}));

vi.mock('@content-reviewer/core', () => {
  return {
    createReviewConfig: mocks.createReviewConfigMock,
    validateConfig: mocks.validateConfigMock,
  };
});

import { readFile } from 'fs/promises';
import { buildReviewConfig } from '../src/config';

describe('buildReviewConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createReviewConfigMock.mockImplementation((input: unknown) => ({
      ...(input as object),
      llm: { provider: 'openai', model: 'gpt-4.1-mini' },
      language: 'en',
      factCheck: { enabled: false },
    }));
  });

  it('should build config from inputs when config is not provided', async () => {
    const inputs: ActionInputs = {
      files: ['test.txt'],
      provider: 'openai',
      language: 'en',
      apiKey: 'k',
      model: 'm',
      severity: 'warning',
      failOnError: false,
      commentPr: false,
    };

    await buildReviewConfig(inputs);

    expect(mocks.createReviewConfigMock).toHaveBeenCalledWith({
      language: 'en',
      llm: { provider: 'openai', apiKey: 'k', model: 'm' },
      severityLevel: 'warning',
      factCheck: undefined,
    });
    expect(mocks.validateConfigMock).toHaveBeenCalledTimes(1);
  });

  it('should pass fact-check inputs when config is not provided', async () => {
    vi.mocked(readFile).mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith('fact-check.md')) {
        return Promise.resolve('Fact-check instruction from input');
      }
      throw new Error(`Unexpected readFile: ${p}`);
    });

    const inputs: ActionInputs = {
      files: ['test.txt'],
      provider: 'openai',
      language: 'en',
      severity: 'warning',
      factCheck: true,
      factCheckInstruction: 'fact-check.md',
      failOnError: false,
      commentPr: false,
    };

    await buildReviewConfig(inputs);

    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      resolve(process.cwd(), 'fact-check.md'),
      'utf-8'
    );
    expect(mocks.createReviewConfigMock).toHaveBeenCalledWith({
      language: 'en',
      llm: { provider: 'openai', apiKey: undefined, model: undefined },
      severityLevel: 'warning',
      factCheck: {
        enabled: true,
        instruction: 'Fact-check instruction from input',
      },
    });
  });

  it('should not enable fact-check from instruction input alone', async () => {
    const inputs: ActionInputs = {
      files: ['test.txt'],
      provider: 'openai',
      language: 'en',
      severity: 'warning',
      factCheckInstruction: 'fact-check.md',
      failOnError: false,
      commentPr: false,
    };

    await buildReviewConfig(inputs);

    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    expect(mocks.createReviewConfigMock).toHaveBeenCalledWith({
      language: 'en',
      llm: { provider: 'openai', apiKey: undefined, model: undefined },
      severityLevel: 'warning',
      factCheck: undefined,
    });
  });

  it('should load JSON config file and merge with inputs (inputs win)', async () => {
    vi.mocked(readFile).mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith('config.json')) {
        return Promise.resolve(
          JSON.stringify({
            language: 'ja',
            llm: { provider: 'anthropic', model: 'claude-x', apiKey: 'file-key' },
            instructionFile: 'instr.txt',
            factCheck: {
              enabled: true,
              instructionFile: 'fact-check.txt',
            },
          })
        );
      }
      if (p.endsWith('instr.txt')) {
        return Promise.resolve('Instruction from file');
      }
      if (p.endsWith('fact-check.txt')) {
        return Promise.resolve('Fact-check instruction from file');
      }
      throw new Error(`Unexpected readFile: ${p}`);
    });

    const inputs: ActionInputs = {
      files: ['test.txt'],
      provider: 'openai',
      language: 'en',
      // no apiKey/model => keep file values
      severity: 'warning',
      failOnError: false,
      commentPr: false,
      config: 'config.json',
    };

    await buildReviewConfig(inputs);

    const calls = mocks.createReviewConfigMock.mock.calls as Array<[unknown]>;
    const callArg = calls[0]?.[0] as
      | {
          instruction?: string;
          language?: string;
          llm?: { provider?: string; model?: string; apiKey?: string };
          factCheck?: { enabled?: boolean; instruction?: string };
        }
      | undefined;

    expect(callArg?.instruction).toBe('Instruction from file');
    expect(callArg?.language).toBe('en');
    expect(callArg?.llm?.provider).toBe('openai');
    expect(callArg?.llm?.model).toBe('claude-x');
    expect(callArg?.llm?.apiKey).toBe('file-key');
    expect(callArg?.factCheck).toEqual({
      enabled: true,
      instruction: 'Fact-check instruction from file',
    });
    expect(mocks.validateConfigMock).toHaveBeenCalledTimes(1);
  });

  it('should use provider/language from config file when inputs are not set', async () => {
    vi.mocked(readFile).mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith('config.json')) {
        return Promise.resolve(
          JSON.stringify({
            language: 'ja',
            llm: { provider: 'anthropic', model: 'claude-x', apiKey: 'file-key' },
          })
        );
      }
      throw new Error(`Unexpected readFile: ${p}`);
    });

    const inputs: ActionInputs = {
      files: ['test.txt'],
      severity: 'warning',
      failOnError: false,
      commentPr: false,
      config: 'config.json',
    };

    await buildReviewConfig(inputs);

    const calls = mocks.createReviewConfigMock.mock.calls as Array<[unknown]>;
    const callArg = calls[0]?.[0] as { language?: string; llm?: { provider?: string } } | undefined;

    expect(callArg?.language).toBe('ja');
    expect(callArg?.llm?.provider).toBe('anthropic');
  });

  it('should allow action input to disable fact-check from config file', async () => {
    vi.mocked(readFile).mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith('config.json')) {
        return Promise.resolve(
          JSON.stringify({
            factCheck: { enabled: true, instruction: 'From config' },
          })
        );
      }
      throw new Error(`Unexpected readFile: ${p}`);
    });

    const inputs: ActionInputs = {
      files: ['test.txt'],
      severity: 'warning',
      factCheck: false,
      failOnError: false,
      commentPr: false,
      config: 'config.json',
    };

    await buildReviewConfig(inputs);

    const calls = mocks.createReviewConfigMock.mock.calls as Array<[unknown]>;
    const callArg = calls[0]?.[0] as { factCheck?: { enabled?: boolean } } | undefined;

    expect(callArg?.factCheck).toEqual({ enabled: false });
  });

  it('should preserve disabled fact-check from config file', async () => {
    vi.mocked(readFile).mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith('config.json')) {
        return Promise.resolve(
          JSON.stringify({
            factCheck: {
              enabled: false,
              instruction: 'Disabled instruction',
              userLocation: { country: 'JP' },
            },
          })
        );
      }
      throw new Error(`Unexpected readFile: ${p}`);
    });

    const inputs: ActionInputs = {
      files: ['test.txt'],
      severity: 'warning',
      failOnError: false,
      commentPr: false,
      config: 'config.json',
    };

    await buildReviewConfig(inputs);

    const calls = mocks.createReviewConfigMock.mock.calls as Array<[unknown]>;
    const callArg = calls[0]?.[0] as
      | {
          factCheck?: {
            enabled?: boolean;
            instruction?: string;
            userLocation?: { country?: string };
          };
        }
      | undefined;

    expect(callArg?.factCheck).toEqual({
      enabled: false,
      instruction: 'Disabled instruction',
      userLocation: { country: 'JP' },
    });
  });
});
