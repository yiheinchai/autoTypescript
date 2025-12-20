# AutoTypeScript: Dual Language Support Implementation

## Overview

This project now supports both **JavaScript/TypeScript** and **Python** codebases for automatic type inference from runtime test data.

## Architecture

### Core Components

1. **Language Detection (`extension.ts`)**
   - Auto-detects project type by scanning for language-specific files
   - Python: `setup.py`, `pyproject.toml`, `requirements.txt`, `.py` files
   - JavaScript: `package.json`, `.js`, `.ts` files

2. **JavaScript/TypeScript Pipeline**
   - **Instrumentation**: `instrumentation.ts`
     - Uses Acorn AST parser to inject type capture code
     - Wraps functions with `__AUTOTYPESCRIPT__.recordArguments()` calls
   - **Test Execution**: Node.js with `--require` flag
   - **Type Generation**: Creates `.d.ts` declaration files
   - **Hover Provider**: AST-based analysis for accurate positioning

3. **Python Pipeline**
   - **Instrumentation**: `python_instrumentation.py`
     - Uses Python's import hook system (`__import__` override)
     - Wraps functions with `FunctionWrapper` class
   - **Test Execution**: Pytest with `conftest.py` auto-loading
   - **Type Generation**: Creates `.pyi` stub files
   - **Hover Provider**: Simple function name matching

## File Structure

```
autoTypescript/
├── src/
│   ├── extension.ts              # Main extension, language detection
│   ├── testRunner.ts             # Dual-language test execution
│   ├── instrumentation.ts        # JavaScript AST instrumentation
│   ├── typeInference.ts          # TypeScript type generation
│   ├── hoverProvider.ts          # Dual-language hover support
│   └── typeCacheManager.ts       # Type cache storage
├── python_instrumentation.py     # Python import hooks
├── python_type_inference.py      # Python type generation (future)
├── sample-project/               # JavaScript sample
│   ├── src/
│   └── test/
└── sample-python-project/        # Python sample
    ├── src/
    └── tests/
```

## Usage

### For JavaScript Projects

1. Open a JavaScript/TypeScript project in VS Code
2. Run: "AutoTypeScript: Run Tests with Type Capture"
3. Extension detects JavaScript and uses `npm test` (or configured command)
4. Run: "AutoTypeScript: Generate Type Definitions"
5. View generated `.d.ts` files in `generated-types/`

### For Python Projects

1. Open a Python project in VS Code
2. Run: "AutoTypeScript: Run Tests with Type Capture"
3. Extension detects Python and uses `pytest` (or configured command)
4. A `conftest.py` is created temporarily in workspace root
5. Run: "AutoTypeScript: Generate Type Definitions"
6. View generated `.pyi` files in `generated-types/`

## Configuration

```json
{
  "autotypescript.testCommand": "",  // Auto-detect, or specify manually
  "autotypescript.outputPath": "./generated-types",
  "autotypescript.maxSamplesPerParam": 50
}
```

## Type Inference Examples

### JavaScript
```javascript
// Source
function greet(name, age, options) { ... }

// Generated .d.ts
declare function greet(
  name: string,
  age: number,
  options: { formal: boolean } | { formal: boolean; title: string }
): unknown;
```

### Python
```python
# Source
def greet(name, age, options=None): ...

# Generated .pyi
def greet(name: str, age: int, options: Dict[str, Any] | None) -> Any: ...
```

## Key Features Preserved

✅ Existing JavaScript/TypeScript functionality fully maintained
✅ All 44 existing tests pass
✅ Backward compatible - no breaking changes
✅ AST-based hover for JavaScript
✅ Type cache management
✅ Multi-framework support (Jest, Mocha for JS; pytest, unittest for Python)

## Key Features Added

✅ Python code instrumentation via import hooks
✅ Python type inference and .pyi generation
✅ Auto-detection of project language
✅ Dual-language hover provider
✅ Python sample project with tests
✅ Updated documentation

## Technical Decisions

1. **Import Hooks vs AST for Python**: Used import hooks because they're simpler and work reliably with pytest's conftest.py system.

2. **conftest.py**: Placed in workspace root for automatic pytest loading, avoiding complex command-line manipulation.

3. **Separate Type Generation**: Kept JavaScript and Python type generation separate for maintainability.

4. **Simplified Python Hover**: Used function name matching instead of AST parsing because Python AST requires different parsing approach.

## Future Enhancements

- [ ] More sophisticated Python type inference (use `python_type_inference.py`)
- [ ] Better handling of Python class methods
- [ ] Support for Python decorators
- [ ] Type hints for return values
- [ ] Integration with mypy for validation

## Testing

Run the samples to verify both languages work:

```bash
# JavaScript sample
cd sample-project
npm test

# Python sample
cd sample-python-project
python tests/test_utils.py
```
