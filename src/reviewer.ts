import * as fs from 'fs/promises';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { glob } from 'glob';
import { ContentReviewer, type Document, type ReviewResult } from '@content-reviewer/core';
import type { ActionInputs } from './inputs';
import { buildReviewConfig } from './config';
import { getPrChangedFiles } from './github';

export type FileReviewResult = Readonly<{
  path: string;
  result: ReviewResult;
}>;

export type ReviewResults = Readonly<{
  files: FileReviewResult[];
  summary: string;
  hasErrors: boolean;
  hasWarnings: boolean;
}>;

async function parseDocument(filePath: string): Promise<Document> {
  const content = await fs.readFile(filePath, 'utf-8');
  return {
    rawContent: content,
    source: filePath,
  };
}

export async function reviewFiles(inputs: ActionInputs): Promise<ReviewResults> {
  const filePaths: string[] = [];
  for (const pattern of inputs.files) {
    const matches = await glob(pattern, { nodir: true });
    filePaths.push(...matches);
  }

  let uniqueFiles = [...new Set(filePaths)];

  // Automatically filter by changed files if running in a Pull Request
  if (github.context.eventName === 'pull_request') {
    core.info('Pull Request detected: Filtering for changed files...');
    const changedFiles = await getPrChangedFiles();

    if (changedFiles.length > 0) {
      const changedSet = new Set(changedFiles);
      const originalCount = uniqueFiles.length;
      uniqueFiles = uniqueFiles.filter((file) => changedSet.has(file));
      core.info(
        `Filtered files by PR changes: ${originalCount} -> ${uniqueFiles.length} file(s) matched.`
      );
    } else {
      core.warning('No changed files detected in this PR. Proceeding with 0 files.');
      uniqueFiles = [];
    }
  } else {
    core.info(
      `Event "${github.context.eventName}" detected: Reviewing all ${uniqueFiles.length} matched file(s).`
    );
  }

  if (uniqueFiles.length === 0) {
    return {
      files: [],
      summary: 'No files matched the specified patterns',
      hasErrors: false,
      hasWarnings: false,
    };
  }

  const config = await buildReviewConfig(inputs);

  const reviewer = new ContentReviewer(config);

  const results: FileReviewResult[] = [];
  let hasErrors = false;
  let hasWarnings = false;

  for (const filePath of uniqueFiles) {
    try {
      const document = await parseDocument(filePath);
      const result = await reviewer.review(document);

      results.push({ path: filePath, result });

      if (result.issues.some((i) => i.severity === 'error')) {
        hasErrors = true;
      }
      if (result.issues.some((i) => i.severity === 'warning')) {
        hasWarnings = true;
      }
    } catch (error) {
      core.error(
        `Failed to review file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const summary = generateSummary(results);

  return {
    files: results,
    summary,
    hasErrors,
    hasWarnings,
  };
}

function generateSummary(results: FileReviewResult[]): string {
  const totalFiles = results.length;
  const totalIssues = results.reduce((sum, r) => sum + r.result.issues.length, 0);
  const errors = results.reduce(
    (sum, r) => sum + r.result.issues.filter((i) => i.severity === 'error').length,
    0
  );
  const warnings = results.reduce(
    (sum, r) => sum + r.result.issues.filter((i) => i.severity === 'warning').length,
    0
  );

  return `Reviewed ${totalFiles} file(s): ${errors} error(s), ${warnings} warning(s), ${totalIssues} total issue(s)`;
}
