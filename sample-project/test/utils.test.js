/**
 * Tests for utility functions
 */

const assert = require("assert");
const {
  greet,
  calculateTotal,
  formatUser,
  processNumbers,
  createTask,
  filterItems,
  mergeConfig,
} = require("../src/utils");

describe("Utils", function () {
  describe("greet", function () {
    it("should greet informally by default", function () {
      const result = greet("Alice", 30);
      assert.ok(result.includes("Alice"));
      assert.ok(result.includes("30"));
    });

    it("should greet formally with options", function () {
      const result = greet("Bob", 45, { formal: true });
      assert.ok(result.includes("Good day"));
    });

    it("should include title when provided", function () {
      const result = greet("Smith", 50, { formal: true, title: "Dr." });
      assert.ok(result.includes("Dr."));
    });

    it("should handle young users", function () {
      const result = greet("Charlie", 12, { formal: false });
      assert.ok(result.includes("Charlie"));
    });
  });

  describe("calculateTotal", function () {
    it("should calculate total without discount", function () {
      const items = [
        { name: "Apple", price: 1.5, quantity: 3 },
        { name: "Banana", price: 0.75, quantity: 6 },
      ];
      const total = calculateTotal(items);
      assert.strictEqual(total, 9);
    });

    it("should apply discount", function () {
      const items = [
        { name: "Laptop", price: 1000, quantity: 1 },
        { name: "Mouse", price: 50, quantity: 2 },
      ];
      const total = calculateTotal(items, 0.1);
      assert.strictEqual(total, 990);
    });

    it("should handle empty cart", function () {
      const total = calculateTotal([]);
      assert.strictEqual(total, 0);
    });

    it("should handle single item", function () {
      const items = [{ name: "Book", price: 25.99, quantity: 1 }];
      const total = calculateTotal(items);
      assert.strictEqual(total, 25.99);
    });
  });

  describe("formatUser", function () {
    it("should format complete user", function () {
      const user = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        age: 28,
        active: true,
      };
      const formatted = formatUser(user);
      assert.strictEqual(formatted.displayName, "John Doe");
      assert.strictEqual(formatted.email, "john@example.com");
      assert.strictEqual(formatted.isActive, true);
    });

    it("should handle inactive user", function () {
      const user = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@test.org",
        age: 35,
        active: false,
      };
      const formatted = formatUser(user);
      assert.strictEqual(formatted.isActive, false);
    });

    it("should default to active", function () {
      const user = {
        firstName: "Bob",
        lastName: "Builder",
        email: "bob@build.com",
        age: 40,
      };
      const formatted = formatUser(user);
      assert.strictEqual(formatted.isActive, true);
    });
  });

  describe("processNumbers", function () {
    it("should calculate sum", function () {
      const result = processNumbers([1, 2, 3, 4, 5], "sum");
      assert.strictEqual(result, 15);
    });

    it("should calculate average", function () {
      const result = processNumbers([10, 20, 30], "avg");
      assert.strictEqual(result, 20);
    });

    it("should find max", function () {
      const result = processNumbers([5, 2, 9, 1, 7], "max");
      assert.strictEqual(result, 9);
    });

    it("should find min", function () {
      const result = processNumbers([5, 2, 9, 1, 7], "min");
      assert.strictEqual(result, 1);
    });

    it("should return original for unknown operation", function () {
      const nums = [1, 2, 3];
      const result = processNumbers(nums, "unknown");
      assert.deepStrictEqual(result, nums);
    });
  });

  describe("createTask", function () {
    it("should create task with defaults", function () {
      const task = createTask("Fix bug");
      assert.strictEqual(task.title, "Fix bug");
      assert.strictEqual(task.priority, "medium");
      assert.strictEqual(task.assignee, null);
      assert.ok(task.id);
    });

    it("should create high priority task", function () {
      const task = createTask("Deploy to prod", "high");
      assert.strictEqual(task.priority, "high");
    });

    it("should create task with assignee", function () {
      const task = createTask("Review PR", "low", "alice@company.com");
      assert.strictEqual(task.assignee, "alice@company.com");
    });
  });

  describe("filterItems", function () {
    const items = [
      { name: "Shirt", price: 25, category: "clothing", inStock: true },
      { name: "Pants", price: 50, category: "clothing", inStock: false },
      { name: "Phone", price: 500, category: "electronics", inStock: true },
      { name: "Tablet", price: 300, category: "electronics", inStock: true },
    ];

    it("should filter by min price", function () {
      const result = filterItems(items, { minPrice: 100 });
      assert.strictEqual(result.length, 2);
    });

    it("should filter by category", function () {
      const result = filterItems(items, { category: "clothing" });
      assert.strictEqual(result.length, 2);
    });

    it("should filter by in stock", function () {
      const result = filterItems(items, { inStock: true });
      assert.strictEqual(result.length, 3);
    });

    it("should combine filters", function () {
      const result = filterItems(items, {
        category: "electronics",
        maxPrice: 400,
        inStock: true,
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "Tablet");
    });
  });

  describe("mergeConfig", function () {
    it("should merge configs", function () {
      const defaults = { debug: false, timeout: 5000, retries: 3 };
      const overrides = { debug: true, timeout: 10000 };
      const result = mergeConfig(defaults, overrides);
      assert.strictEqual(result.debug, true);
      assert.strictEqual(result.timeout, 10000);
      assert.strictEqual(result.retries, 3);
    });

    it("should handle empty overrides", function () {
      const defaults = { host: "localhost", port: 3000 };
      const result = mergeConfig(defaults, {});
      assert.deepStrictEqual(result, defaults);
    });
  });
});
