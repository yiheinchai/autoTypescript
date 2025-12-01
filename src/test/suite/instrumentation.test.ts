import * as assert from 'assert';
import { transformCodeForInstrumentation } from '../../instrumentation';

suite('Code Instrumentation Test Suite', () => {
    suite('transformCodeForInstrumentation', () => {
        test('should instrument function declarations', () => {
            const code = `function greet(name) { console.log(name); }`;
            const result = transformCodeForInstrumentation(code);
            assert.ok(result.includes('__AUTOTYPESCRIPT__'));
            assert.ok(result.includes('recordArguments'));
        });

        test('should instrument arrow functions assigned to variables', () => {
            const code = `const add = (a, b) => a + b;`;
            const result = transformCodeForInstrumentation(code);
            assert.ok(result.includes('__AUTOTYPESCRIPT__'));
        });

        test('should instrument function expressions', () => {
            const code = `const handler = function(event) { return event; };`;
            const result = transformCodeForInstrumentation(code);
            assert.ok(result.includes('__AUTOTYPESCRIPT__'));
        });

        test('should preserve original code on parse error', () => {
            const invalidCode = `function incomplete(`;
            const result = transformCodeForInstrumentation(invalidCode);
            assert.strictEqual(result, invalidCode);
        });

        test('should handle multiple functions', () => {
            const code = `
                function first(a) { return a; }
                const second = (b) => b;
                const third = function(c) { return c; };
            `;
            const result = transformCodeForInstrumentation(code);
            // Should have multiple recordArguments calls
            const matches = result.match(/__AUTOTYPESCRIPT__/g);
            assert.ok(matches && matches.length >= 3);
        });

        test('should handle default parameters', () => {
            const code = `function withDefault(x = 10) { return x; }`;
            const result = transformCodeForInstrumentation(code);
            assert.ok(result.includes('__AUTOTYPESCRIPT__'));
        });

        test('should handle rest parameters', () => {
            const code = `function withRest(a, ...rest) { return rest; }`;
            const result = transformCodeForInstrumentation(code);
            assert.ok(result.includes('__AUTOTYPESCRIPT__'));
        });
    });
});
