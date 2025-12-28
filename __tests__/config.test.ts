import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    });
    expect(mocks.validateConfigMock).toHaveBeenCalledTimes(1);
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
          })
        );
      }
      if (p.endsWith('instr.txt')) {
        return Promise.resolve('Instruction from file');
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
        }
      | undefined;

    expect(callArg?.instruction).toBe('Instruction from file');
    expect(callArg?.language).toBe('en');
    expect(callArg?.llm?.provider).toBe('openai');
    expect(callArg?.llm?.model).toBe('claude-x');
    expect(callArg?.llm?.apiKey).toBe('file-key');
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
});
