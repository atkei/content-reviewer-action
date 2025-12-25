import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActionInputs } from '../src/inputs';

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('Test content'),
}));

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

const mockReviewFn = vi.fn();

vi.mock('@content-reviewer/core', () => {
  return {
    ContentReviewer: class MockContentReviewer {
      review = mockReviewFn;
    },
    createReviewConfig: vi.fn().mockReturnValue({
      language: 'en',
      llm: { provider: 'openai', model: 'gpt-4.1-mini' },
    }),
    validateConfig: vi.fn(),
  };
});

import { reviewFiles } from '../src/reviewer';
import { glob } from 'glob';

describe('reviewFiles', () => {
  const defaultInputs: ActionInputs = {
    files: ['test.txt'],
    provider: 'openai',
    language: 'en',
    failOnError: false,
    commentPr: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewFn.mockResolvedValue({
      source: 'test.txt',
      issues: [
        { severity: 'error', message: 'Test error' },
        { severity: 'warning', message: 'Test warning' },
      ],
      summary: 'Found issues',
      reviewedAt: new Date(),
    });
  });

  it('should return empty results when no files match', async () => {
    vi.mocked(glob).mockResolvedValue([]);

    const results = await reviewFiles(defaultInputs);

    expect(results.files).toHaveLength(0);
    expect(results.summary).toBe('No files matched the specified patterns');
    expect(results.hasErrors).toBe(false);
    expect(results.hasWarnings).toBe(false);
  });

  it('should expand glob patterns and review files', async () => {
    vi.mocked(glob).mockResolvedValue(['test.txt']);

    const results = await reviewFiles(defaultInputs);

    expect(results.files).toHaveLength(1);
    expect(results.hasErrors).toBe(true);
    expect(results.hasWarnings).toBe(true);
    expect(mockReviewFn).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate files from multiple patterns', async () => {
    vi.mocked(glob)
      .mockResolvedValueOnce(['file1.txt', 'file2.txt'])
      .mockResolvedValueOnce(['file2.txt', 'file3.txt']);

    const inputs: ActionInputs = {
      ...defaultInputs,
      files: ['*.txt', 'file*.txt'],
    };

    const results = await reviewFiles(inputs);

    expect(results.files).toHaveLength(3);
    expect(mockReviewFn).toHaveBeenCalledTimes(3);
  });

  it('should generate correct summary', async () => {
    vi.mocked(glob).mockResolvedValue(['test1.txt', 'test2.txt']);

    const results = await reviewFiles(defaultInputs);

    expect(results.summary).toMatch(/Reviewed 2 file\(s\)/);
    expect(results.summary).toMatch(/error\(s\)/);
    expect(results.summary).toMatch(/warning\(s\)/);
  });

  it('should detect errors correctly', async () => {
    vi.mocked(glob).mockResolvedValue(['test.txt']);

    const results = await reviewFiles(defaultInputs);

    expect(results.hasErrors).toBe(true);
  });

  it('should detect warnings correctly', async () => {
    vi.mocked(glob).mockResolvedValue(['test.txt']);

    const results = await reviewFiles(defaultInputs);

    expect(results.hasWarnings).toBe(true);
  });

  it('should handle files with no issues', async () => {
    vi.mocked(glob).mockResolvedValue(['clean.txt']);
    mockReviewFn.mockResolvedValue({
      source: 'clean.txt',
      issues: [],
      summary: 'No issues found',
      reviewedAt: new Date(),
    });

    const results = await reviewFiles(defaultInputs);

    expect(results.hasErrors).toBe(false);
    expect(results.hasWarnings).toBe(false);
  });
});
