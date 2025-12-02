# Changelog

All notable changes to the "AutoTypeScript" extension will be documented in this file.

## [1.0.0] - 2024-12-02

### Added
- **Automatic Type Capture**: Instruments your JavaScript/TypeScript code to capture argument types during test execution
- **Support for Multiple Test Frameworks**: Works with Jest, Mocha, and any Node.js test runner
- **Smart Type Inference**: Merges observed object shapes into concise types with optional properties (`?`)
- **Type Hover Information**: Displays inferred types when you hover over functions, parameters, and nested properties
- **Pretty Formatted Types**: Shows nicely indented type definitions for complex objects
- **Type Definition Generation**: Generates TypeScript `.d.ts` declaration files from captured data
- **Persistent Type Cache**: Accumulates type data across multiple test runs for better inference
- **Type Cache Explorer**: View captured type data in the sidebar

### Commands
- `AutoTypeScript: Run Tests with Type Capture` - Execute tests while capturing runtime type data
- `AutoTypeScript: Generate Type Definitions` - Generate `.d.ts` files from captured type data
- `AutoTypeScript: Clear Type Cache` - Reset all captured type information
- `AutoTypeScript: Show Type Cache` - Display the current type cache contents

### Configuration
- `autotypescript.testCommand` - Command to run your tests (default: `npm test`)
- `autotypescript.outputPath` - Output directory for generated type definitions (default: `./generated-types`)
- `autotypescript.maxSamplesPerParam` - Maximum samples to keep per parameter (default: `50`)
