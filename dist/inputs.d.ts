export type Provider = 'openai' | 'anthropic' | 'google';
export type Language = 'ja' | 'en';
export type Severity = 'error' | 'warning' | 'suggestion';
export type ActionInputs = Readonly<{
    files: string[];
    apiKey?: string;
    provider?: Provider;
    model?: string;
    language?: Language;
    config?: string;
    severity: Severity;
    factCheck?: boolean;
    factCheckInstruction?: string;
    failOnError: boolean;
    commentPr: boolean;
}>;
export declare function getInputs(): ActionInputs;
