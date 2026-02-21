import { generateId, createShortId } from '../utils/id';

describe('id utilities', () => {
  describe('generateId', () => {
    it('should generate a UUID', () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^test-uuid-[a-z0-9]+$/); // matches our mock format
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createShortId', () => {
    it('should create a short ID from full ID', () => {
      const fullId = 'abcdefgh-1234-5678-9012-345678901234';
      const shortId = createShortId(fullId);
      expect(shortId).toBe('abcdefgh');
      expect(shortId.length).toBe(8);
    });

    it('should generate a new short ID when no ID provided', () => {
      const shortId = createShortId();
      expect(shortId).toBeDefined();
      expect(typeof shortId).toBe('string');
      expect(shortId.length).toBe(8);
    });

    it('should handle empty string', () => {
      const shortId = createShortId('');
      expect(shortId).toBeDefined();
      expect(shortId.length).toBe(8);
    });
  });
});