import * as core from '@actions/core';
import type { ReviewResults } from './reviewer';

export function setOutputs(results: ReviewResults): void {
  core.setOutput('results', JSON.stringify(results));
  core.setOutput('summary', results.summary);
  core.setOutput('has-errors', results.hasErrors.toString());
  core.setOutput('has-warnings', results.hasWarnings.toString());

  core.summary.addHeading('Content Review Results');
  core.summary.addRaw(results.summary);
  void core.summary.write();
}
