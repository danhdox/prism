# Contributing to PRism

Thank you for your interest in contributing to PRism! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/prism.git
   cd prism
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the action:
   ```bash
   npm run build
   ```

5. Run tests:
   ```bash
   npm test
   ```

## Project Structure

```
prism/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types/             # TypeScript type definitions
│   ├── services/          # Core services (LLM, GitHub, Storage, Triage)
│   └── utils/             # Utility functions
├── tests/                 # Test files
├── dist/                  # Compiled output (committed to repo)
├── action.yml             # GitHub Action metadata
└── package.json           # Dependencies and scripts
```

## Development Workflow

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in the `src/` directory

3. Add tests for your changes in the `tests/` directory

4. Run tests to ensure everything works:
   ```bash
   npm test
   ```

5. Build the action:
   ```bash
   npm run build
   ```

6. Commit your changes (including the built files in `dist/`):
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

### Code Style

- Use TypeScript for all new code
- Follow existing code style and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Testing

- Write unit tests for all new functionality
- Ensure all tests pass before submitting
- Aim for high test coverage
- Test both success and error cases

### Building

The `dist/` folder must be committed because GitHub Actions runs directly from the repository without a build step. Always run `npm run build` before committing.

## Submitting Changes

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request against the main repository

3. Describe your changes in the PR description:
   - What problem does this solve?
   - What changes were made?
   - Any breaking changes?
   - Screenshots (if applicable)

4. Wait for review and address any feedback

## Testing Your Action

To test your changes in a real repository:

1. Push your branch to your fork
2. Reference your fork in a workflow:
   ```yaml
   - uses: YOUR-USERNAME/prism@feature/your-feature-name
   ```

## Reporting Issues

When reporting issues, please include:

- Clear description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant logs or error messages
- Environment details (OS, Node version, etc.)

## Feature Requests

We welcome feature requests! Please:

- Check if the feature has already been requested
- Clearly describe the feature and its use case
- Explain why it would be valuable
- Consider contributing the feature yourself!

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help create a positive community

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion in GitHub Discussions
- Reach out to maintainers

Thank you for contributing to PRism! 🎉
