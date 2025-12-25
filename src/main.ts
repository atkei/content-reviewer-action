import * as core from '@actions/core';
import { getInputs } from './inputs';
import { setOutputs } from './outputs';
import { createReviewComment } from './github';
import { reviewFiles } from './reviewer';

async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    core.info(`Reviewing ${inputs.files.length} file pattern(s)...`);
    core.info(`Provider: ${inputs.provider ?? '(from config/default)'}`);
    core.info(`Language: ${inputs.language ?? '(from config/default)'}`);

    const results = await reviewFiles(inputs);

    core.info(`Review completed: ${results.summary}`);

    setOutputs(results);

    if (inputs.commentPr) {
      await createReviewComment(results);
    }

    if (inputs.failOnError && results.hasErrors) {
      core.setFailed('Review found errors');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Action failed: ${error.message}`);
    } else {
      core.setFailed('Action failed with an unknown error');
    }
  }
}

void run();
