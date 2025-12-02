/**
 * Sample API functions for demonstrating AutoTypeScript type inference
 */

/**
 * Simulates an API request handler
 */
function handleRequest(method, path, body, headers) {
  const response = {
    status: 200,
    data: null,
    headers: {},
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
function validateBody(body, schema) {
  const errors = [];

  for (const field of schema.required || []) {
    if (body[field] === undefined) {
      errors.push({ field, message: `${field} is required` });
    }
  }

  for (const [field, rules] of Object.entries(schema.fields || {})) {
    const value = body[field];
    if (value !== undefined) {
      if (rules.type && typeof value !== rules.type) {
        errors.push({
          field,
          message: `${field} must be of type ${rules.type}`,
        });
      }
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field,
          message: `${field} must be at least ${rules.minLength} characters`,
        });
      }
      if (rules.max && value > rules.max) {
        errors.push({
          field,
          message: `${field} must be at most ${rules.max}`,
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
function transformResponse(data, format) {
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
function paginate(items, page, pageSize) {
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

module.exports = {
  handleRequest,
  validateBody,
  transformResponse,
  paginate,
};
