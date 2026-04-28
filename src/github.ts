import * as core from '@actions/core';
import * as github from '@actions/github';
import type { ReviewIssue } from '@content-reviewer/core';
import type { ReviewResults } from './reviewer';

const COMMENT_MARKER = '<!-- content-reviewer-action -->';

export async function getPrChangedFiles(): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not found, cannot fetch changed files');
    return [];
  }

  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    core.warning('Not a pull request event, cannot fetch changed files');
    return [];
  }

  const prNumber = context.payload.pull_request.number;
  const files: string[] = [];

  try {
    const iterator = octokit.paginate.iterator(octokit.rest.pulls.listFiles, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      per_page: 100,
    });

    for await (const response of iterator) {
      for (const file of response.data) {
        // Status can be: added, removed, modified, renamed, copied, changed, unchanged
        // We typically skip 'removed' files as they don't exist to be reviewed.
        if (file.status !== 'removed') {
          files.push(file.filename);
        }
      }
    }
  } catch (error) {
    core.warning(
      `Failed to fetch changed files: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return files;
}

async function getPrChangedLines(): Promise<Map<string, Set<number>>> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return new Map();
  }

  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    return new Map();
  }

  const prNumber = context.payload.pull_request.number;
  const changedLines = new Map<string, Set<number>>();

  try {
    const iterator = octokit.paginate.iterator(octokit.rest.pulls.listFiles, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      per_page: 100,
    });

    for await (const response of iterator) {
      for (const file of response.data) {
        if (file.status === 'removed') {
          continue;
        }

        const lines = new Set<number>();

        if (file.patch) {
          const patchLines = file.patch.split('\n');
          let currentLine = 0;

          for (const line of patchLines) {
            if (line.startsWith('@@')) {
              const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
              if (match && match[1]) {
                currentLine = parseInt(match[1], 10);
              }
            } else if (!line.startsWith('-')) {
              if (line.startsWith('+') || line.startsWith(' ')) {
                lines.add(currentLine);
                currentLine++;
              }
            }
          }
        }

        if (lines.size > 0) {
          changedLines.set(file.filename, lines);
        }
      }
    }
  } catch (error) {
    core.warning(
      `Failed to fetch PR diff: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return changedLines;
}

export async function createReviewComment(results: ReviewResults): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not found, skipping review comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    core.warning('Not a pull request event, skipping review comment');
    return;
  }

  const prNumber = context.payload.pull_request.number;
  const changedLines = await getPrChangedLines();

  const comments: Array<{
    path: string;
    line: number;
    side: 'RIGHT';
    body: string;
  }> = [];
  let skippedCount = 0;

  for (const { path, result } of results.files) {
    const validLines = changedLines.get(path);

    for (const issue of result.issues) {
      if (issue.lineNumber) {
        if (validLines && validLines.has(issue.lineNumber)) {
          comments.push({
            path,
            line: issue.lineNumber,
            side: 'RIGHT',
            body: formatReviewCommentBody(issue),
          });
        } else {
          skippedCount++;
          core.info(
            `Skipping review comment for ${path}:${issue.lineNumber} (line not in PR diff)`
          );
        }
      }
    }
  }

  if (skippedCount > 0) {
    core.info(`Skipped ${skippedCount} comment(s) not in PR diff`);
  }

  const body = formatReviewSummary(results);

  try {
    if (comments.length > 0) {
      await octokit.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
        event: 'COMMENT',
        body,
        comments,
      });
      core.info(`Created PR review with ${comments.length} comment(s)`);
    } else {
      await octokit.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
        event: 'COMMENT',
        body: `${body}\n\n> No line-specific issues found in PR diff.`,
      });
      core.info('Created PR review without line-specific comments');
    }
  } catch (error) {
    core.warning(
      `Failed to create review comment: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function formatReviewCommentBody(issue: ReviewIssue): string {
  let icon = '•';
  if (issue.severity === 'error') icon = '❌';
  if (issue.severity === 'warning') icon = '⚠️';
  if (issue.severity === 'suggestion') icon = '💡';

  let body = `${icon} **${issue.severity}**: ${issue.message}\n`;

  if (issue.suggestion) {
    body += `\n💡 **Suggestion**: ${issue.suggestion}\n`;
  }

  if (issue.source?.url) {
    body += `\n🔎 **Source**: ${formatSourceLink(issue.source)}\n`;
  }

  body += '\n---\n';
  body += '_Posted by [content-reviewer-action](https://github.com/atkei/content-reviewer-action)_';

  return body;
}

function formatSourceLink(source: NonNullable<ReviewIssue['source']>): string {
  if (!source.title) {
    return source.url;
  }

  const safeTitle = source.title.replace(/([\\[\]])/g, '\\$1');
  const safeUrl = `<${source.url.replace(/</g, '%3C').replace(/>/g, '%3E')}>`;
  return `[${safeTitle}](${safeUrl})`;
}

function formatReviewSummary(results: ReviewResults): string {
  let summary = `${COMMENT_MARKER}\n`;
  summary += '## 📝 Content Review Results\n\n';
  summary += `${results.summary}\n\n`;

  if (results.files.length === 0) {
    summary += '> No files matched the specified patterns.\n';
    return summary;
  }

  for (const { path, result } of results.files) {
    summary += `### 📄 \`${path}\`\n\n`;

    if (result.issues.length === 0) {
      summary += '✅ No issues found\n\n';
    } else {
      for (const issue of result.issues) {
        let icon = '•';
        if (issue.severity === 'error') icon = '❌';
        if (issue.severity === 'warning') icon = '⚠️';
        if (issue.severity === 'suggestion') icon = '💡';

        const lineInfo = issue.lineNumber ? ` (line ${issue.lineNumber})` : '';
        summary += `${icon} **${issue.severity}**${lineInfo}: ${issue.message}\n`;
        if (issue.suggestion) {
          summary += `   💡 Suggestion: ${issue.suggestion}\n`;
        }
        if (issue.source?.url) {
          summary += `   🔎 Source: ${formatSourceLink(issue.source)}\n`;
        }
        summary += '\n';
      }
    }
  }

  return summary;
}
