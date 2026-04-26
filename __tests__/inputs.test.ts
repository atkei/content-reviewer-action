import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { getInputs } from '../src/inputs';

vi.mock('@actions/core');

describe('getInputs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should parse files input correctly', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'docs/**/*.txt content/*';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    const inputs = getInputs();
    expect(inputs.files).toEqual(['docs/**/*.txt', 'content/*']);
  });

  it('should use default values when not provided', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    const inputs = getInputs();
    expect(inputs.provider).toBe('openai');
    expect(inputs.language).toBe('en');
    expect(inputs.severity).toBe('warning');
    expect(inputs.factCheck).toBeUndefined();
    expect(inputs.factCheckInstruction).toBeUndefined();
    expect(inputs.failOnError).toBe(false);
    expect(inputs.commentPr).toBe(false);
  });

  it('should parse api-key from input', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      if (name === 'api-key') return 'test-api-key';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    const inputs = getInputs();
    expect(inputs.apiKey).toBe('test-api-key');
  });

  it('should allow config file to control provider/language when not explicitly set', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      if (name === 'config') return 'config.json';
      // provider/language not set
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    const inputs = getInputs();
    expect(inputs.provider).toBeUndefined();
    expect(inputs.language).toBeUndefined();
    expect(inputs.config).toBe('config.json');
  });

  it('should parse all custom values', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      const values: Record<string, string> = {
        files: 'src/*.md',
        'api-key': 'my-key',
        provider: 'anthropic',
        model: 'claude-3-opus',
        language: 'ja',
        config: '.reviewrc.json',
        severity: 'error',
        'fact-check': 'true',
        'fact-check-instruction': 'fact-check.md',
      };
      return values[name] || '';
    });
    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      if (name === 'fail-on-error') return true;
      if (name === 'comment-pr') return true;
      return false;
    });

    const inputs = getInputs();
    expect(inputs.files).toEqual(['src/*.md']);
    expect(inputs.apiKey).toBe('my-key');
    expect(inputs.provider).toBe('anthropic');
    expect(inputs.model).toBe('claude-3-opus');
    expect(inputs.language).toBe('ja');
    expect(inputs.config).toBe('.reviewrc.json');
    expect(inputs.severity).toBe('error');
    expect(inputs.factCheck).toBe(true);
    expect(inputs.factCheckInstruction).toBe('fact-check.md');
    expect(inputs.failOnError).toBe(true);
    expect(inputs.commentPr).toBe(true);
  });

  it('should parse fact-check false explicitly', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      if (name === 'fact-check') return 'false';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    const inputs = getInputs();
    expect(inputs.factCheck).toBe(false);
  });

  it('should throw error for invalid provider', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      if (name === 'provider') return 'invalid-provider';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    expect(() => getInputs()).toThrow('Invalid provider: invalid-provider');
  });

  it('should throw error for invalid language', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      if (name === 'language') return 'fr';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    expect(() => getInputs()).toThrow('Invalid language: fr');
  });

  it('should throw error for invalid severity', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      if (name === 'severity') return 'critical';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    expect(() => getInputs()).toThrow('Invalid severity: critical');
  });

  it('should throw error for invalid fact-check boolean', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return 'test.txt';
      if (name === 'fact-check') return 'yes';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    expect(() => getInputs()).toThrow('Invalid boolean value for fact-check: yes');
  });

  it('should throw error when no files specified', () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'files') return '   ';
      return '';
    });
    vi.mocked(core.getBooleanInput).mockReturnValue(false);

    expect(() => getInputs()).toThrow('No files specified');
  });
});
