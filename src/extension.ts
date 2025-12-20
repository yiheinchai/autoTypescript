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
    outputChannel = vscode.window.createOutputChannel('AutoPython');
    outputChannel.appendLine('AutoPython extension activated');

    // Get workspace root
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showWarningMessage('AutoPython: No workspace folder open');
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

    // Register hover provider for Python
    const hoverProvider = new TypeHoverProvider(typeCacheManager);
    context.subscriptions.push(
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
    const config = vscode.workspace.getConfiguration('autotypescript');
    const testCommand = config.get<string>('testCommand', 'npm test');

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'AutoPython: Running tests with type capture...',
                cancellable: true,
            },
            async (progress, token) => {
                token.onCancellationRequested(() => {
                    testRunner.stop();
                });

                await testRunner.runTests(testCommand);
                typeCacheTreeProvider.refresh();
            }
        );

        vscode.window.showInformationMessage('AutoPython: Type capture complete!');
    } catch (error) {
        vscode.window.showErrorMessage(`AutoPython: Test run failed - ${error}`);
    }
}

async function generateTypes(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('AutoPython: No workspace folder open');
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
            vscode.window.showWarningMessage('AutoPython: No type data available. Run tests with type capture first.');
            return;
        }

        // Generate Python stub files
        const functionDefs = generateTypeDefinitions(cache);
        const functionDefsPath = path.join(fullOutputPath, 'stubs.pyi');
        fs.writeFileSync(functionDefsPath, functionDefs);

        // Generate index file
        const indexContent = `"""AutoPython Generated Type Stubs
Generated at: ${new Date().toISOString()}
Functions tracked: ${stats.functionCount}
Total calls observed: ${stats.totalCalls}
"""

from .stubs import *
`;
        const indexPath = path.join(fullOutputPath, '__init__.pyi');
        fs.writeFileSync(indexPath, indexContent);

        outputChannel.appendLine(`Generated type stubs in: ${fullOutputPath}`);
        outputChannel.appendLine(`- stubs.pyi: ${stats.functionCount} function declarations`);

        // Open the generated file
        const doc = await vscode.workspace.openTextDocument(functionDefsPath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`AutoPython: Generated type stubs in ${outputPath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`AutoPython: Failed to generate types - ${error}`);
    }
}

async function clearCache(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
        'AutoPython: Are you sure you want to clear the type cache?',
        'Yes',
        'No'
    );

    if (confirm === 'Yes') {
        typeCacheManager.clear();
        typeCacheTreeProvider.refresh();
        outputChannel.appendLine('Type cache cleared');
        vscode.window.showInformationMessage('AutoPython: Type cache cleared');
    }
}

async function showTypeCache(): Promise<void> {
    const cache = typeCacheManager.getCache();
    const stats = typeCacheManager.getStats();

    if (stats.functionCount === 0) {
        vscode.window.showInformationMessage('AutoPython: Type cache is empty. Run tests with type capture to collect data.');
        return;
    }

    // Create a preview of the type cache
    const lines: string[] = [
        '# AutoPython - Type Cache',
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
