import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { generate } from 'astring';

const INSTRUMENTATION_NAMESPACE = '__AUTOTYPESCRIPT__';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyNode = any;

/**
 * Transform JavaScript code to add instrumentation for type capture
 */
export function transformCodeForInstrumentation(code: string): string {
    try {
        const ast = acorn.parse(code, {
            ecmaVersion: 'latest',
            locations: true,
            allowReturnOutsideFunction: true,
        });

        walk.ancestor(ast, {
            FunctionDeclaration(node: AnyNode, ancestors: AnyNode[]) {
                if (node.id && node.id.name) {
                    instrumentFunctionNode(node, node.id.name, ancestors);
                }
            },
            FunctionExpression(node: AnyNode, ancestors: AnyNode[]) {
                let name = node.id ? node.id.name : null;
                if (!name) {
                    const parent = ancestors[ancestors.length - 2];
                    if (parent) {
                        if (parent.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
                            name = parent.id.name;
                        } else if (parent.type === 'AssignmentExpression' && parent.left?.type === 'Identifier') {
                            name = parent.left.name;
                        } else if (parent.type === 'Property' && parent.key?.type === 'Identifier') {
                            name = parent.key.name;
                        }
                    }
                }
                if (name) {
                    instrumentFunctionNode(node, name, ancestors);
                }
            },
            ArrowFunctionExpression(node: AnyNode, ancestors: AnyNode[]) {
                let name: string | null = null;
                const parent = ancestors[ancestors.length - 2];
                if (parent) {
                    if (parent.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
                        name = parent.id.name;
                    } else if (parent.type === 'AssignmentExpression' && parent.left?.type === 'Identifier') {
                        name = parent.left.name;
                    } else if (parent.type === 'Property' && parent.key?.type === 'Identifier' && parent.kind === 'init') {
                        name = parent.key.name;
                    }
                }
                if (name) {
                    instrumentFunctionNode(node, name, ancestors);
                }
            },
        });

        return generate(ast);
    } catch (e) {
        // If transformation fails, return original code
        console.error('[AutoTypeScript] AST transformation error:', e);
        return code;
    }
}

function instrumentFunctionNode(node: AnyNode, funcName: string, _ancestors: AnyNode[]): void { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (node._instrumentedDDT) {
        return;
    }

    const paramNames = (node.params || []).map((p: AnyNode) => {
        if (p.type === 'Identifier') {
            return p.name;
        }
        if (p.type === 'AssignmentPattern' && p.left?.type === 'Identifier') {
            return p.left.name;
        }
        if (p.type === 'RestElement' && p.argument?.type === 'Identifier') {
            return `...${p.argument.name}`;
        }
        return '_param_';
    });

    let argsToRecord: AnyNode;
    // Arrow functions do not have their own `arguments` object
    if (node.type === 'ArrowFunctionExpression') {
        const paramIdentifiers = (node.params || []).map((p: AnyNode) => {
            if (p.type === 'Identifier') {
                return { type: 'Identifier', name: p.name };
            }
            if (p.type === 'AssignmentPattern' && p.left) {
                return { type: 'Identifier', name: p.left.name };
            }
            if (p.type === 'RestElement' && p.argument) {
                return { type: 'SpreadElement', argument: { type: 'Identifier', name: p.argument.name } };
            }
            return { type: 'Identifier', name: '_unknown_' };
        });
        argsToRecord = { type: 'ArrayExpression', elements: paramIdentifiers };
    } else {
        argsToRecord = { type: 'Identifier', name: 'arguments' };
    }

    const recordCall = {
        type: 'ExpressionStatement',
        expression: {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: INSTRUMENTATION_NAMESPACE },
                property: { type: 'Identifier', name: 'recordArguments' },
                computed: false,
            },
            arguments: [
                { type: 'Literal', value: funcName },
                argsToRecord,
                { type: 'ThisExpression' },
                { type: 'ArrayExpression', elements: paramNames.map((name: string) => ({ type: 'Literal', value: name })) },
            ],
            optional: false,
        },
    };

    if (node.body && typeof node.body === 'object' && 'type' in node.body && node.body.type === 'BlockStatement') {
        node.body.body.unshift(recordCall);
    } else if (node.body) {
        // Arrow function with implicit return
        const originalBodyExpression = node.body;
        const returnStatement = { type: 'ReturnStatement', argument: originalBodyExpression };
        node.body = {
            type: 'BlockStatement',
            body: [recordCall, returnStatement],
        };
        if (node.type === 'ArrowFunctionExpression') {
            node.expression = false;
        }
    }
    node._instrumentedDDT = true;
}

/**
 * Generate the runtime code that needs to be injected into the test environment
 */
export function generateRuntimeInstrumentationCode(outputFile: string): string {
    return `
// AutoTypeScript Runtime Instrumentation
(function() {
    const fs = require('fs');
    const path = require('path');
    
    const UNDEFINED_MARKER = '[[UNDEFINED_MARKER_VALUE]]';
    const MAX_SAMPLES_PER_PARAM = 50;
    
    // Type cache stored in memory
    const typeCache = {};
    
    // Load existing cache if available
    try {
        const cacheFile = ${JSON.stringify(outputFile)};
        if (fs.existsSync(cacheFile)) {
            const existingCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            Object.assign(typeCache, existingCache);
        }
    } catch (e) {
        // Ignore cache load errors
    }
    
    function deepCloneSafe(value, depth = 0, maxDepth = 10) {
        if (depth > maxDepth) return "[Max Depth Exceeded]";
        if (value === undefined) return UNDEFINED_MARKER;
        if (value === null || typeof value !== 'object') return value;
        if (typeof value === 'function') return "[Function]";
        
        try {
            const seen = new WeakSet();
            return JSON.parse(JSON.stringify(value, (key, val) => {
                if (val === undefined) return UNDEFINED_MARKER;
                if (typeof val === 'function') return "[Function]";
                if (typeof val === 'object' && val !== null) {
                    if (seen.has(val)) return "[Circular]";
                    seen.add(val);
                }
                return val;
            }));
        } catch (e) {
            if (Array.isArray(value)) {
                return value.map(item => deepCloneSafe(item, depth + 1, maxDepth));
            }
            const objRepresentation = {};
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    try {
                        objRepresentation[key] = deepCloneSafe(value[key], depth + 1, maxDepth);
                    } catch (innerE) {
                        objRepresentation[key] = "[Error Cloning Property]";
                    }
                }
            }
            return objRepresentation;
        }
    }
    
    global.${INSTRUMENTATION_NAMESPACE} = {
        recordArguments: function(functionName, originalArgs, thisVal, paramNamesFromAST) {
            const args = Array.from(originalArgs);
            
            if (!typeCache[functionName]) {
                typeCache[functionName] = { callCount: 0, paramData: {}, paramNames: paramNamesFromAST || [] };
            } else {
                if (paramNamesFromAST && paramNamesFromAST.length > 0 && 
                    JSON.stringify(typeCache[functionName].paramNames) !== JSON.stringify(paramNamesFromAST)) {
                    typeCache[functionName].paramNames = paramNamesFromAST;
                }
            }
            typeCache[functionName].callCount++;
            
            args.forEach((arg, index) => {
                if (!typeCache[functionName].paramData[index]) {
                    typeCache[functionName].paramData[index] = [];
                }
                const clonedArg = deepCloneSafe(arg);
                
                if (typeCache[functionName].paramData[index].length >= MAX_SAMPLES_PER_PARAM) {
                    typeCache[functionName].paramData[index].shift();
                }
                typeCache[functionName].paramData[index].push(clonedArg);
            });
        },
        
        getTypeCache: function() {
            return typeCache;
        },
        
        saveTypeCache: function() {
            try {
                const cacheFile = ${JSON.stringify(outputFile)};
                const dir = path.dirname(cacheFile);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(cacheFile, JSON.stringify(typeCache, null, 2));
            } catch (e) {
                console.error('[AutoTypeScript] Failed to save type cache:', e);
            }
        }
    };
    
    // Save cache on process exit
    process.on('exit', () => {
        global.${INSTRUMENTATION_NAMESPACE}.saveTypeCache();
    });
    
    // Handle uncaught exceptions and rejections to ensure cache is saved
    process.on('uncaughtException', (err) => {
        global.${INSTRUMENTATION_NAMESPACE}.saveTypeCache();
        throw err;
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        global.${INSTRUMENTATION_NAMESPACE}.saveTypeCache();
    });
})();
`;
}

export { INSTRUMENTATION_NAMESPACE };
