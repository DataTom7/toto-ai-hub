import { getTRFAlias, isValidBankingAlias } from '../banking.config';

describe('banking.config', () => {
  describe('getTRFAlias', () => {
    it('should return TRF alias', () => {
      const alias = getTRFAlias();
      expect(alias).toBe('toto.fondo.rescate');
      expect(typeof alias).toBe('string');
    });
  });

  describe('isValidBankingAlias', () => {
    it('should validate correct aliases', () => {
      expect(isValidBankingAlias('toto.fondo.rescate')).toBe(true);
      expect(isValidBankingAlias('guardian.alias')).toBe(true);
      expect(isValidBankingAlias('test123')).toBe(true);
    });

    it('should reject aliases with uppercase', () => {
      expect(isValidBankingAlias('Toto.Alias')).toBe(false);
      expect(isValidBankingAlias('TOTO')).toBe(false);
    });

    it('should reject aliases with special characters', () => {
      expect(isValidBankingAlias('toto@alias')).toBe(false);
      expect(isValidBankingAlias('toto alias')).toBe(false);
      expect(isValidBankingAlias('toto_alias')).toBe(false);
    });

    it('should reject aliases that are too short', () => {
      expect(isValidBankingAlias('to')).toBe(false);
      expect(isValidBankingAlias('a')).toBe(false);
    });

    it('should reject aliases that are too long', () => {
      const longAlias = 'a'.repeat(51);
      expect(isValidBankingAlias(longAlias)).toBe(false);
    });

    it('should handle empty/invalid input', () => {
      expect(isValidBankingAlias('')).toBe(false);
      expect(isValidBankingAlias(null as any)).toBe(false);
      expect(isValidBankingAlias(undefined as any)).toBe(false);
    });
  });
});



