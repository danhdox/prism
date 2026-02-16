# PRism - AI Triage GitHub Action

AI-powered GitHub Action for smarter open-source triage. PRism detects duplicate issues and PRs, generates structured PR review summaries, applies intelligent labels, and optionally supports Postgres + pgvector for persistent similarity.

## Features

- 🔍 **Duplicate Detection**: AI-powered duplicate detection for issues and PRs
- 📝 **Structured PR Reviews**: Comprehensive code reviews with categorized findings
- 🏷️ **Smart Labeling**: Automatic label suggestions and application
- 💾 **Stateful/Stateless**: Run in-memory or with Postgres + pgvector
- ⚡ **Fast**: Posts comments within 60 seconds
- 🔒 **Safe**: Never auto-closes or auto-merges

## Quick Start

```yaml
name: AI Triage
on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: danhdox/prism@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          llm-api-key: ${{ secrets.OPENAI_API_KEY }}
```

## Documentation

- 📖 [Full Documentation](./USAGE.md)
- 🚀 [Examples](./.github/workflows/ai-triage-example.yml)

## Requirements

- GitHub Actions workflow
- OpenAI API key (required)
- PostgreSQL with pgvector (optional, for stateful mode)

## License

MIT - see [LICENSE](./LICENSE)
