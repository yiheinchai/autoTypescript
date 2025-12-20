import * as vscode from "vscode";
import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { TypeCacheManager } from "./typeCacheManager";
import { inferTypeForParam, FunctionTypeData } from "./typeInference";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyNode = any;

/**
 * Inferred type info for nested property access
 */
interface PropertyTypeInfo {
  rootParam: string;
  propertyPath: string[];
  funcName: string | null;
}

/**
 * Provides hover information for inferred types
 * Supports both JavaScript/TypeScript and Python
 */
export class TypeHoverProvider implements vscode.HoverProvider {
  private cacheManager: TypeCacheManager;

  constructor(cacheManager: TypeCacheManager) {
    this.cacheManager = cacheManager;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
  ): vscode.ProviderResult<vscode.Hover> {
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const languageId = document.languageId;

    // For Python files, use simple function name matching
    if (languageId === 'python') {
      return this.providePythonHover(word, wordRange);
    }

    // For JavaScript/TypeScript files, use AST-based hover
    const code = document.getText();
    const line = position.line + 1; // AST uses 1-based lines
    const column = position.character;

    try {
      const ast = acorn.parse(code, {
        ecmaVersion: "latest",
        locations: true,
        allowReturnOutsideFunction: true,
      });

      const hoverInfo = this.findHoverInfo(ast, word, line, column);

      if (hoverInfo) {
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(hoverInfo.signature, "typescript");
        if (hoverInfo.description) {
          markdown.appendText("\n" + hoverInfo.description);
        }
        return new vscode.Hover(markdown, wordRange);
      }
    } catch {
      // Parsing errors - silently ignore
    }

    return null;
  }

  /**
   * Provide hover information for Python code
   */
  private providePythonHover(word: string, wordRange: vscode.Range): vscode.Hover | null {
    const cache = this.cacheManager.getCache();

    // Check if the word matches any function in the cache
    // Support both simple names and module.function names
    let funcData: FunctionTypeData | null = null;
    let matchedName = '';

    // Try exact match first
    if (cache[word]) {
      funcData = cache[word];
      matchedName = word;
    } else {
      // Try to find a match where the function name ends with this word
      for (const funcName in cache) {
        if (funcName.endsWith('.' + word) || funcName === word) {
          funcData = cache[funcName];
          matchedName = funcName;
          break;
        }
      }
    }

    if (funcData) {
      const paramStrings = this.buildPythonParamStrings(funcData);
      const signature = `def ${word}(${paramStrings.join(", ")}) -> Any`;
      const description = `${funcData.callCount} calls observed`;

      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(signature, "python");
      markdown.appendText("\n" + description);
      return new vscode.Hover(markdown, wordRange);
    }

    return null;
  }

  /**
   * Build parameter strings for Python function signature
   */
  private buildPythonParamStrings(funcData: FunctionTypeData): string[] {
    const paramNames = funcData.paramNames || [];
    const paramStrings: string[] = [];

    let maxParams = paramNames.length;
    if (funcData.paramData) {
      const indices = Object.keys(funcData.paramData).map(Number);
      if (indices.length > 0) {
        maxParams = Math.max(maxParams, Math.max(...indices) + 1);
      }
    }

    for (let i = 0; i < maxParams; i++) {
      const paramName = paramNames[i] || `arg${i}`;
      const observedValues = funcData.paramData?.[i] || [];
      const inferredType = this.inferPythonType(observedValues);
      paramStrings.push(`${paramName}: ${inferredType}`);
    }

    return paramStrings;
  }

  /**
   * Infer Python type from observed values
   */
  private inferPythonType(values: unknown[]): string {
    if (!values || values.length === 0) {
      return "Any";
    }

    const types = new Set<string>();

    for (const value of values) {
      if (value === null) {
        types.add("None");
      } else if (typeof value === 'boolean') {
        types.add("bool");
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          types.add("int");
        } else {
          types.add("float");
        }
      } else if (typeof value === 'string') {
        types.add("str");
      } else if (Array.isArray(value)) {
        types.add("List[Any]");
      } else if (typeof value === 'object') {
        types.add("Dict[str, Any]");
      } else {
        types.add("Any");
      }
    }

    const typeList = Array.from(types);
    if (typeList.length === 0) {
      return "Any";
    } else if (typeList.length === 1) {
      return typeList[0];
    } else {
      return typeList.join(" | ");
    }
  }

  private findHoverInfo(
    ast: AnyNode,
    word: string,
    line: number,
    column: number
  ): { signature: string; description?: string } | null {
    let result: { signature: string; description?: string } | null = null;

    try {
      walk.ancestor(ast, {
        FunctionDeclaration: (node: AnyNode, _ancestors: AnyNode[]) => {
          // eslint-disable-line @typescript-eslint/no-unused-vars
          if (result) {
            return;
          }

          // Check function name
          if (
            node.id &&
            node.id.name === word &&
            this.isPositionInNode(node.id, line, column)
          ) {
            result = this.getFunctionSignature(node.id.name);
            return;
          }

          // Check parameters
          const paramResult = this.checkParameters(
            node,
            word,
            line,
            column,
            node.id?.name
          );
          if (paramResult) {
            result = paramResult;
          }
        },

        VariableDeclarator: (node: AnyNode, _ancestors: AnyNode[]) => {
          // eslint-disable-line @typescript-eslint/no-unused-vars
          if (result) {
            return;
          }

          // Check variable name that might be a function
          if (
            node.id &&
            node.id.name === word &&
            this.isPositionInNode(node.id, line, column)
          ) {
            if (
              node.init &&
              (node.init.type === "FunctionExpression" ||
                node.init.type === "ArrowFunctionExpression")
            ) {
              result = this.getFunctionSignature(node.id.name);
            } else {
              const funcData = this.cacheManager.getFunctionData(node.id.name);
              if (funcData) {
                result = this.getFunctionSignature(node.id.name);
              } else {
                result = { signature: `(variable) ${node.id.name}: unknown` };
              }
            }
            return;
          }

          // Check function expression/arrow function parameters
          if (
            node.init &&
            (node.init.type === "FunctionExpression" ||
              node.init.type === "ArrowFunctionExpression")
          ) {
            const funcName = node.id?.name;
            const paramResult = this.checkParameters(
              node.init,
              word,
              line,
              column,
              funcName
            );
            if (paramResult) {
              result = paramResult;
            }
          }
        },

        ArrowFunctionExpression: (node: AnyNode, ancestors: AnyNode[]) => {
          if (result) {
            return;
          }

          // Find the function name from parent
          const parent = ancestors[ancestors.length - 2];
          let funcName: string | null = null;

          if (
            parent?.type === "VariableDeclarator" &&
            parent.id?.type === "Identifier"
          ) {
            funcName = parent.id.name;
          } else if (
            parent?.type === "Property" &&
            parent.key?.type === "Identifier"
          ) {
            funcName = parent.key.name;
          }

          const paramResult = this.checkParameters(
            node,
            word,
            line,
            column,
            funcName
          );
          if (paramResult) {
            result = paramResult;
          }
        },

        CallExpression: (node: AnyNode, _ancestors: AnyNode[]) => {
          // eslint-disable-line @typescript-eslint/no-unused-vars
          if (result) {
            return;
          }

          // Check if hovering over a function call
          if (node.callee?.type === "Identifier" && node.callee.name === word) {
            if (this.isPositionInNode(node.callee, line, column)) {
              result = this.getFunctionSignature(node.callee.name);
            }
          }
        },

        MemberExpression: (node: AnyNode, ancestors: AnyNode[]) => {
          if (result) {
            return;
          }

          // Check if hovering over a property in a member expression (e.g., schema.fields)
          if (
            node.property?.type === "Identifier" &&
            node.property.name === word
          ) {
            if (this.isPositionInNode(node.property, line, column)) {
              // Build the property access chain
              const propertyInfo = this.resolvePropertyChain(node, ancestors);
              if (propertyInfo) {
                result = this.getPropertySignature(propertyInfo);
              }
            }
          }
        },

        Identifier: (node: AnyNode, ancestors: AnyNode[]) => {
          if (result) {
            return;
          }
          if (node.name !== word) {
            return;
          }
          if (!this.isPositionInNode(node, line, column)) {
            return;
          }

          const parent = ancestors[ancestors.length - 2];

          // Skip if already handled by specific visitors
          if (parent?.type === "FunctionDeclaration" && parent.id === node) {
            return;
          }
          if (parent?.type === "VariableDeclarator" && parent.id === node) {
            return;
          }
          if (parent?.type === "Property" && parent.key === node) {
            return;
          }

          // Check if it's a parameter usage inside a function
          for (let i = ancestors.length - 2; i >= 0; i--) {
            const ancestor = ancestors[i];
            if (
              [
                "FunctionDeclaration",
                "FunctionExpression",
                "ArrowFunctionExpression",
              ].includes(ancestor.type)
            ) {
              const funcNode = ancestor;
              const paramMatch = funcNode.params?.find((p: AnyNode) => {
                let pName: string | null = null;
                if (p.type === "Identifier") {
                  pName = p.name;
                } else if (p.type === "AssignmentPattern" && p.left) {
                  pName = p.left.name;
                } else if (p.type === "RestElement" && p.argument) {
                  pName = p.argument.name;
                }
                return pName === word;
              });

              if (paramMatch) {
                let funcName: string | null = null;
                if (funcNode.id) {
                  funcName = funcNode.id.name;
                } else if (i > 0) {
                  const funcParent = ancestors[i - 1];
                  if (
                    funcParent?.type === "VariableDeclarator" &&
                    funcParent.id?.type === "Identifier"
                  ) {
                    funcName = funcParent.id.name;
                  }
                }

                result = this.getParameterSignature(word, funcName);
                return;
              }
            }
          }

          // Check if it's a known function being used
          const funcData = this.cacheManager.getFunctionData(word);
          if (funcData) {
            result = this.getFunctionSignature(word);
            return;
          }

          // Generic variable
          result = { signature: `(variable) ${word}: unknown` };
        },
      });
    } catch {
      // Walk errors - silently ignore
    }

    return result;
  }

  private isPositionInNode(
    node: AnyNode,
    line: number,
    column: number
  ): boolean {
    if (!node.loc) {
      return false;
    }

    const startLine = node.loc.start.line;
    const endLine = node.loc.end.line;
    const startCol = node.loc.start.column;
    const endCol = node.loc.end.column;

    if (line < startLine || line > endLine) {
      return false;
    }
    if (line === startLine && column < startCol) {
      return false;
    }
    if (line === endLine && column >= endCol) {
      return false;
    }

    return true;
  }

  private checkParameters(
    node: AnyNode,
    word: string,
    line: number,
    column: number,
    funcName: string | null | undefined
  ): { signature: string; description?: string } | null {
    if (!node.params) {
      return null;
    }

    for (const param of node.params) {
      let paramNode = param;
      if (param.type === "AssignmentPattern" && param.left) {
        paramNode = param.left;
      }
      if (param.type === "RestElement" && param.argument) {
        paramNode = param.argument;
      }

      if (paramNode.type === "Identifier" && paramNode.name === word) {
        if (this.isPositionInNode(paramNode, line, column)) {
          return this.getParameterSignature(word, funcName ?? null);
        }
      }
    }

    return null;
  }

  private getFunctionSignature(funcName: string): {
    signature: string;
    description?: string;
  } {
    const funcData = this.cacheManager.getFunctionData(funcName);

    if (!funcData) {
      return {
        signature: `(function) ${funcName}(...args: unknown[]): unknown`,
        description:
          "No type data captured yet. Run tests with type capture to infer types.",
      };
    }

    const paramStrings = this.buildParamStrings(funcData);
    const signature = `(function) ${funcName}(${paramStrings.join(
      ", "
    )}): unknown`;
    const description = `${funcData.callCount} calls observed`;

    return { signature, description };
  }

  private getParameterSignature(
    paramName: string,
    funcName: string | null
  ): { signature: string; description?: string } {
    if (!funcName) {
      return { signature: `(parameter) ${paramName}: unknown` };
    }

    const funcData = this.cacheManager.getFunctionData(funcName);

    if (!funcData) {
      return {
        signature: `(parameter) ${paramName}: unknown`,
        description: `No type data for function "${funcName}"`,
      };
    }

    const cleanParamName = paramName.startsWith("...")
      ? paramName.substring(3)
      : paramName;
    const paramIndex = (funcData.paramNames || []).findIndex((p) => {
      const cleanP = p.startsWith("...") ? p.substring(3) : p;
      return cleanP === cleanParamName;
    });

    let inferredType = "unknown";
    if (paramIndex !== -1 && funcData.paramData?.[paramIndex]) {
      // Use pretty formatting for hover display
      inferredType = inferTypeForParam(funcData.paramData[paramIndex], true, 0);
    }

    return {
      signature: `(parameter) ${paramName}: ${inferredType}`,
      description: `From function "${funcName}"`,
    };
  }

  private buildParamStrings(funcData: FunctionTypeData): string[] {
    const paramNames = funcData.paramNames || [];
    const paramStrings: string[] = [];

    let maxParams = paramNames.length;
    if (funcData.paramData) {
      const indices = Object.keys(funcData.paramData).map(Number);
      if (indices.length > 0) {
        maxParams = Math.max(maxParams, Math.max(...indices) + 1);
      }
    }

    for (let i = 0; i < maxParams; i++) {
      const paramName = paramNames[i] || `arg${i}`;
      const observedValues = funcData.paramData?.[i] || [];
      // Use compact format for function signature line, but prettier types
      const inferredType = inferTypeForParam(observedValues, false, 0);
      paramStrings.push(`${paramName}: ${inferredType}`);
    }

    return paramStrings;
  }

  /**
   * Resolve a member expression chain to find the root parameter and property path
   * e.g., schema.fields.age -> { rootParam: 'schema', propertyPath: ['fields', 'age'], funcName: 'validateBody' }
   */
  private resolvePropertyChain(
    memberExpr: AnyNode,
    ancestors: AnyNode[]
  ): PropertyTypeInfo | null {
    // Build the property path by walking up the member expression chain
    const propertyPath: string[] = [];
    let current = memberExpr;

    // Traverse up through nested MemberExpressions
    while (current.type === "MemberExpression") {
      if (current.property?.type === "Identifier") {
        propertyPath.unshift(current.property.name);
      } else if (current.property?.type === "Literal") {
        propertyPath.unshift(String(current.property.value));
      } else {
        // Can't resolve computed properties with non-literal values
        return null;
      }
      current = current.object;
    }

    // The root should be an Identifier (the parameter name)
    if (current.type !== "Identifier") {
      return null;
    }

    const rootParam = current.name;

    // Find the containing function to get the function name
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = ancestors[i];
      if (
        [
          "FunctionDeclaration",
          "FunctionExpression",
          "ArrowFunctionExpression",
        ].includes(ancestor.type)
      ) {
        const funcNode = ancestor;

        // Check if rootParam is actually a parameter of this function
        const isParam = funcNode.params?.some((p: AnyNode) => {
          let pName: string | null = null;
          if (p.type === "Identifier") {
            pName = p.name;
          } else if (p.type === "AssignmentPattern" && p.left) {
            pName = p.left.name;
          } else if (p.type === "RestElement" && p.argument) {
            pName = p.argument.name;
          }
          return pName === rootParam;
        });

        if (isParam) {
          let funcName: string | null = null;
          if (funcNode.id) {
            funcName = funcNode.id.name;
          } else if (i > 0) {
            const funcParent = ancestors[i - 1];
            if (
              funcParent?.type === "VariableDeclarator" &&
              funcParent.id?.type === "Identifier"
            ) {
              funcName = funcParent.id.name;
            } else if (
              funcParent?.type === "Property" &&
              funcParent.key?.type === "Identifier"
            ) {
              funcName = funcParent.key.name;
            }
          }

          return { rootParam, propertyPath, funcName };
        }
      }
    }

    return null;
  }

  /**
   * Get the type signature for a property access on a parameter
   */
  private getPropertySignature(
    info: PropertyTypeInfo
  ): { signature: string; description?: string } | null {
    if (!info.funcName) {
      return null;
    }

    const funcData = this.cacheManager.getFunctionData(info.funcName);
    if (!funcData) {
      return null;
    }

    // Find the parameter index
    const paramIndex = (funcData.paramNames || []).findIndex((p) => {
      const cleanP = p.startsWith("...") ? p.substring(3) : p;
      return cleanP === info.rootParam;
    });

    if (paramIndex === -1 || !funcData.paramData?.[paramIndex]) {
      return null;
    }

    // Get all observed values for this parameter
    const observedValues = funcData.paramData[paramIndex];

    // Extract the nested property values from all observations
    const nestedValues: unknown[] = [];
    for (const value of observedValues) {
      const nestedValue = this.getNestedValue(value, info.propertyPath);
      if (nestedValue !== undefined) {
        nestedValues.push(nestedValue);
      }
    }

    if (nestedValues.length === 0) {
      return {
        signature: `(property) ${
          info.propertyPath[info.propertyPath.length - 1]
        }: unknown`,
        description: `Property not found in observed values`,
      };
    }

    const inferredType = inferTypeForParam(nestedValues, true, 0);
    const propertyName = info.propertyPath[info.propertyPath.length - 1];
    const fullPath = `${info.rootParam}.${info.propertyPath.join(".")}`;

    return {
      signature: `(property) ${propertyName}: ${inferredType}`,
      description: `From ${fullPath} in function "${info.funcName}"`,
    };
  }

  /**
   * Get a nested value from an object using a property path
   */
  private getNestedValue(obj: unknown, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }
}
