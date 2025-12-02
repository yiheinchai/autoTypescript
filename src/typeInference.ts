/**
 * Type Cache - Stores observed runtime data for functions
 */
export interface ParamData {
  [paramIndex: number]: unknown[];
}

export interface FunctionTypeData {
  callCount: number;
  paramNames: string[];
  paramData: ParamData;
}

export interface TypeCache {
  [functionName: string]: FunctionTypeData;
}

// Special markers for serialization
export const UNDEFINED_MARKER = "[[UNDEFINED_MARKER_VALUE]]";
export const FUNCTION_MARKER = "[Function]";
export const CIRCULAR_MARKER = "[Circular]";
export const MAX_DEPTH_MARKER = "[Max Depth Exceeded]";

/**
 * Deep clone a value safely, handling circular references and special types
 */
export function deepCloneSafe(
  value: unknown,
  depth = 0,
  maxDepth = 10
): unknown {
  if (depth > maxDepth) {
    return MAX_DEPTH_MARKER;
  }
  if (value === undefined) {
    return UNDEFINED_MARKER;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (typeof value === "function") {
    return FUNCTION_MARKER;
  }

  try {
    const seen = new WeakSet();
    return JSON.parse(
      JSON.stringify(value, (_key, val) => {
        if (val === undefined) {
          return UNDEFINED_MARKER;
        }
        if (typeof val === "function") {
          return FUNCTION_MARKER;
        }
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) {
            return CIRCULAR_MARKER;
          }
          seen.add(val);
        }
        return val;
      })
    );
  } catch {
    if (Array.isArray(value)) {
      return value.map((item) => deepCloneSafe(item, depth + 1, maxDepth));
    }
    const objRepresentation: Record<string, unknown> = {};
    for (const key in value as object) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        try {
          objRepresentation[key] = deepCloneSafe(
            (value as Record<string, unknown>)[key],
            depth + 1,
            maxDepth
          );
        } catch {
          objRepresentation[key] = "[Error Cloning Property]";
        }
      }
    }
    return objRepresentation;
  }
}

/**
 * Infer the type of a single value
 */
export function inferSingleValueType(value: unknown): string {
  if (value === UNDEFINED_MARKER) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (value === FUNCTION_MARKER) {
    return "Function";
  }
  if (value === CIRCULAR_MARKER) {
    return "object /* circular */";
  }
  if (value === MAX_DEPTH_MARKER) {
    return "object /* max depth */";
  }

  const type = typeof value;

  if (type === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "unknown[]";
      }
      const elementTypes = new Set<string>();
      value.forEach((item) => elementTypes.add(inferSingleValueType(item)));
      const uniqueElementTypes = Array.from(elementTypes);
      if (uniqueElementTypes.length > 1) {
        return `(${uniqueElementTypes.join(" | ")})[]`;
      }
      return `${uniqueElementTypes[0] || "unknown"}[]`;
    } else {
      const shape: Record<string, string> = {};
      let isEmpty = true;
      for (const key in value as object) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          isEmpty = false;
          shape[key] = inferSingleValueType(
            (value as Record<string, unknown>)[key]
          );
        }
      }
      if (isEmpty) {
        return "{}";
      }
      const formattedShape = Object.entries(shape)
        .map(([k, t]) => {
          const safeKey = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(k)
            ? k
            : JSON.stringify(k);
          return `${safeKey}: ${t}`;
        })
        .join("; ");
      return `{ ${formattedShape} }`;
    }
  }
  return type;
}

/**
 * Infer type for a parameter from multiple observed values
 * Merges object shapes into a single type with optional properties
 * @param observedValues - Array of observed runtime values
 * @param pretty - Whether to format with indentation and line breaks
 * @param indentLevel - Current indentation level (for recursive calls)
 */
export function inferTypeForParam(
  observedValues: unknown[],
  pretty = false,
  indentLevel = 0
): string {
  if (!observedValues || observedValues.length === 0) {
    return "unknown";
  }

  // Separate values by category
  const primitiveTypes = new Set<string>();
  const arrayValues: unknown[][] = [];
  const objectValues: Record<string, unknown>[] = [];

  for (const value of observedValues) {
    if (value === null) {
      primitiveTypes.add("null");
    } else if (value === UNDEFINED_MARKER) {
      primitiveTypes.add("undefined");
    } else if (value === FUNCTION_MARKER) {
      primitiveTypes.add("Function");
    } else if (value === CIRCULAR_MARKER || value === MAX_DEPTH_MARKER) {
      primitiveTypes.add("object");
    } else if (Array.isArray(value)) {
      arrayValues.push(value);
    } else if (typeof value === "object") {
      objectValues.push(value as Record<string, unknown>);
    } else {
      primitiveTypes.add(typeof value);
    }
  }

  const resultTypes: string[] = [];

  // Add primitive types
  resultTypes.push(...primitiveTypes);

  // Merge array types
  if (arrayValues.length > 0) {
    const allElements = arrayValues.flat();
    if (allElements.length === 0) {
      resultTypes.push("unknown[]");
    } else {
      const elementType = inferTypeForParam(allElements, pretty, indentLevel);
      resultTypes.push(`${elementType}[]`);
    }
  }

  // Merge object shapes into a single type with optional properties
  if (objectValues.length > 0) {
    const mergedObjectType = mergeObjectShapes(
      objectValues,
      pretty,
      indentLevel
    );
    resultTypes.push(mergedObjectType);
  }

  if (resultTypes.length === 0) {
    return "unknown";
  }
  if (resultTypes.length === 1) {
    return resultTypes[0];
  }
  return resultTypes.join(" | ");
}

/**
 * Merge multiple object observations into a single type with optional properties
 * Properties that appear in all objects are required, others are optional
 */
function mergeObjectShapes(
  objects: Record<string, unknown>[],
  pretty = false,
  indentLevel = 0
): string {
  if (objects.length === 0) {
    return "{}";
  }

  // Track which keys appear in which objects and collect all values per key
  const keyOccurrences = new Map<string, number>();
  const keyValues = new Map<string, unknown[]>();

  for (const obj of objects) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        keyOccurrences.set(key, (keyOccurrences.get(key) || 0) + 1);
        if (!keyValues.has(key)) {
          keyValues.set(key, []);
        }
        keyValues.get(key)!.push(obj[key]);
      }
    }
  }

  const totalObjects = objects.length;
  const props: string[] = [];

  // Sort keys for consistent output
  const sortedKeys = Array.from(keyValues.keys()).sort();

  const indent = pretty ? "  ".repeat(indentLevel + 1) : "";
  const closingIndent = pretty ? "  ".repeat(indentLevel) : "";

  for (const key of sortedKeys) {
    const safeKey = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(key)
      ? key
      : JSON.stringify(key);
    const occurrences = keyOccurrences.get(key) || 0;
    const values = keyValues.get(key) || [];
    const inferredType = inferTypeForParam(values, pretty, indentLevel + 1);

    // Property is optional if it doesn't appear in all objects
    const isOptional = occurrences < totalObjects;
    const optionalMarker = isOptional ? "?" : "";

    props.push(`${indent}${safeKey}${optionalMarker}: ${inferredType}`);
  }

  if (props.length === 0) {
    return "{}";
  }

  if (pretty) {
    return `{\n${props.join(";\n")};\n${closingIndent}}`;
  }
  return `{ ${props.join("; ")} }`;
}

/**
 * Generate TypeScript type definitions from the type cache
 */
export function generateTypeDefinitions(cache: TypeCache): string {
  const lines: string[] = [
    "// Auto-generated type definitions from runtime data",
    "// Generated by AutoTypeScript",
    "",
  ];

  for (const funcName in cache) {
    if (!Object.prototype.hasOwnProperty.call(cache, funcName)) {
      continue;
    }

    const funcData = cache[funcName];
    const paramNames = funcData.paramNames || [];
    const paramTypes: string[] = [];

    let maxParamsToDisplay = paramNames.length;
    if (funcData.paramData) {
      const observedParamIndices = Object.keys(funcData.paramData).map(Number);
      if (observedParamIndices.length > 0) {
        maxParamsToDisplay = Math.max(
          maxParamsToDisplay,
          Math.max(...observedParamIndices) + 1
        );
      }
    }

    for (let i = 0; i < maxParamsToDisplay; i++) {
      const paramName = paramNames[i] || `arg${i}`;
      const observedValues =
        funcData.paramData && funcData.paramData[i]
          ? funcData.paramData[i]
          : [];
      const inferredParamType = inferTypeForParam(observedValues);
      // Handle rest parameters
      if (paramName.startsWith("...")) {
        const restName = paramName.substring(3);
        paramTypes.push(`...${restName}: ${inferredParamType}`);
      } else {
        paramTypes.push(`${paramName}: ${inferredParamType}`);
      }
    }

    lines.push(
      `declare function ${funcName}(${paramTypes.join(", ")}): unknown;`
    );
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate TypeScript interface definitions from object types in the cache
 */
export function extractInterfacesFromCache(cache: TypeCache): string {
  const interfaces: Map<string, string> = new Map();
  const lines: string[] = [];

  // Extract unique object shapes from parameter data
  for (const funcName in cache) {
    if (!Object.prototype.hasOwnProperty.call(cache, funcName)) {
      continue;
    }

    const funcData = cache[funcName];
    const paramNames = funcData.paramNames || [];

    for (let i = 0; i < paramNames.length; i++) {
      const paramName = paramNames[i];
      const values = funcData.paramData?.[i] || [];

      for (const value of values) {
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          const interfaceName = `I${capitalize(funcName)}${capitalize(
            paramName
          )}`;
          const shape = generateInterfaceShape(
            value as Record<string, unknown>
          );
          if (shape && !interfaces.has(interfaceName)) {
            interfaces.set(interfaceName, shape);
          }
        }
      }
    }
  }

  for (const [name, shape] of interfaces) {
    lines.push(`interface ${name} ${shape}`);
    lines.push("");
  }

  return lines.join("\n");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateInterfaceShape(obj: Record<string, unknown>): string {
  const props: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const safeKey = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(key)
        ? key
        : JSON.stringify(key);
      const type = inferSingleValueType(obj[key]);
      props.push(`  ${safeKey}: ${type};`);
    }
  }
  if (props.length === 0) {
    return "{}";
  }
  return `{\n${props.join("\n")}\n}`;
}
