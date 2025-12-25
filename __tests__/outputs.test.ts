import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { setOutputs } from '../src/outputs';
import type { ReviewResults } from '../src/reviewer';

vi.mock('@actions/core');

describe('setOutputs', () => {
  const mockSummary = {
    addHeading: vi.fn().mockReturnThis(),
    addRaw: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(core, 'summary', {
      value: mockSummary,
      writable: true,
    });
  });

  it('should set all outputs correctly', () => {
    const results: ReviewResults = {
      files: [
        {
          path: 'test.txt',
          result: {
            source: 'test.txt',
            issues: [{ severity: 'error', message: 'Test error' }],
            summary: 'Found issues',
            reviewedAt: new Date(),
          },
        },
      ],
      summary: 'Reviewed 1 file(s): 1 error(s), 0 warning(s), 1 total issue(s)',
      hasErrors: true,
      hasWarnings: false,
    };

    setOutputs(results);

    expect(core.setOutput).toHaveBeenCalledWith('results', expect.any(String));
    expect(core.setOutput).toHaveBeenCalledWith('summary', results.summary);
    expect(core.setOutput).toHaveBeenCalledWith('has-errors', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('has-warnings', 'false');
  });

  it('should output JSON results', () => {
    const results: ReviewResults = {
      files: [
        {
          path: 'doc.md',
          result: {
            source: 'doc.md',
            issues: [],
            summary: 'No issues',
            reviewedAt: new Date(),
          },
        },
      ],
      summary: 'All good',
      hasErrors: false,
      hasWarnings: false,
    };

    setOutputs(results);

    const setOutputCalls = vi.mocked(core.setOutput).mock.calls;
    const resultsCall = setOutputCalls.find((call) => call[0] === 'results');
    expect(resultsCall).toBeDefined();

    const parsedResults = JSON.parse(resultsCall![1] as string) as {
      files: unknown[];
      summary: string;
      hasErrors: boolean;
      hasWarnings: boolean;
    };
    expect(parsedResults.files).toHaveLength(1);
    expect(parsedResults.summary).toBe('All good');
    expect(parsedResults.hasErrors).toBe(false);
    expect(parsedResults.hasWarnings).toBe(false);
  });

  it('should add to job summary', () => {
    const results: ReviewResults = {
      files: [],
      summary: 'Test summary',
      hasErrors: false,
      hasWarnings: false,
    };

    setOutputs(results);

    expect(mockSummary.addHeading).toHaveBeenCalledWith('Content Review Results');
    expect(mockSummary.addRaw).toHaveBeenCalledWith('Test summary');
    expect(mockSummary.write).toHaveBeenCalled();
  });
});
