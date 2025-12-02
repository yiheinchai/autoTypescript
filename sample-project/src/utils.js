/**
 * Sample utility functions for demonstrating AutoTypeScript type inference
 */

/**
 * Greets a user with optional formal style
 */
function greet(name, age, options) {
  if (options && options.formal) {
    const title = options.title || "";
    return `Good day, ${title} ${name}. You are ${age} years old.`;
  }
  return `Hey ${name}! You're ${age}!`;
}

/**
 * Calculates the total price with optional discount
 */
function calculateTotal(items, discount) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  if (discount) {
    return subtotal * (1 - discount);
  }
  return subtotal;
}

/**
 * Formats user data for display
 */
function formatUser(user) {
  return {
    displayName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    age: user.age,
    isActive: user.active !== false,
  };
}

/**
 * Processes an array of numbers
 */
function processNumbers(numbers, operation) {
  switch (operation) {
    case "sum":
      return numbers.reduce((a, b) => a + b, 0);
    case "avg":
      return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    case "max":
      return Math.max(...numbers);
    case "min":
      return Math.min(...numbers);
    default:
      return numbers;
  }
}

/**
 * Creates a new task object
 */
function createTask(title, priority, assignee) {
  return {
    id: Math.random().toString(36).substr(2, 9),
    title,
    priority: priority || "medium",
    assignee: assignee || null,
    createdAt: new Date().toISOString(),
    completed: false,
  };
}

/**
 * Filters items based on criteria
 */
function filterItems(items, criteria) {
  return items.filter((item) => {
    if (criteria.minPrice !== undefined && item.price < criteria.minPrice) {
      return false;
    }
    if (criteria.maxPrice !== undefined && item.price > criteria.maxPrice) {
      return false;
    }
    if (criteria.category && item.category !== criteria.category) {
      return false;
    }
    if (criteria.inStock !== undefined && item.inStock !== criteria.inStock) {
      return false;
    }
    return true;
  });
}

/**
 * Merges configuration objects
 */
function mergeConfig(defaults, overrides) {
  return { ...defaults, ...overrides };
}

module.exports = {
  greet,
  calculateTotal,
  formatUser,
  processNumbers,
  createTask,
  filterItems,
  mergeConfig,
};
