import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  transformCodeForInstrumentation,
  generateRuntimeInstrumentationCode,
} from "./instrumentation";
import { TypeCacheManager } from "./typeCacheManager";
import { TypeCache } from "./typeInference";
import { ChildProcess, spawn } from "child_process";

/**
 * Test Runner that instruments code and captures type data during test execution
 */
export class TestRunner {
  private outputChannel: vscode.OutputChannel;
  private cacheManager: TypeCacheManager;
  private workspaceRoot: string;
  private setupFilePath: string;
  private runningProcess: ChildProcess | null = null;

  constructor(
    outputChannel: vscode.OutputChannel,
    cacheManager: TypeCacheManager,
    workspaceRoot: string
  ) {
    this.outputChannel = outputChannel;
    this.cacheManager = cacheManager;
    this.workspaceRoot = workspaceRoot;
    this.setupFilePath = path.join(
      workspaceRoot,
      ".autotypescript",
      "setup.js"
    );
  }

  /**
   * Run tests with type capture instrumentation
   */
  async runTests(testCommand: string, projectType: 'javascript' | 'python' | 'unknown' = 'javascript'): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine("=".repeat(50));
    this.outputChannel.appendLine(
      `[AutoTypeScript] Starting ${projectType} test run with type capture...`
    );
    this.outputChannel.appendLine(
      `[AutoTypeScript] Test command: ${testCommand}`
    );
    this.outputChannel.appendLine("=".repeat(50));

    try {
      // Create the instrumentation setup file
      await this.createSetupFile(projectType);

      // Determine the test framework and adjust the command
      const adjustedCommand = this.adjustTestCommand(testCommand, projectType);
      this.outputChannel.appendLine(
        `[AutoTypeScript] Adjusted command: ${adjustedCommand}`
      );

      // Run the tests
      await this.executeTests(adjustedCommand, projectType);

      // Load the captured type data
      await this.loadCapturedData();

      this.outputChannel.appendLine("");
      this.outputChannel.appendLine("[AutoTypeScript] Test run complete!");
      this.outputChannel.appendLine(
        `[AutoTypeScript] Type cache updated: ${this.cacheManager.getCacheFilePath()}`
      );

      const stats = this.cacheManager.getStats();
      this.outputChannel.appendLine(
        `[AutoTypeScript] Functions tracked: ${stats.functionCount}`
      );
      this.outputChannel.appendLine(
        `[AutoTypeScript] Total function calls: ${stats.totalCalls}`
      );
    } catch (error) {
      this.outputChannel.appendLine(`[AutoTypeScript] Error: ${error}`);
      throw error;
    }
  }

  /**
   * Stop any running test process
   */
  stop(): void {
    if (this.runningProcess) {
      this.runningProcess.kill();
      this.runningProcess = null;
      this.outputChannel.appendLine("[AutoTypeScript] Test run stopped.");
    }
  }

  /**
   * Create the setup file that will be loaded before tests
   */
  private async createSetupFile(projectType: 'javascript' | 'python' | 'unknown'): Promise<void> {
    const setupDir = path.dirname(this.setupFilePath);
    if (!fs.existsSync(setupDir)) {
      fs.mkdirSync(setupDir, { recursive: true });
    }

    if (projectType === 'python') {
      // Create Python instrumentation file
      await this.createPythonSetupFile(setupDir);
    } else {
      // Create JavaScript instrumentation file
      await this.copyDependencies(setupDir);

      const cacheFilePath = this.cacheManager.getCacheFilePath();
      const setupCode = generateRuntimeInstrumentationCode(
        cacheFilePath,
        setupDir
      );

      fs.writeFileSync(this.setupFilePath, setupCode);
      this.outputChannel.appendLine(
        `[AutoTypeScript] Created setup file: ${this.setupFilePath}`
      );
    }
  }

  /**
   * Create Python instrumentation setup file
   */
  private async createPythonSetupFile(setupDir: string): Promise<void> {
    const cacheFilePath = this.cacheManager.getCacheFilePath();
    
    // Copy the Python instrumentation module to the workspace root
    const extensionPath = vscode.extensions.getExtension(
      "yiheinchai.autotypescript"
    )?.extensionPath;

    const sourcePyInstrumentation = extensionPath 
      ? path.join(extensionPath, 'python_instrumentation.py')
      : path.join(__dirname, '..', '..', 'python_instrumentation.py');

    // Copy to workspace root instead of .autotypescript
    const destPyInstrumentation = path.join(this.workspaceRoot, 'python_instrumentation.py');
    if (fs.existsSync(sourcePyInstrumentation)) {
      fs.copyFileSync(sourcePyInstrumentation, destPyInstrumentation);
      this.outputChannel.appendLine(
        `[AutoTypeScript] Copied python_instrumentation.py to workspace`
      );
    }

    // Create conftest.py for pytest in the workspace root
    const conftestPath = path.join(this.workspaceRoot, 'conftest.py');
    const conftestCode = `# AutoTypeScript Python Runtime Instrumentation
# This file is automatically generated
import sys
import os

# Import and install instrumentation
try:
    from python_instrumentation import install_instrumentation
    
    workspace_root = os.path.dirname(os.path.abspath(__file__))
    cache_file = ${JSON.stringify(cacheFilePath)}
    
    install_instrumentation(cache_file, workspace_root)
except Exception as e:
    print(f"[AutoTypeScript] Failed to install instrumentation: {e}", file=sys.stderr)
`;

    fs.writeFileSync(conftestPath, conftestCode);
    this.setupFilePath = conftestPath; // Update setup file path for Python
    this.outputChannel.appendLine(
      `[AutoTypeScript] Created conftest.py: ${conftestPath}`
    );
  }

  /**
   * Copy required npm dependencies to the autotypescript directory
   */
  private async copyDependencies(targetDir: string): Promise<void> {
    const extensionPath = vscode.extensions.getExtension(
      "yiheinchai.autotypescript"
    )?.extensionPath;

    if (!extensionPath) {
      // Fallback for development mode - try to find modules in the extension's node_modules
      this.outputChannel.appendLine(
        "[AutoTypeScript] Running in development mode, using local node_modules"
      );
      return;
    }

    const nodeModulesDir = path.join(targetDir, "node_modules");
    if (!fs.existsSync(nodeModulesDir)) {
      fs.mkdirSync(nodeModulesDir, { recursive: true });
    }

    const dependencies = ["acorn", "acorn-walk", "astring"];

    for (const dep of dependencies) {
      const sourcePath = path.join(extensionPath, "node_modules", dep);
      const targetPath = path.join(nodeModulesDir, dep);

      if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
        this.copyDirectorySync(sourcePath, targetPath);
        this.outputChannel.appendLine(
          `[AutoTypeScript] Copied dependency: ${dep}`
        );
      }
    }
  }

  /**
   * Recursively copy a directory
   */
  private copyDirectorySync(source: string, target: string): void {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectorySync(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * Adjust the test command to include instrumentation
   */
  private adjustTestCommand(testCommand: string, projectType: 'javascript' | 'python' | 'unknown'): string {
    const cmd = testCommand.toLowerCase();

    if (projectType === 'python') {
      // For Python tests
      if (cmd.includes('pytest')) {
        // Add pytest plugin or conftest
        return `${testCommand}`;
      } else if (cmd.includes('python -m unittest')) {
        return `${testCommand}`;
      }
      // Default Python test command
      return testCommand;
    } else {
      // For JavaScript/TypeScript tests (existing logic)
      // For Jest
      if (cmd.includes("jest")) {
        const setupFlag = `--setupFilesAfterEnv="${this.setupFilePath}"`;
        if (!cmd.includes("--setupfilesafterenv")) {
          return `${testCommand} ${setupFlag}`;
        }
      }

      // For Mocha
      if (cmd.includes("mocha")) {
        const requireFlag = `--require "${this.setupFilePath}"`;
        if (!cmd.includes("--require")) {
          return `${testCommand} ${requireFlag}`;
        }
      }

      // For Node directly
      if (cmd.includes("node ")) {
        return `node --require "${this.setupFilePath}" ${testCommand.replace(
          /^node\s+/i,
          ""
        )}`;
      }

      // For npm test - we need to pass through NODE_OPTIONS
      if (cmd === "npm test" || cmd === "npm run test") {
        return testCommand;
      }

      // Default: try to use NODE_OPTIONS
      return testCommand;
    }
  }

  /**
   * Execute the test command
   */
  private executeTests(command: string, projectType: 'javascript' | 'python' | 'unknown'): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = this.parseCommand(command);

      let env: NodeJS.ProcessEnv;

      if (projectType === 'python') {
        // Set up environment for Python tests
        // conftest.py will be automatically loaded by pytest
        env = {
          ...process.env,
          AUTOTYPESCRIPT_CACHE_PATH: this.cacheManager.getCacheFilePath(),
        };

        this.outputChannel.appendLine(
          `[AutoTypeScript] Running: ${cmd} ${args.join(" ")}`
        );

        this.runningProcess = spawn(cmd, args, {
          cwd: this.workspaceRoot,
          env,
          shell: true,
          stdio: ["inherit", "pipe", "pipe"],
        });
      } else {
        // Set up environment with NODE_OPTIONS for JavaScript instrumentation
        env = {
          ...process.env,
          NODE_OPTIONS: `--require "${this.setupFilePath}" ${
            process.env.NODE_OPTIONS || ""
          }`.trim(),
          AUTOTYPESCRIPT_CACHE_PATH: this.cacheManager.getCacheFilePath(),
        };

        this.outputChannel.appendLine(
          `[AutoTypeScript] Running: ${cmd} ${args.join(" ")}`
        );

        this.runningProcess = spawn(cmd, args, {
          cwd: this.workspaceRoot,
          env,
          shell: true,
          stdio: ["inherit", "pipe", "pipe"],
        });
      }

      this.runningProcess.stdout?.on("data", (data: any) => {
        this.outputChannel.append(data.toString());
      });

      this.runningProcess.stderr?.on("data", (data: any) => {
        this.outputChannel.append(data.toString());
      });

      this.runningProcess.on("close", (code: any) => {
        this.runningProcess = null;
        if (code === 0 || code === null) {
          resolve();
        } else {
          // Don't reject on test failures - we still want to capture types
          this.outputChannel.appendLine(
            `[AutoTypeScript] Tests exited with code ${code}`
          );
          resolve();
        }
      });

      this.runningProcess.on("error", (error: any) => {
        this.runningProcess = null;
        reject(error);
      });
    });
  }

  /**
   * Parse a command string into command and arguments
   */
  private parseCommand(command: string): string[] {
    // Simple parsing - handles basic cases
    const parts: string[] = [];
    let current = "";
    let inQuote = false;
    let quoteChar = "";

    for (const char of command) {
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = "";
      } else if (char === " " && !inQuote) {
        if (current) {
          parts.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Load captured type data from the test run
   */
  private async loadCapturedData(): Promise<void> {
    const cacheFilePath = this.cacheManager.getCacheFilePath();

    if (fs.existsSync(cacheFilePath)) {
      try {
        const data = fs.readFileSync(cacheFilePath, "utf8");
        const capturedCache: TypeCache = JSON.parse(data);
        this.cacheManager.merge(capturedCache);
        this.cacheManager.save();
        this.outputChannel.appendLine(
          "[AutoTypeScript] Type cache loaded and merged."
        );
      } catch (error) {
        this.outputChannel.appendLine(
          `[AutoTypeScript] Failed to load captured data: ${error}`
        );
      }
    } else {
      this.outputChannel.appendLine(
        "[AutoTypeScript] No type cache file found after test run."
      );
    }
  }

  /**
   * Instrument a specific file for type capture
   */
  instrumentFile(filePath: string): string | null {
    try {
      const code = fs.readFileSync(filePath, "utf8");
      return transformCodeForInstrumentation(code);
    } catch (error) {
      this.outputChannel.appendLine(
        `[AutoTypeScript] Failed to instrument file ${filePath}: ${error}`
      );
      return null;
    }
  }
}
