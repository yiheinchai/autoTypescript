import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TypeCache, FunctionTypeData, deepCloneSafe } from './typeInference';

/**
 * Manages the type cache for the extension
 */
export class TypeCacheManager {
    private cache: TypeCache = {};
    private cacheFilePath: string;
    private maxSamplesPerParam: number;

    constructor(workspaceRoot: string, maxSamples: number = 50) {
        this.cacheFilePath = path.join(workspaceRoot, '.autotypescript', 'type-cache.json');
        this.maxSamplesPerParam = maxSamples;
    }

    /**
     * Load the type cache from disk
     */
    load(): void {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const data = fs.readFileSync(this.cacheFilePath, 'utf8');
                this.cache = JSON.parse(data);
            }
        } catch (error) {
            console.error('[AutoTypeScript] Failed to load type cache:', error);
            this.cache = {};
        }
    }

    /**
     * Save the type cache to disk
     */
    save(): void {
        try {
            const dir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, 2));
        } catch (error) {
            console.error('[AutoTypeScript] Failed to save type cache:', error);
        }
    }

    /**
     * Clear the type cache
     */
    clear(): void {
        this.cache = {};
        this.save();
    }

    /**
     * Get the entire type cache
     */
    getCache(): TypeCache {
        return this.cache;
    }

    /**
     * Get type data for a specific function
     */
    getFunctionData(functionName: string): FunctionTypeData | undefined {
        return this.cache[functionName];
    }

    /**
     * Record arguments for a function call
     */
    recordArguments(functionName: string, args: unknown[], paramNames: string[]): void {
        if (!this.cache[functionName]) {
            this.cache[functionName] = {
                callCount: 0,
                paramData: {},
                paramNames: paramNames || [],
            };
        } else if (paramNames && paramNames.length > 0) {
            // Update param names if they changed
            const existingNames = JSON.stringify(this.cache[functionName].paramNames);
            const newNames = JSON.stringify(paramNames);
            if (existingNames !== newNames) {
                this.cache[functionName].paramNames = paramNames;
            }
        }

        this.cache[functionName].callCount++;

        args.forEach((arg, index) => {
            if (!this.cache[functionName].paramData[index]) {
                this.cache[functionName].paramData[index] = [];
            }

            const clonedArg = deepCloneSafe(arg);

            // Keep only the most recent samples
            if (this.cache[functionName].paramData[index].length >= this.maxSamplesPerParam) {
                this.cache[functionName].paramData[index].shift();
            }
            this.cache[functionName].paramData[index].push(clonedArg);
        });
    }

    /**
     * Merge another cache into this one
     */
    merge(otherCache: TypeCache): void {
        for (const funcName in otherCache) {
            if (!Object.prototype.hasOwnProperty.call(otherCache, funcName)) {
                continue;
            }

            const otherData = otherCache[funcName];

            if (!this.cache[funcName]) {
                this.cache[funcName] = {
                    callCount: otherData.callCount,
                    paramData: {},
                    paramNames: otherData.paramNames || [],
                };
            } else {
                this.cache[funcName].callCount += otherData.callCount;
                // Update param names if new ones are available
                if (otherData.paramNames && otherData.paramNames.length > 0) {
                    this.cache[funcName].paramNames = otherData.paramNames;
                }
            }

            // Merge param data
            for (const paramIndex in otherData.paramData) {
                if (!Object.prototype.hasOwnProperty.call(otherData.paramData, paramIndex)) {
                    continue;
                }

                const idx = Number(paramIndex);
                if (!this.cache[funcName].paramData[idx]) {
                    this.cache[funcName].paramData[idx] = [];
                }

                // Add new samples, respecting the max limit
                for (const value of otherData.paramData[idx]) {
                    if (this.cache[funcName].paramData[idx].length >= this.maxSamplesPerParam) {
                        this.cache[funcName].paramData[idx].shift();
                    }
                    this.cache[funcName].paramData[idx].push(value);
                }
            }
        }
    }

    /**
     * Get the cache file path
     */
    getCacheFilePath(): string {
        return this.cacheFilePath;
    }

    /**
     * Get statistics about the cache
     */
    getStats(): { functionCount: number; totalCalls: number } {
        let totalCalls = 0;
        let functionCount = 0;

        for (const funcName in this.cache) {
            if (Object.prototype.hasOwnProperty.call(this.cache, funcName)) {
                functionCount++;
                totalCalls += this.cache[funcName].callCount;
            }
        }

        return { functionCount, totalCalls };
    }
}

/**
 * Create a TreeDataProvider for displaying the type cache
 */
export class TypeCacheTreeProvider implements vscode.TreeDataProvider<TypeCacheTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TypeCacheTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private cacheManager: TypeCacheManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TypeCacheTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TypeCacheTreeItem): Thenable<TypeCacheTreeItem[]> {
        if (!element) {
            // Root level - show functions
            const cache = this.cacheManager.getCache();
            const items: TypeCacheTreeItem[] = [];

            for (const funcName in cache) {
                if (Object.prototype.hasOwnProperty.call(cache, funcName)) {
                    const funcData = cache[funcName];
                    const item = new TypeCacheTreeItem(
                        funcName,
                        `(${funcData.callCount} calls)`,
                        vscode.TreeItemCollapsibleState.Collapsed
                    );
                    item.contextValue = 'function';
                    items.push(item);
                }
            }

            return Promise.resolve(items);
        } else if (element.contextValue === 'function') {
            // Show parameters for this function
            const funcData = this.cacheManager.getFunctionData(element.label as string);
            if (!funcData) {
                return Promise.resolve([]);
            }

            const items: TypeCacheTreeItem[] = [];
            const paramNames = funcData.paramNames || [];

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
                const item = new TypeCacheTreeItem(
                    paramName,
                    `(${samples} samples)`,
                    vscode.TreeItemCollapsibleState.None
                );
                item.contextValue = 'parameter';
                items.push(item);
            }

            return Promise.resolve(items);
        }

        return Promise.resolve([]);
    }
}

class TypeCacheTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${label} ${description}`;
    }
}
