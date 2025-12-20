# Sample Python Project for AutoTypeScript

This is a sample Python project to demonstrate AutoTypeScript's Python type inference capabilities.

## Structure

- `src/utils.py` - Sample utility functions
- `tests/test_utils.py` - Test cases for the utilities

## Running Tests

### Using pytest (recommended)

```bash
pytest tests/
```

### Using Python directly

```bash
python tests/test_utils.py
```

## Using with AutoTypeScript

1. Open this folder in VS Code
2. Run Command: "AutoTypeScript: Run Tests with Type Capture"
3. The extension will automatically detect this is a Python project
4. After tests complete, run "AutoTypeScript: Generate Type Definitions"
5. Generated `.pyi` stub files will appear in `generated-types/`

## Expected Type Inference

The extension should infer types like:

```python
def greet(name: str, age: int, options: Dict[str, Any] | None) -> Any: ...
def calculate_total(items: List[Dict[str, Any]], discount: float | None) -> Any: ...
def format_user(user: Dict[str, Any]) -> Any: ...
```
