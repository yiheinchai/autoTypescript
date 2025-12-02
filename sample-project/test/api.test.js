/**
 * Tests for API functions
 */

const assert = require("assert");
const {
  handleRequest,
  validateBody,
  transformResponse,
  paginate,
} = require("../src/api");

describe("API", function () {
  describe("handleRequest", function () {
    it("should handle GET request", function () {
      const result = handleRequest("GET", "/users", null, {
        authorization: "Bearer token123",
      });
      assert.strictEqual(result.status, 200);
      assert.ok(result.data.message.includes("/users"));
    });

    it("should handle POST request with body", function () {
      const body = { name: "New User", email: "new@test.com" };
      const result = handleRequest("POST", "/users", body, {
        authorization: "Bearer abc",
        "content-type": "application/json",
      });
      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.data.received, body);
    });

    it("should handle PUT request", function () {
      const body = { name: "Updated Name" };
      const result = handleRequest("PUT", "/users/123", body, {
        authorization: "Bearer xyz",
      });
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.data.message, "Updated");
    });

    it("should handle DELETE request", function () {
      const result = handleRequest("DELETE", "/users/456", null, {
        authorization: "Bearer del",
      });
      assert.strictEqual(result.status, 200);
      assert.ok(result.data.message.includes("Deleted"));
    });

    it("should reject unauthorized request", function () {
      const result = handleRequest("GET", "/secret", null, {});
      assert.strictEqual(result.status, 401);
    });

    it("should reject request without headers", function () {
      const result = handleRequest("GET", "/data", null);
      assert.strictEqual(result.status, 401);
    });
  });

  describe("validateBody", function () {
    it("should validate required fields", function () {
      const body = { email: "test@example.com" };
      const schema = {
        required: ["name", "email"],
        fields: {},
      };
      const result = validateBody(body, schema);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].field, "name");
    });

    it("should validate field types", function () {
      const body = { name: "Test", age: "25" };
      const schema = {
        required: ["name"],
        fields: {
          age: { type: "number" },
        },
      };
      const result = validateBody(body, schema);
      assert.strictEqual(result.valid, false);
    });

    it("should validate min length", function () {
      const body = { password: "abc" };
      const schema = {
        fields: {
          password: { type: "string", minLength: 8 },
        },
      };
      const result = validateBody(body, schema);
      assert.strictEqual(result.valid, false);
    });

    it("should pass valid body", function () {
      const body = {
        name: "Valid User",
        email: "valid@test.com",
        age: 30,
      };
      const schema = {
        required: ["name", "email"],
        fields: {
          name: { type: "string", minLength: 2 },
          age: { type: "number", max: 120 },
        },
      };
      const result = validateBody(body, schema);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe("transformResponse", function () {
    const data = {
      id: 1,
      name: "Test Item",
      description: "A test item",
      price: 99.99,
      stock: 10,
    };

    it("should return minimal format", function () {
      const result = transformResponse(data, "minimal");
      assert.deepStrictEqual(Object.keys(result), ["id", "name"]);
    });

    it("should return extended format", function () {
      const result = transformResponse(data, "extended");
      assert.ok(result.metadata);
      assert.strictEqual(result.metadata.format, "extended");
    });

    it("should return original for unknown format", function () {
      const result = transformResponse(data, "unknown");
      assert.deepStrictEqual(result, data);
    });

    it("should return original when no format specified", function () {
      const result = transformResponse(data);
      assert.deepStrictEqual(result, data);
    });
  });

  describe("paginate", function () {
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
    }));

    it("should paginate first page", function () {
      const result = paginate(items, 1, 10);
      assert.strictEqual(result.data.length, 10);
      assert.strictEqual(result.pagination.page, 1);
      assert.strictEqual(result.pagination.totalPages, 3);
      assert.strictEqual(result.pagination.hasNext, true);
      assert.strictEqual(result.pagination.hasPrev, false);
    });

    it("should paginate middle page", function () {
      const result = paginate(items, 2, 10);
      assert.strictEqual(result.data.length, 10);
      assert.strictEqual(result.pagination.hasNext, true);
      assert.strictEqual(result.pagination.hasPrev, true);
    });

    it("should paginate last page", function () {
      const result = paginate(items, 3, 10);
      assert.strictEqual(result.data.length, 5);
      assert.strictEqual(result.pagination.hasNext, false);
      assert.strictEqual(result.pagination.hasPrev, true);
    });

    it("should handle small page size", function () {
      const result = paginate(items, 1, 5);
      assert.strictEqual(result.data.length, 5);
      assert.strictEqual(result.pagination.totalPages, 5);
    });

    it("should handle page size larger than items", function () {
      const result = paginate(items, 1, 50);
      assert.strictEqual(result.data.length, 25);
      assert.strictEqual(result.pagination.totalPages, 1);
      assert.strictEqual(result.pagination.hasNext, false);
    });
  });
});
