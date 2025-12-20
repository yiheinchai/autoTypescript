import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TypeCacheManager, TypeCacheTreeProvider } from './typeCacheManager';
import { TestRunner } from './testRunner';
import { TypeHoverProvider } from './hoverProvider';
import { generateTypeDefinitions, extractInterfacesFromCache } from './typeInference';

let typeCacheManager: TypeCacheManager;
let testRunner: TestRunner;
let outputChannel: vscode.OutputChannel;
let typeCacheTreeProvider: TypeCacheTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('AutoTypeScript');
    outputChannel.appendLine('AutoTypeScript extension activated');

    // Get workspace root
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showWarningMessage('AutoTypeScript: No workspace folder open');
        return;
    }

    // Initialize managers
    const config = vscode.workspace.getConfiguration('autotypescript');
    const maxSamples = config.get<number>('maxSamplesPerParam', 50);

    typeCacheManager = new TypeCacheManager(workspaceRoot, maxSamples);
    typeCacheManager.load();

    testRunner = new TestRunner(outputChannel, typeCacheManager, workspaceRoot);

    // Register tree view
    typeCacheTreeProvider = new TypeCacheTreeProvider(typeCacheManager);
    vscode.window.registerTreeDataProvider('autotypescriptTypeCache', typeCacheTreeProvider);

    // Register hover provider for JavaScript, TypeScript, and Python
    const hoverProvider = new TypeHoverProvider(typeCacheManager);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('javascript', hoverProvider),
        vscode.languages.registerHoverProvider('typescript', hoverProvider),
        vscode.languages.registerHoverProvider('javascriptreact', hoverProvider),
        vscode.languages.registerHoverProvider('typescriptreact', hoverProvider),
        vscode.languages.registerHoverProvider('python', hoverProvider)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('autotypescript.runTestsWithCapture', runTestsWithCapture),
        vscode.commands.registerCommand('autotypescript.generateTypes', generateTypes),
        vscode.commands.registerCommand('autotypescript.clearCache', clearCache),
        vscode.commands.registerCommand('autotypescript.showTypeCache', showTypeCache)
    );

    outputChannel.appendLine(`Workspace root: ${workspaceRoot}`);
    outputChannel.appendLine(`Type cache path: ${typeCacheManager.getCacheFilePath()}`);

    const stats = typeCacheManager.getStats();
    if (stats.functionCount > 0) {
        outputChannel.appendLine(`Loaded existing type cache: ${stats.functionCount} functions, ${stats.totalCalls} calls`);
    }
}

export function deactivate() {
    if (typeCacheManager) {
        typeCacheManager.save();
    }
    if (testRunner) {
        testRunner.stop();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}

function getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    return undefined;
}

async function runTestsWithCapture(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('AutoTypeScript: No workspace folder open');
        return;
    }

    // Detect project type
    const projectType = detectProjectType(workspaceRoot);
    const config = vscode.workspace.getConfiguration('autotypescript');
    let testCommand = config.get<string>('testCommand', '');

    // Auto-detect test command if not specified
    if (!testCommand) {
        testCommand = getDefaultTestCommand(workspaceRoot, projectType);
    }

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `AutoTypeScript: Running ${projectType} tests with type capture...`,
                cancellable: true,
            },
            async (progress, token) => {
                token.onCancellationRequested(() => {
                    testRunner.stop();
                });

                await testRunner.runTests(testCommand, projectType);
                typeCacheTreeProvider.refresh();
            }
        );

        vscode.window.showInformationMessage('AutoTypeScript: Type capture complete!');
    } catch (error) {
        vscode.window.showErrorMessage(`AutoTypeScript: Test run failed - ${error}`);
    }
}

function detectProjectType(workspaceRoot: string): 'javascript' | 'python' | 'unknown' {
    // Check for Python files
    const hasPythonFiles = fs.existsSync(path.join(workspaceRoot, 'setup.py')) ||
                          fs.existsSync(path.join(workspaceRoot, 'pyproject.toml')) ||
                          fs.existsSync(path.join(workspaceRoot, 'requirements.txt')) ||
                          fs.readdirSync(workspaceRoot).some(file => file.endsWith('.py'));

    // Check for JavaScript/TypeScript files
    const hasJsFiles = fs.existsSync(path.join(workspaceRoot, 'package.json')) ||
                      fs.readdirSync(workspaceRoot).some(file => 
                          file.endsWith('.js') || file.endsWith('.ts'));

    if (hasPythonFiles && !hasJsFiles) {
        return 'python';
    } else if (hasJsFiles) {
        return 'javascript';
    }

    return 'unknown';
}

function getDefaultTestCommand(workspaceRoot: string, projectType: 'javascript' | 'python' | 'unknown'): string {
    if (projectType === 'python') {
        // Check for pytest
        if (fs.existsSync(path.join(workspaceRoot, 'pytest.ini')) ||
            fs.existsSync(path.join(workspaceRoot, 'pyproject.toml'))) {
            return 'pytest';
        }
        return 'python -m pytest';
    } else if (projectType === 'javascript') {
        // Check package.json for test script
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return 'npm test';
        }
        return 'jest';
    }

    return 'npm test';
}

async function generateTypes(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('AutoTypeScript: No workspace folder open');
        return;
    }

    const config = vscode.workspace.getConfiguration('autotypescript');
    const outputPath = config.get<string>('outputPath', './generated-types');
    const fullOutputPath = path.isAbsolute(outputPath) ? outputPath : path.join(workspaceRoot, outputPath);

    try {
        // Ensure output directory exists
        if (!fs.existsSync(fullOutputPath)) {
            fs.mkdirSync(fullOutputPath, { recursive: true });
        }

        const cache = typeCacheManager.getCache();
        const stats = typeCacheManager.getStats();

        if (stats.functionCount === 0) {
            vscode.window.showWarningMessage('AutoTypeScript: No type data available. Run tests with type capture first.');
            return;
        }

        // Detect project type
        const projectType = detectProjectType(workspaceRoot);

        if (projectType === 'python') {
            // Generate Python stub files
            const functionDefs = generatePythonTypeDefinitions(cache);
            const functionDefsPath = path.join(fullOutputPath, 'stubs.pyi');
            fs.writeFileSync(functionDefsPath, functionDefs);

            // Generate index file
            const indexContent = `"""AutoTypeScript Generated Type Stubs
Generated at: ${new Date().toISOString()}
Functions tracked: ${stats.functionCount}
Total calls observed: ${stats.totalCalls}
"""

from .stubs import *
`;
            const indexPath = path.join(fullOutputPath, '__init__.pyi');
            fs.writeFileSync(indexPath, indexContent);

            outputChannel.appendLine(`Generated Python type stubs in: ${fullOutputPath}`);
            outputChannel.appendLine(`- stubs.pyi: ${stats.functionCount} function declarations`);

            // Open the generated file
            const doc = await vscode.workspace.openTextDocument(functionDefsPath);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage(`AutoTypeScript: Generated Python type stubs in ${outputPath}`);
        } else {
            // Generate TypeScript definition files
            const functionDefs = generateTypeDefinitions(cache);
            const functionDefsPath = path.join(fullOutputPath, 'functions.d.ts');
            fs.writeFileSync(functionDefsPath, functionDefs);

            // Generate interfaces
            const interfaces = extractInterfacesFromCache(cache);
            if (interfaces.trim()) {
                const interfacesPath = path.join(fullOutputPath, 'interfaces.d.ts');
                fs.writeFileSync(interfacesPath, `// Auto-generated interfaces from runtime data\n\n${interfaces}`);
            }

            // Generate index file
            const indexContent = `// AutoTypeScript Generated Types
// Generated at: ${new Date().toISOString()}
// Functions tracked: ${stats.functionCount}
// Total calls observed: ${stats.totalCalls}

export * from './functions';
${interfaces.trim() ? "export * from './interfaces';" : ''}
`;
            const indexPath = path.join(fullOutputPath, 'index.d.ts');
            fs.writeFileSync(indexPath, indexContent);

            outputChannel.appendLine(`Generated TypeScript type definitions in: ${fullOutputPath}`);
            outputChannel.appendLine(`- functions.d.ts: ${stats.functionCount} function declarations`);

            // Open the generated file
            const doc = await vscode.workspace.openTextDocument(functionDefsPath);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage(`AutoTypeScript: Generated type definitions in ${outputPath}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`AutoTypeScript: Failed to generate types - ${error}`);
    }
}

function generatePythonTypeDefinitions(cache: any): string {
    const lines = [
        '"""Auto-generated type stubs from runtime data"""',
        '"""Generated by AutoTypeScript"""',
        '',
        'from typing import Any, Dict, List, Callable, Optional, Union',
        '',
    ];

    for (const funcName in cache) {
        if (!Object.prototype.hasOwnProperty.call(cache, funcName)) {
            continue;
        }

        const funcData = cache[funcName];
        const paramNames = funcData.paramNames || [];
        const params = [];

        let maxParams = paramNames.length;
        if (funcData.paramData) {
            const indices = Object.keys(funcData.paramData).map(Number);
            if (indices.length > 0) {
                maxParams = Math.max(maxParams, Math.max(...indices) + 1);
            }
        }

        for (let i = 0; i < maxParams; i++) {
            const paramName = paramNames[i] || `arg${i}`;
            params.push(`${paramName}: Any`);
        }

        const simpleFuncName = funcName.split('.').pop();
        lines.push(`def ${simpleFuncName}(${params.join(', ')}) -> Any: ...`);
        lines.push('');
    }

    return lines.join('\n');
}

async function clearCache(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
        'AutoTypeScript: Are you sure you want to clear the type cache?',
        'Yes',
        'No'
    );

    if (confirm === 'Yes') {
        typeCacheManager.clear();
        typeCacheTreeProvider.refresh();
        outputChannel.appendLine('Type cache cleared');
        vscode.window.showInformationMessage('AutoTypeScript: Type cache cleared');
    }
}

async function showTypeCache(): Promise<void> {
    const cache = typeCacheManager.getCache();
    const stats = typeCacheManager.getStats();

    if (stats.functionCount === 0) {
        vscode.window.showInformationMessage('AutoTypeScript: Type cache is empty. Run tests with type capture to collect data.');
        return;
    }

    // Create a preview of the type cache
    const lines: string[] = [
        '# AutoTypeScript - Type Cache',
        '',
        `**Functions tracked:** ${stats.functionCount}`,
        `**Total calls observed:** ${stats.totalCalls}`,
        '',
        '---',
        '',
    ];

    for (const funcName in cache) {
        if (!Object.prototype.hasOwnProperty.call(cache, funcName)) {
            continue;
        }

        const funcData = cache[funcName];
        const paramNames = funcData.paramNames || [];

        lines.push(`## \`${funcName}\``);
        lines.push(`- Calls: ${funcData.callCount}`);
        lines.push('- Parameters:');

        let maxParams = paramNames.length;
        if (funcData.paramData) {
            const indices = Object.keys(funcData.paramData).map(Number);
            if (indices.length > 0) {
                maxParams = Math.max(maxParams, Math.max(...indices) + 1);
            }
        }

        for (let i = 0; i < maxParams; i++) {
            const paramName = paramNames[i] || `arg${i}`;
            const samples = funcData.paramData?.[i]?.length || 0;
            lines.push(`  - \`${paramName}\`: ${samples} samples`);
        }

        lines.push('');
    }

    // Show in a virtual document
    const content = lines.join('\n');
    const uri = vscode.Uri.parse('autotypescript://type-cache/preview.md');

    const provider = new (class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(_uri: vscode.Uri): string { // eslint-disable-line @typescript-eslint/no-unused-vars
            return content;
        }
    })();

    const registration = vscode.workspace.registerTextDocumentContentProvider('autotypescript', provider);
    
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });

    // Clean up registration after a delay
    setTimeout(() => registration.dispose(), 60000);
}
