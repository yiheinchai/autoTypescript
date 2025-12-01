import * as vscode from 'vscode';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { TypeCacheManager } from './typeCacheManager';
import { inferTypeForParam, FunctionTypeData } from './typeInference';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyNode = any;

/**
 * Provides hover information for inferred types
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
        const code = document.getText();
        const wordRange = document.getWordRangeAtPosition(position);
        
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange);
        const line = position.line + 1; // AST uses 1-based lines
        const column = position.character;

        try {
            const ast = acorn.parse(code, {
                ecmaVersion: 'latest',
                locations: true,
                allowReturnOutsideFunction: true,
            });

            const hoverInfo = this.findHoverInfo(ast, word, line, column);
            
            if (hoverInfo) {
                const markdown = new vscode.MarkdownString();
                markdown.appendCodeblock(hoverInfo.signature, 'typescript');
                if (hoverInfo.description) {
                    markdown.appendText('\n' + hoverInfo.description);
                }
                return new vscode.Hover(markdown, wordRange);
            }
        } catch {
            // Parsing errors - silently ignore
        }

        return null;
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
                FunctionDeclaration: (node: AnyNode, _ancestors: AnyNode[]) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                    if (result) {
                        return;
                    }
                    
                    // Check function name
                    if (node.id && node.id.name === word && this.isPositionInNode(node.id, line, column)) {
                        result = this.getFunctionSignature(node.id.name);
                        return;
                    }

                    // Check parameters
                    const paramResult = this.checkParameters(node, word, line, column, node.id?.name);
                    if (paramResult) {
                        result = paramResult;
                    }
                },

                VariableDeclarator: (node: AnyNode, _ancestors: AnyNode[]) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                    if (result) {
                        return;
                    }

                    // Check variable name that might be a function
                    if (node.id && node.id.name === word && this.isPositionInNode(node.id, line, column)) {
                        if (node.init && (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression')) {
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
                    if (node.init && (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression')) {
                        const funcName = node.id?.name;
                        const paramResult = this.checkParameters(node.init, word, line, column, funcName);
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
                    
                    if (parent?.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
                        funcName = parent.id.name;
                    } else if (parent?.type === 'Property' && parent.key?.type === 'Identifier') {
                        funcName = parent.key.name;
                    }

                    const paramResult = this.checkParameters(node, word, line, column, funcName);
                    if (paramResult) {
                        result = paramResult;
                    }
                },

                CallExpression: (node: AnyNode, _ancestors: AnyNode[]) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                    if (result) {
                        return;
                    }

                    // Check if hovering over a function call
                    if (node.callee?.type === 'Identifier' && node.callee.name === word) {
                        if (this.isPositionInNode(node.callee, line, column)) {
                            result = this.getFunctionSignature(node.callee.name);
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
                    if (parent?.type === 'FunctionDeclaration' && parent.id === node) {
                        return;
                    }
                    if (parent?.type === 'VariableDeclarator' && parent.id === node) {
                        return;
                    }
                    if (parent?.type === 'Property' && parent.key === node) {
                        return;
                    }

                    // Check if it's a parameter usage inside a function
                    for (let i = ancestors.length - 2; i >= 0; i--) {
                        const ancestor = ancestors[i];
                        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(ancestor.type)) {
                            const funcNode = ancestor;
                            const paramMatch = funcNode.params?.find((p: AnyNode) => {
                                let pName: string | null = null;
                                if (p.type === 'Identifier') {
                                    pName = p.name;
                                } else if (p.type === 'AssignmentPattern' && p.left) {
                                    pName = p.left.name;
                                } else if (p.type === 'RestElement' && p.argument) {
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
                                    if (funcParent?.type === 'VariableDeclarator' && funcParent.id?.type === 'Identifier') {
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

    private isPositionInNode(node: AnyNode, line: number, column: number): boolean {
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
            if (param.type === 'AssignmentPattern' && param.left) {
                paramNode = param.left;
            }
            if (param.type === 'RestElement' && param.argument) {
                paramNode = param.argument;
            }

            if (paramNode.type === 'Identifier' && paramNode.name === word) {
                if (this.isPositionInNode(paramNode, line, column)) {
                    return this.getParameterSignature(word, funcName ?? null);
                }
            }
        }

        return null;
    }

    private getFunctionSignature(funcName: string): { signature: string; description?: string } {
        const funcData = this.cacheManager.getFunctionData(funcName);
        
        if (!funcData) {
            return {
                signature: `(function) ${funcName}(...args: unknown[]): unknown`,
                description: 'No type data captured yet. Run tests with type capture to infer types.',
            };
        }

        const paramStrings = this.buildParamStrings(funcData);
        const signature = `(function) ${funcName}(${paramStrings.join(', ')}): unknown`;
        const description = `${funcData.callCount} calls observed`;

        return { signature, description };
    }

    private getParameterSignature(paramName: string, funcName: string | null): { signature: string; description?: string } {
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

        const cleanParamName = paramName.startsWith('...') ? paramName.substring(3) : paramName;
        const paramIndex = (funcData.paramNames || []).findIndex(p => {
            const cleanP = p.startsWith('...') ? p.substring(3) : p;
            return cleanP === cleanParamName;
        });

        let inferredType = 'unknown';
        if (paramIndex !== -1 && funcData.paramData?.[paramIndex]) {
            inferredType = inferTypeForParam(funcData.paramData[paramIndex]);
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
            const inferredType = inferTypeForParam(observedValues);
            paramStrings.push(`${paramName}: ${inferredType}`);
        }

        return paramStrings;
    }
}
