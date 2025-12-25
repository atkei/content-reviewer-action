import type { ReviewResults } from './reviewer';
export declare function getPrChangedFiles(): Promise<string[]>;
export declare function createReviewComment(results: ReviewResults): Promise<void>;
