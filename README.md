# Content Reviewer Action

[GitHub Action](https://github.com/features/actions) for [Content Reviewer](https://github.com/atkei/content-reviewer).

## Features

- LLM-powered content review
- Automatic PR review comments with inline feedback on specific lines
- Automatically reviews only changed files in Pull Requests
- Optional fact-checking via web search
- Multilingual support
- Structured output with severity levels (error, warning, suggestion)

## Usage

### Basic Usage

```yaml
name: Review Content

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Review Content
        uses: atkei/content-reviewer-action@v0.1.0
        with:
          files: 'docs/**/*.md'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Review results
        run: echo '${{ steps.cr.outputs.results }}' | jq .
```

### PR Review Comments

```yaml
name: Review Content

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Review Content
        uses: atkei/content-reviewer-action@v0.1.0
        with:
          files: 'docs/**/*.md'
          comment-pr: true
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Fact Check

```yaml
name: Review Content

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Review Content
        uses: atkei/content-reviewer-action@v0.1.0
        with:
          files: 'docs/**/*.md'
          fact-check: true
          fact-check-instruction: '.github/content-reviewer/fact-check.md'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Inputs

| Input                    | Description                                                               | Required | Default          |
| ------------------------ | ------------------------------------------------------------------------- | -------- | ---------------- |
| `files`                  | Files to review (space-separated, supports glob patterns)                 | Yes      | -                |
| `api-key`                | API key for LLM provider                                                  | No       | Uses env vars    |
| `provider`               | LLM provider (`openai`, `anthropic`, `google`)                            | No       | `openai`         |
| `model`                  | LLM model to use                                                          | No       | Provider default |
| `language`               | Review language (`en`, `ja`)                                              | No       | `en`             |
| `config`                 | Path to configuration file                                                | No       | -                |
| `severity`               | Minimum severity level to report (`error`, `warning`, `suggestion`)       | No       | `warning`        |
| `fact-check`             | Enable fact-checking via web search (`true`/`false`)                      | No       | `false`          |
| `fact-check-instruction` | Path to fact-check instruction file                                       | No       | -                |
| `fail-on-error`          | Fail the action if errors are found                                       | No       | `false`          |
| `comment-pr`             | Post review results as PR review comments (requires `pull_request` event) | No       | `false`          |

## Outputs

| Output         | Description                                  |
| -------------- | -------------------------------------------- |
| `results`      | Review results in JSON format                |
| `summary`      | Review summary text                          |
| `has-errors`   | Whether errors were found (`true`/`false`)   |
| `has-warnings` | Whether warnings were found (`true`/`false`) |

## Environment Variables

API keys can be provided via environment variables:

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Google AI API key
- `GITHUB_TOKEN` - Required for PR comments

## Supported Providers

| Provider    | Default Model      |
| ----------- | ------------------ |
| `openai`    | `gpt-4.1-mini`     |
| `anthropic` | `claude-haiku-4-5` |
| `google`    | `gemini-2.5-flash` |

## Configuration File

The action can load a JSON configuration file compatible with `@content-reviewer/core`.
`instructionFile` and `factCheck.instructionFile` are resolved relative to the config file.

```json
{
  "language": "ja",
  "llm": {
    "provider": "openai",
    "model": "gpt-4.1-mini"
  },
  "instructionFile": "review.md",
  "factCheck": {
    "enabled": true,
    "instructionFile": "fact-check.md"
  }
}
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
