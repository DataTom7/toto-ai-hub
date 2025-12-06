import { Cache, createCache, generateCacheKey } from '../cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = createCache<string>(1000, 5, 'test'); // 1 second TTL, max 5 entries
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL

      expect(cache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should allow custom TTL per entry', () => {
      cache.set('key1', 'value1', 100); // 100ms
      cache.set('key2', 'value2', 500); // 500ms

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', async () => {
      cache.set('key1', 'value1', 100);

      expect(cache.has('key1')).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove entries', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');

      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should reset stats', () => {
      cache.get('key1'); // miss
      cache.set('key1', 'value1');
      cache.get('key1'); // hit

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when max size reached', async () => {
      // Fill cache to max (5) with small delays to ensure different timestamps
      cache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key3', 'value3');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key4', 'value4');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key5', 'value5');

      // Access key1, key2, key3 to make them recently used
      cache.get('key1');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.get('key2');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.get('key3');

      // Add 6th entry - should evict key4 (oldest unused)
      cache.set('key6', 'value6');

      expect(cache.get('key1')).toBe('value1'); // Still there (recently used)
      expect(cache.get('key2')).toBe('value2'); // Still there (recently used)
      expect(cache.get('key3')).toBe('value3'); // Still there (recently used)
      expect(cache.get('key4')).toBeUndefined(); // Evicted (oldest unused)
      expect(cache.get('key5')).toBe('value5'); // Still there
      expect(cache.get('key6')).toBe('value6'); // New entry
    });
  });

  describe('getStats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key1'); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.67%');
    });

    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate deterministic keys', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { b: 2, a: 1 }; // Different order

    expect(generateCacheKey(obj1)).toBe(generateCacheKey(obj2));
  });

  it('should handle nested objects', () => {
    const obj = { a: 1, b: { c: 3 } };
    const key = generateCacheKey(obj);

    expect(key).toContain('a:1');
    expect(key).toContain('b:');
  });

  it('should handle arrays', () => {
    const obj = { items: [1, 2, 3] };
    const key = generateCacheKey(obj);

    expect(key).toContain('[1,2,3]');
  });
});

