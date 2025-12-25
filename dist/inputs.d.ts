export type Provider = 'openai' | 'anthropic' | 'google';
export type Language = 'ja' | 'en';
export type ActionInputs = Readonly<{
    files: string[];
    apiKey?: string;
    provider?: Provider;
    model?: string;
    language?: Language;
    config?: string;
    failOnError: boolean;
    commentPr: boolean;
}>;
export declare function getInputs(): ActionInputs;
