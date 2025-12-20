import { expect } from 'chai';
import {
  handleRequest,
  validateBody,
  transformResponse,
  paginate,
} from '../src/api';

describe('API', () => {
  describe('handleRequest', () => {
    it('should return 401 for unauthorized requests', () => {
      const result = handleRequest('GET', '/api/users', null, {});
      expect(result.status).to.equal(401);
    });

    it('should handle GET requests', () => {
      const result = handleRequest('GET', '/api/users', null, { authorization: 'Bearer token' });
      expect(result.status).to.equal(200);
      expect(result.data.message).to.include('Fetched data');
    });

    it('should handle POST requests', () => {
      const body = { name: 'Test', value: 123 };
      const result = handleRequest('POST', '/api/items', body, { authorization: 'Bearer token' });
      expect(result.status).to.equal(200);
      expect(result.data.message).to.equal('Created');
      expect(result.data.received).to.deep.equal(body);
    });

    it('should handle PUT requests', () => {
      const body = { id: 1, name: 'Updated' };
      const result = handleRequest('PUT', '/api/items/1', body, { authorization: 'Bearer token' });
      expect(result.status).to.equal(200);
      expect(result.data.message).to.equal('Updated');
    });

    it('should handle DELETE requests', () => {
      const result = handleRequest('DELETE', '/api/items/1', null, { authorization: 'Bearer token' });
      expect(result.status).to.equal(200);
      expect(result.data.message).to.include('Deleted');
    });
  });

  describe('validateBody', () => {
    it('should validate required fields', () => {
      const body = { name: 'Test' };
      const schema = {
        required: ['name', 'email'],
        fields: {},
      };
      const result = validateBody(body, schema);
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0].field).to.equal('email');
    });

    it('should validate field types', () => {
      const body = { name: 123 };
      const schema = {
        required: [],
        fields: {
          name: { type: 'string' },
        },
      };
      const result = validateBody(body, schema);
      expect(result.valid).to.be.false;
      expect(result.errors[0].message).to.include('type');
    });

    it('should validate minLength', () => {
      const body = { password: 'abc' };
      const schema = {
        required: [],
        fields: {
          password: { minLength: 8 },
        },
      };
      const result = validateBody(body, schema);
      expect(result.valid).to.be.false;
      expect(result.errors[0].message).to.include('at least 8');
    });

    it('should pass valid data', () => {
      const body = { name: 'John', email: 'john@test.com', age: 25 };
      const schema = {
        required: ['name', 'email'],
        fields: {
          name: { type: 'string' },
          age: { max: 100 },
        },
      };
      const result = validateBody(body, schema);
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });
  });

  describe('transformResponse', () => {
    const data = { id: 1, name: 'Item', description: 'Test item', price: 100 };

    it('should return minimal format', () => {
      const result = transformResponse(data, 'minimal');
      expect(result).to.have.keys(['id', 'name']);
    });

    it('should return extended format with metadata', () => {
      const result = transformResponse(data, 'extended');
      expect(result.metadata).to.exist;
      expect(result.metadata.format).to.equal('extended');
    });

    it('should return original data for unknown format', () => {
      const result = transformResponse(data, 'full');
      expect(result).to.deep.equal(data);
    });
  });

  describe('paginate', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

    it('should paginate first page', () => {
      const result = paginate(items, 1, 10);
      expect(result.data).to.have.lengthOf(10);
      expect(result.pagination.page).to.equal(1);
      expect(result.pagination.hasNext).to.be.true;
      expect(result.pagination.hasPrev).to.be.false;
    });

    it('should paginate middle page', () => {
      const result = paginate(items, 2, 10);
      expect(result.data).to.have.lengthOf(10);
      expect(result.pagination.hasNext).to.be.true;
      expect(result.pagination.hasPrev).to.be.true;
    });

    it('should paginate last page', () => {
      const result = paginate(items, 3, 10);
      expect(result.data).to.have.lengthOf(5);
      expect(result.pagination.hasNext).to.be.false;
      expect(result.pagination.hasPrev).to.be.true;
    });

    it('should calculate correct total pages', () => {
      const result = paginate(items, 1, 10);
      expect(result.pagination.totalPages).to.equal(3);
      expect(result.pagination.totalItems).to.equal(25);
    });
  });
});
