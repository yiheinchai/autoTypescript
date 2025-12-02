import { expect } from 'chai';
import {
  greet,
  calculateTotal,
  formatUser,
  processNumbers,
  createTask,
  filterItems,
  mergeConfig,
} from '../src/utils';

describe('Utils', () => {
  describe('greet', () => {
    it('should greet informally by default', () => {
      const result = greet('Alice', 30, {});
      expect(result).to.include('Alice');
      expect(result).to.include('30');
    });

    it('should greet formally with options', () => {
      const result = greet('Bob', 25, { formal: true, title: 'Mr.' });
      expect(result).to.include('Good day');
      expect(result).to.include('Mr.');
      expect(result).to.include('Bob');
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total without discount', () => {
      const items = [
        { price: 10, quantity: 2 },
        { price: 5, quantity: 3 },
      ];
      const result = calculateTotal(items, undefined);
      expect(result).to.equal(35);
    });

    it('should apply discount', () => {
      const items = [{ price: 100, quantity: 1 }];
      const result = calculateTotal(items, 0.1);
      expect(result).to.equal(90);
    });
  });

  describe('formatUser', () => {
    it('should format user data', () => {
      const user = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        age: 35,
        active: true,
      };
      const result = formatUser(user);
      expect(result.displayName).to.equal('John Doe');
      expect(result.email).to.equal('john@example.com');
      expect(result.isActive).to.be.true;
    });
  });

  describe('processNumbers', () => {
    it('should sum numbers', () => {
      const result = processNumbers([1, 2, 3, 4, 5], 'sum');
      expect(result).to.equal(15);
    });

    it('should calculate average', () => {
      const result = processNumbers([10, 20, 30], 'avg');
      expect(result).to.equal(20);
    });

    it('should find max', () => {
      const result = processNumbers([5, 2, 8, 1, 9], 'max');
      expect(result).to.equal(9);
    });
  });

  describe('createTask', () => {
    it('should create task with defaults', () => {
      const result = createTask('Test task', undefined, undefined);
      expect(result.title).to.equal('Test task');
      expect(result.priority).to.equal('medium');
      expect(result.assignee).to.be.null;
    });

    it('should create task with custom values', () => {
      const result = createTask('Important task', 'high', 'Alice');
      expect(result.title).to.equal('Important task');
      expect(result.priority).to.equal('high');
      expect(result.assignee).to.equal('Alice');
    });
  });

  describe('filterItems', () => {
    const items = [
      { price: 10, category: 'books', inStock: true },
      { price: 25, category: 'electronics', inStock: false },
      { price: 50, category: 'electronics', inStock: true },
    ];

    it('should filter by minPrice', () => {
      const result = filterItems(items, { minPrice: 20 });
      expect(result).to.have.lengthOf(2);
    });

    it('should filter by category', () => {
      const result = filterItems(items, { category: 'electronics' });
      expect(result).to.have.lengthOf(2);
    });

    it('should filter by inStock', () => {
      const result = filterItems(items, { inStock: true });
      expect(result).to.have.lengthOf(2);
    });
  });

  describe('mergeConfig', () => {
    it('should merge configurations', () => {
      const defaults = { theme: 'light', debug: false };
      const overrides = { debug: true, newOption: 'value' };
      const result = mergeConfig(defaults, overrides);
      expect(result.theme).to.equal('light');
      expect(result.debug).to.be.true;
      expect(result.newOption).to.equal('value');
    });
  });
});
