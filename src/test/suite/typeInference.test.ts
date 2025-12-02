import * as assert from 'assert';
import {
    inferSingleValueType,
    inferTypeForParam,
    generateTypeDefinitions,
    UNDEFINED_MARKER,
    FUNCTION_MARKER,
    CIRCULAR_MARKER,
    MAX_DEPTH_MARKER,
    deepCloneSafe,
    TypeCache,
} from '../../typeInference';

suite('Type Inference Test Suite', () => {
    suite('inferSingleValueType', () => {
        test('should infer primitive types', () => {
            assert.strictEqual(inferSingleValueType(42), 'number');
            assert.strictEqual(inferSingleValueType('hello'), 'string');
            assert.strictEqual(inferSingleValueType(true), 'boolean');
            assert.strictEqual(inferSingleValueType(null), 'null');
        });

        test('should handle special markers', () => {
            assert.strictEqual(inferSingleValueType(UNDEFINED_MARKER), 'undefined');
            assert.strictEqual(inferSingleValueType(FUNCTION_MARKER), 'Function');
            assert.strictEqual(inferSingleValueType(CIRCULAR_MARKER), 'object /* circular */');
            assert.strictEqual(inferSingleValueType(MAX_DEPTH_MARKER), 'object /* max depth */');
        });

        test('should infer array types', () => {
            assert.strictEqual(inferSingleValueType([]), 'unknown[]');
            assert.strictEqual(inferSingleValueType([1, 2, 3]), 'number[]');
            assert.strictEqual(inferSingleValueType(['a', 'b']), 'string[]');
            assert.strictEqual(inferSingleValueType([1, 'a', true]), '(number | string | boolean)[]');
        });

        test('should infer object types', () => {
            assert.strictEqual(inferSingleValueType({}), '{}');
            assert.strictEqual(inferSingleValueType({ name: 'test' }), '{ name: string }');
            assert.strictEqual(inferSingleValueType({ age: 25, active: true }), '{ age: number; active: boolean }');
        });
    });

    suite('inferTypeForParam', () => {
        test('should return unknown for empty array', () => {
            assert.strictEqual(inferTypeForParam([]), 'unknown');
        });

        test('should infer single type from consistent values', () => {
            assert.strictEqual(inferTypeForParam([1, 2, 3]), 'number');
            assert.strictEqual(inferTypeForParam(['a', 'b', 'c']), 'string');
        });

        test('should infer union type from mixed values', () => {
            const result = inferTypeForParam([1, 'hello']);
            assert.ok(result.includes('number'));
            assert.ok(result.includes('string'));
            assert.ok(result.includes('|'));
        });
    });

    suite('deepCloneSafe', () => {
        test('should clone primitive values', () => {
            assert.strictEqual(deepCloneSafe(42), 42);
            assert.strictEqual(deepCloneSafe('test'), 'test');
            assert.strictEqual(deepCloneSafe(true), true);
            assert.strictEqual(deepCloneSafe(null), null);
        });

        test('should handle undefined', () => {
            assert.strictEqual(deepCloneSafe(undefined), UNDEFINED_MARKER);
        });

        test('should handle functions', () => {
            assert.strictEqual(deepCloneSafe(() => {}), FUNCTION_MARKER);
        });

        test('should clone objects', () => {
            const obj = { name: 'test', value: 42 };
            const cloned = deepCloneSafe(obj);
            assert.deepStrictEqual(cloned, obj);
        });

        test('should clone arrays', () => {
            const arr = [1, 2, 3];
            const cloned = deepCloneSafe(arr);
            assert.deepStrictEqual(cloned, arr);
        });
    });

    suite('generateTypeDefinitions', () => {
        test('should generate empty output for empty cache', () => {
            const result = generateTypeDefinitions({});
            assert.ok(result.includes('// Auto-generated type definitions'));
        });

        test('should generate function declarations', () => {
            const cache: TypeCache = {
                myFunction: {
                    callCount: 5,
                    paramNames: ['arg1', 'arg2'],
                    paramData: {
                        0: [1, 2, 3],
                        1: ['a', 'b'],
                    },
                },
            };
            const result = generateTypeDefinitions(cache);
            assert.ok(result.includes('declare function myFunction'));
            assert.ok(result.includes('arg1: number'));
            assert.ok(result.includes('arg2: string'));
        });

        test('should handle rest parameters', () => {
            const cache: TypeCache = {
                restFunc: {
                    callCount: 1,
                    paramNames: ['a', '...rest'],
                    paramData: {
                        0: [1],
                        1: [[1, 2, 3]],
                    },
                },
            };
            const result = generateTypeDefinitions(cache);
            assert.ok(result.includes('...rest:'));
        });
    });
});
