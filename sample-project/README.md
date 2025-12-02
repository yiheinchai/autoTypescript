# Sample Project for AutoTypeScript

This is a sample JavaScript project to test the AutoTypeScript VS Code extension.

## Structure

```
sample-project/
├── src/
│   ├── index.js     # Main entry point
│   ├── utils.js     # Utility functions
│   └── api.js       # API-related functions
├── test/
│   ├── setup.js     # Test setup file
│   ├── utils.test.js
│   └── api.test.js
└── package.json
```

## Available Functions

### Utils (`src/utils.js`)

- `greet(name, age, options)` - Greets a user with optional formal style
- `calculateTotal(items, discount)` - Calculates total price
- `formatUser(user)` - Formats user data for display
- `processNumbers(numbers, operation)` - Processes an array of numbers
- `createTask(title, priority, assignee)` - Creates a task object
- `filterItems(items, criteria)` - Filters items based on criteria
- `mergeConfig(defaults, overrides)` - Merges configuration objects

### API (`src/api.js`)

- `handleRequest(method, path, body, headers)` - Simulates API request handling
- `validateBody(body, schema)` - Validates request body
- `transformResponse(data, format)` - Transforms API response
- `paginate(items, page, pageSize)` - Paginates results

## Testing the Extension

1. Open VS Code at the parent `autoTypescript` folder
2. Press F5 to launch the Extension Development Host
3. In the new VS Code window, open this `sample-project` folder
4. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
5. Run "AutoTypeScript: Run Tests with Type Capture"
6. After tests complete, hover over function names in `src/utils.js` or `src/api.js` to see inferred types
7. Run "AutoTypeScript: Generate Type Definitions" to create `.d.ts` files

## Running Tests

```bash
npm test
```
