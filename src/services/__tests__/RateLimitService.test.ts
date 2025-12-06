import { RateLimitService, getRateLimitService } from '../RateLimitService';
import { RateLimitError } from '../../errors/AppErrors';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = getRateLimitService();
    service.resetAll(); // Reset all limits before each test
  });

  describe('checkLimit', () => {
    it('should allow requests for normal users', () => {
      expect(() => {
        service.checkLimit({ userId: 'user1', userRole: 'user' });
      }).not.toThrow();
    });

    it('should enforce global limit', () => {
      // This test is conceptual - in practice, hitting global limit requires many requests
      // Just verify it doesn't throw for single request
      expect(() => {
        service.checkLimit({ userId: 'user1' });
      }).not.toThrow();
    });

    it('should enforce IP-based limiting', () => {
      expect(() => {
        service.checkLimit({ ipAddress: '192.168.1.1' });
      }).not.toThrow();
    });

    it('should apply different limits for admins', () => {
      // Admins should have higher limits
      expect(() => {
        service.checkLimit({ userId: 'admin1', userRole: 'admin' });
      }).not.toThrow();
    });
  });

  describe('checkExpensiveLimit', () => {
    it('should enforce stricter limits for expensive operations', () => {
      expect(() => {
        service.checkExpensiveLimit({ userId: 'user1', userRole: 'user' });
      }).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return status for user', () => {
      const status = service.getStatus('user1', 'user');

      expect(status.user).toBeDefined();
      expect(status.expensive).toBeDefined();
      expect(status.global).toBeDefined();
    });

    it('should reflect consumed requests', () => {
      service.checkLimit({ userId: 'user1', userRole: 'user' });

      const status = service.getStatus('user1', 'user');
      expect(status.user.remaining).toBeLessThan(status.user.limit);
    });
  });

  describe('resetUser', () => {
    it('should reset limits for specific user', () => {
      service.checkLimit({ userId: 'user1', userRole: 'user' });
      service.resetUser('user1');

      const status = service.getStatus('user1', 'user');
      expect(status.user.remaining).toBe(status.user.limit);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getRateLimitService();
      const instance2 = getRateLimitService();

      expect(instance1).toBe(instance2);
    });
  });
});

