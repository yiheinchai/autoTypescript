# AutoTypeScript: Data-Driven Types Extension for VS Code

## Overview

AutoTypeScript is a VS Code extension that automatically generates TypeScript type definitions by capturing runtime data from your tests (unit, integration, and e2e tests). Instead of manually writing type annotations, AutoTypeScript observes how your functions are actually called during test execution and infers types from real data.

## Features

- **Automatic Type Capture**: Instruments your code to capture argument types during test execution
- **Support for Multiple Test Frameworks**: Works with Jest, Mocha, and any Node.js test runner
- **Type Hover Information**: Displays inferred types when you hover over functions and parameters in the editor
- **Type Definition Generation**: Generates TypeScript `.d.ts` declaration files from captured data
- **Persistent Type Cache**: Accumulates type data across multiple test runs for better inference

## Installation

### From Source

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 in VS Code to launch the Extension Development Host

### Building VSIX Package

```bash
npm install
npm run compile
npx vsce package
```

Then install the generated `.vsix` file in VS Code.

## Usage

### 1. Configure Your Test Command

Open VS Code settings and configure `autotypescript.testCommand`:

```json
{
    "autotypescript.testCommand": "npm test"
}
```

### 2. Run Tests with Type Capture

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run "AutoTypeScript: Run Tests with Type Capture"
3. Your tests will execute, and AutoTypeScript will capture type information

### 3. Generate Type Definitions

1. Open the Command Palette
2. Run "AutoTypeScript: Generate Type Definitions"
3. TypeScript declaration files will be generated in the configured output directory

### 4. View Inferred Types

- Hover over function names, parameters, and variables to see their inferred types
- Run "AutoTypeScript: Show Type Cache" to see all captured type data

## Commands

| Command | Description |
|---------|-------------|
| `AutoTypeScript: Run Tests with Type Capture` | Execute tests while capturing runtime type data |
| `AutoTypeScript: Generate Type Definitions` | Generate `.d.ts` files from captured type data |
| `AutoTypeScript: Clear Type Cache` | Reset all captured type information |
| `AutoTypeScript: Show Type Cache` | Display the current type cache contents |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `autotypescript.testCommand` | `"npm test"` | Command to run your tests |
| `autotypescript.outputPath` | `"./generated-types"` | Output directory for generated type definitions |
| `autotypescript.maxSamplesPerParam` | `50` | Maximum samples to keep per parameter |

## How It Works

1. **AST Instrumentation**: When you run tests with type capture, AutoTypeScript parses your JavaScript/TypeScript code using Acorn and injects instrumentation calls at the beginning of each function.

2. **Runtime Data Collection**: During test execution, the instrumentation captures the actual values passed to each function parameter.

3. **Type Inference**: The captured data is analyzed to infer TypeScript types. For example:
   - If a parameter always receives numbers, it's typed as `number`
   - If it receives both numbers and strings, it's typed as `number | string`
   - Object shapes are inferred from their properties

4. **Type Definition Generation**: The inferred types are compiled into TypeScript declaration files.

## Example

Given this JavaScript function:

```javascript
function greet(name, age, options) {
    console.log(`Hello, ${name}! You are ${age}.`);
}
```

And these test calls:

```javascript
greet("Alice", 30, { formal: true });
greet("Bob", 25, { formal: false, title: "Mr." });
```

AutoTypeScript will generate:

```typescript
declare function greet(
    name: string,
    age: number,
    options: { formal: boolean } | { formal: boolean; title: string }
): unknown;
```

## Supported Syntax

- Function declarations
- Function expressions
- Arrow functions
- Object methods
- Default parameters
- Rest parameters

## Limitations

- Return types are not currently inferred (marked as `unknown`)
- Complex generic types are simplified
- Types are based only on observed data during test runs
- Deeply nested objects may be truncated

## Browser-Based PoC

The repository also includes `index.html`, an in-browser proof of concept demonstrating the core type inference functionality.

## Technologies

- **VS Code Extension API**: For IDE integration
- **Acorn**: JavaScript parser for AST manipulation
- **Acorn-Walk**: AST traversal
- **Astring**: Code generation from AST
