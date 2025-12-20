/**
 * Sample TypeScript API functions for demonstrating AutoTypeScript type inference
 * These functions intentionally have no type annotations to test the extension.
 */

/**
 * Simulates an API request handler
 */
export function handleRequest(method, path, body, headers) {
  const response = {
    status: 200,
    data: null as any,
    headers: {} as Record<string, string>,
  };

  if (!headers || !headers.authorization) {
    response.status = 401;
    response.data = { error: "Unauthorized" };
    return response;
  }

  if (method === "GET") {
    response.data = { message: `Fetched data from ${path}` };
  } else if (method === "POST") {
    response.data = { message: "Created", received: body };
  } else if (method === "PUT") {
    response.data = { message: "Updated", received: body };
  } else if (method === "DELETE") {
    response.data = { message: `Deleted resource at ${path}` };
  }

  return response;
}

/**
 * Validates request body
 */
export function validateBody(body, schema) {
  const errors: { field: string; message: string }[] = [];

  for (const field of schema.required || []) {
    if (body[field] === undefined) {
      errors.push({ field, message: `${field} is required` });
    }
  }

  for (const [field, rules] of Object.entries(schema.fields || {})) {
    const value = body[field];
    const typedRules = rules as { type?: string; minLength?: number; max?: number };
    if (value !== undefined) {
      if (typedRules.type && typeof value !== typedRules.type) {
        errors.push({
          field,
          message: `${field} must be of type ${typedRules.type}`,
        });
      }
      if (typedRules.minLength && (value as string).length < typedRules.minLength) {
        errors.push({
          field,
          message: `${field} must be at least ${typedRules.minLength} characters`,
        });
      }
      if (typedRules.max && (value as number) > typedRules.max) {
        errors.push({
          field,
          message: `${field} must be at most ${typedRules.max}`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Transforms API response
 */
export function transformResponse(data, format) {
  if (format === "minimal") {
    return { id: data.id, name: data.name };
  }
  if (format === "extended") {
    return {
      ...data,
      metadata: {
        transformedAt: new Date().toISOString(),
        format,
      },
    };
  }
  return data;
}

/**
 * Paginates results
 */
export function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    data: items.slice(start, end),
    pagination: {
      page,
      pageSize,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / pageSize),
      hasNext: end < items.length,
      hasPrev: page > 1,
    },
  };
}
