# Sample TypeScript Project

This is a sample TypeScript project used to test the AutoTypeScript VS Code extension.

## Purpose

This project demonstrates how AutoTypeScript can:
1. Instrument TypeScript files during test execution
2. Capture runtime type information from function calls
3. Allow users to add type annotations via the hover popup

## Project Structure

```
sample-project-ts/
├── src/
│   ├── index.ts      # Main entry point
│   ├── utils.ts      # Utility functions (untyped)
│   └── api.ts        # API functions (untyped)
├── test/
│   ├── setup.ts      # Test setup
│   ├── utils.test.ts # Utility function tests
│   └── api.test.ts   # API function tests
├── package.json
├── tsconfig.json
└── README.md
```

## Functions Without Type Annotations

The source files in this project intentionally lack type annotations to demonstrate AutoTypeScript's ability to:
1. Infer types from runtime data captured during tests
2. Provide type information in hover popups
3. Allow users to add type annotations with a single click

### Example Functions

- `greet(name, age, options)` - Greeting function with optional formatting
- `calculateTotal(items, discount)` - Price calculation with optional discount
- `formatUser(user)` - User data formatting
- `processNumbers(numbers, operation)` - Number array processing
- `handleRequest(method, path, body, headers)` - API request handling
- `validateBody(body, schema)` - Request body validation

## Usage with AutoTypeScript

1. Open this project in VS Code with the AutoTypeScript extension installed
2. Run "AutoTypeScript: Run Tests with Type Capture" command
3. Hover over function parameters to see inferred types
4. Click "Add Type Annotation" to insert the type inline

## Running Tests

```bash
npm install
npm test
```

## Notes

- TypeScript is configured with `strict: false` to allow untyped parameters
- The `ts-node` package is used to run TypeScript files directly during testing
- Mocha with Chai is used for testing
