# autoTypeScript: Data-Driven Types IDE (Proof of Concept)

## Vision

autoTypeScript is an experimental, in-browser JavaScript development environment that automatically derives type information from the *real data* your code processes at runtime. Instead of manual type declarations, it observes your code's behavior to infer types, aiming for a more natural and data-aware coding experience.

This project serves as a **Proof of Concept (PoC)** demonstrating the feasibility and potential benefits of data-driven type inference in a lightweight IDE.

## Live Demo / How to Use

1.  Save the entire [`autoTypeScript.html`](./autoTypeScript.html) (or whatever you name the final HTML file) to your local machine.
2.  Open the HTML file in a modern web browser (e.g., Chrome, Firefox, Edge).
3.  The IDE will load with example JavaScript code.
4.  **Write & Edit Code:** Modify the code in the editor panel on the left.
5.  **Run Code:** Click the "Run Code" button.
    *   Your code will be executed.
    *   Console output from your code will appear in the "Console Output" panel.
    *   The "Inferred Type Signatures" panel will display the types observed for your globally defined functions based on the arguments they received during execution. This happens on the *first run* thanks to AST-based instrumentation.
6.  **Hover for Types:**
    *   Hover your mouse over function names (in definitions or calls), parameter names (in definitions or usages), and variable names in the code editor.
    *   A tooltip should appear displaying the inferred type signature or type information for the hovered identifier.
7.  **Clear Cache:** Click "Clear Cache & Signatures" to reset all observed type information and start fresh.
8.  **Persistence:** Your code in the editor and the accumulated type cache are saved in your browser's `localStorage` and will be restored on subsequent visits.

## Aims & Features (PoC Scope)

*   **Automated Type Discovery via AST Instrumentation:**
    *   Parses JavaScript code into an Abstract Syntax Tree (AST) using `acorn`.
    *   Traverses the AST using `acorn-walk` to find function declarations and expressions.
    *   Transforms the AST by injecting instrumentation calls to a `recordArguments` function at the beginning of user-defined functions.
    *   Generates instrumented JavaScript code from the modified AST using `astring`.
    *   This allows type information to be captured from the very first execution of the code.
*   **Runtime Data Observation:**
    *   Captures actual data values passed as arguments to instrumented functions during execution.
*   **Data Aggregation & Caching:**
    *   Maintains a cache of observed argument values for each parameter of each relevant function.
    *   This cache accumulates data across multiple code execution runs.
*   **Type Inference from Data:**
    *   Analyzes cached argument values to infer representative data types (e.g., "number", "string", "object { shape }", "Array<type>", "function").
    *   Supports inference of union types (e.g., `number | string`) if a parameter receives multiple distinct types.
*   **Dynamic Type Signature Display:**
    *   Presents inferred type signatures for user-defined global functions in a dedicated panel.
    *   This display dynamically updates based on newly observed data.
*   **Interactive Hover Tooltips:**
    *   Parses the original code into an `analysisAST` for mapping editor positions.
    *   On mouse hover in the CodeMirror editor, identifies the token and its corresponding AST node.
    *   Provides tooltips displaying inferred types for:
        *   Function calls.
        *   Function definitions (declarations, expressions, arrow functions).
        *   Parameter definitions (in function signatures).
        *   Parameter usages (inside function bodies).
        *   Variable declarations initialized with literals.
*   **Reduced Boilerplate:** Aims to reduce the need for manual type annotations in many common scenarios by deriving types from data.
*   **Improved Code Comprehension:** Provides immediate insights into expected and actual data shapes used by functions.
*   **In-Browser Console:** Captures and displays standard `console.log/warn/error/info` output.
*   **Session Persistence:** User code and the accumulated type cache are saved via `localStorage`.
*   **Single-File Deliverable:** The entire PoC is contained within a single HTML file.

## Core Technologies Used

*   **HTML, CSS, JavaScript (ES6+)**
*   **CodeMirror:** For the in-browser code editor.
*   **Acorn:** A tiny, fast JavaScript parser.
*   **Acorn-Walk:** An AST traversal utility for Acorn.
*   **Astring:** A tiny, fast JavaScript code generator from an ESTree-compliant AST.

## Limitations & Future Considerations (Beyond PoC)

This PoC has several limitations inherent to its scope and the complexity of full static analysis:

*   **Return Type Inference:** Currently, only parameter types are inferred. Return types are not.
*   **Local Variable Type Inference:** Type inference for local variables within functions (beyond simple literal initializations for hover) is not implemented. Tracking type changes due to reassignments is a complex static analysis problem.
*   **Complex Scopes & Closures:** While basic parameter usage is handled, deeply nested closures or complex scope interactions might not have their types fully resolved for hovers.
*   **Object Property Types on Hover:** Hovering over a property access like `obj.propertyName` (when hovering `propertyName`) shows `(property) propertyName: type unknown`. Inferring and displaying the type of `propertyName` based on data observed for `obj` is a more advanced feature.
*   **`this` Keyword Type:** The type of `this` within functions is not inferred.
*   **Build Steps/Modules:** For a real-world application, a proper build system and module bundler would be used instead of CDNs for libraries.
*   **Advanced IDE Features:** No autocompletion based on inferred types, advanced refactoring, or sophisticated error checking beyond runtime errors.
*   **Performance:** AST parsing and walking on every run/hover is generally fast for small-to-medium code snippets but could be optimized for larger codebases (e.g., incremental parsing, debouncing analysis).
*   **Robustness of AST Name/Role Detection:** Identifying the "name" or "role" of function expressions or arrow functions assigned in various ways (e.g., immediately invoked, passed as high-order arguments without direct assignment) can be heuristically challenging without a full semantic graph.
*   **Type System Completeness:** The inferred types are representative of observed data, not a formally verified sound type system like TypeScript. It won't catch all potential type errors before runtime.

## Conclusion

autoTypeScript successfully demonstrates the core concept of deriving JavaScript type information directly from runtime data within a lightweight, browser-based IDE. The use of AST instrumentation allows for immediate type feedback, and the hover tooltips enhance code comprehension by providing contextual type insights. While it has limitations as a PoC, it highlights a promising direction for more data-aware and intuitive JavaScript development tooling.

## Development Notes

The project is contained in a single HTML file. Key JavaScript sections include:
*   Global state management (`typeCache`, `analysisAST`).
*   AST transformation (`transformCodeForInstrumentation`, `instrumentFunctionNode`).
*   Runtime data recording (`window.__DDT_IDE__.recordArguments`).
*   Type inference logic (`inferSingleValueType`, `inferTypeForParam`).
*   UI update functions (`updateTypeSignatureDisplay`, `updateConsoleDisplay`).
*   CodeMirror setup and hover tooltip logic (`setupEditorHoverTips`, `showTooltipAt`, etc.).

External libraries (`CodeMirror`, `Acorn`, `Acorn-Walk`, `Astring`) are loaded via CDN.
