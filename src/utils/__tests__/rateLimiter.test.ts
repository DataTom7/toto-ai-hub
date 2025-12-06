import { RateLimiter, createRateLimiter } from '../rateLimiter';
import { RateLimitError } from '../../errors/AppErrors';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = createRateLimiter(5, 1000); // 5 requests per second
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const result1 = limiter.checkLimit('user1');
      const result2 = limiter.checkLimit('user1');
      const result3 = limiter.checkLimit('user1');

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(2);
    });

    it('should block requests exceeding limit', () => {
      // Consume all 5 tokens
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('user1');
      }

      // 6th request should be blocked
      const result = limiter.checkLimit('user1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should track different users separately', () => {
      limiter.checkLimit('user1');
      limiter.checkLimit('user1');

      const user1Result = limiter.checkLimit('user1');
      const user2Result = limiter.checkLimit('user2');

      expect(user1Result.remaining).toBe(2);
      expect(user2Result.remaining).toBe(4);
    });

    it('should reset after window expires', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('user1');
      }

      // Should be blocked
      let result = limiter.checkLimit('user1');
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      result = limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('enforceLimit', () => {
    it('should not throw when within limit', () => {
      expect(() => limiter.enforceLimit('user1')).not.toThrow();
    });

    it('should throw RateLimitError when limit exceeded', () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        limiter.enforceLimit('user1');
      }

      // Should throw on next request
      expect(() => limiter.enforceLimit('user1')).toThrow(RateLimitError);
    });

    it('should include retry info in error', () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        limiter.enforceLimit('user1');
      }

      try {
        limiter.enforceLimit('user1');
        fail('Should have thrown RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.limit).toBe(5);
          expect(error.retryAfterMs).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getStatus', () => {
    it('should return status without consuming tokens', () => {
      const status1 = limiter.getStatus('user1');
      const status2 = limiter.getStatus('user1');

      expect(status1.remaining).toBe(5);
      expect(status2.remaining).toBe(5);
    });

    it('should reflect consumed tokens', () => {
      limiter.checkLimit('user1');
      limiter.checkLimit('user1');

      const status = limiter.getStatus('user1');
      expect(status.remaining).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset limit for specific user', () => {
      // Consume tokens
      limiter.checkLimit('user1');
      limiter.checkLimit('user1');

      // Reset
      limiter.reset('user1');

      // Should have full tokens again
      const result = limiter.checkLimit('user1');
      expect(result.remaining).toBe(4);
    });

    it('should not affect other users', () => {
      limiter.checkLimit('user1');
      limiter.checkLimit('user2');

      limiter.reset('user1');

      const status1 = limiter.getStatus('user1');
      const status2 = limiter.getStatus('user2');

      expect(status1.remaining).toBe(5);
      expect(status2.remaining).toBe(4);
    });
  });

  describe('resetAll', () => {
    it('should reset all limits', () => {
      limiter.checkLimit('user1');
      limiter.checkLimit('user2');
      limiter.checkLimit('user3');

      limiter.resetAll();

      expect(limiter.getStatus('user1').remaining).toBe(5);
      expect(limiter.getStatus('user2').remaining).toBe(5);
      expect(limiter.getStatus('user3').remaining).toBe(5);
    });
  });
});

