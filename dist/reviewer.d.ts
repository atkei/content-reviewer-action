import { type ReviewResult } from '@content-reviewer/core';
import type { ActionInputs } from './inputs';
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
export declare function reviewFiles(inputs: ActionInputs): Promise<ReviewResults>;
