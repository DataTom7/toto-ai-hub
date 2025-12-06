/**
 * Tests for amount detection utility
 *
 * Validates all format variations found in golden conversations
 * Primary use case: Extracting amounts when user types after clicking "Otro monto" button
 */

import { extractAmount, hasAmount, formatAmount, validateAmount } from '../amountDetection';

describe('extractAmount - Custom Amount Input', () => {
  describe('Currency formats', () => {
    it('should extract from basic currency format', () => {
      expect(extractAmount('Quiero donar $1000')).toBe(1000);
      expect(extractAmount('$500')).toBe(500);
    });

    it('should extract from Argentine format with dots', () => {
      expect(extractAmount('Quiero donar $1.000')).toBe(1000);
      expect(extractAmount('$5.000')).toBe(5000);
      expect(extractAmount('$50.000')).toBe(50000);
    });

    it('should extract from US format with commas', () => {
      expect(extractAmount('Quiero donar $1,000')).toBe(1000);
      expect(extractAmount('$5,000')).toBe(5000);
      expect(extractAmount('$50,000')).toBe(50000);
    });

    it('should extract with space after dollar sign', () => {
      expect(extractAmount('Quiero donar $ 1000')).toBe(1000);
      expect(extractAmount('$ 500')).toBe(500);
      expect(extractAmount('$ 1.000')).toBe(1000);
    });
  });

  describe('Pesos/ARS formats', () => {
    it('should extract from pesos format', () => {
      expect(extractAmount('Quiero donar 500 pesos')).toBe(500);
      expect(extractAmount('1000 pesos')).toBe(1000);
    });

    it('should extract from ARS format', () => {
      expect(extractAmount('Quiero donar 1000 ARS')).toBe(1000);
      expect(extractAmount('500 ars')).toBe(500);
    });

    it('should extract from pesos with thousands separators', () => {
      expect(extractAmount('1.000 pesos')).toBe(1000);
      expect(extractAmount('5,000 pesos')).toBe(5000);
    });
  });

  describe('Plain number formats (from "Otro monto" text input)', () => {
    it('should extract from amount-only messages', () => {
      expect(extractAmount('1000')).toBe(1000);
      expect(extractAmount('500')).toBe(500);
      expect(extractAmount('100')).toBe(100);
    });

    it('should extract small amounts with donation keywords', () => {
      expect(extractAmount('donar 50')).toBe(50);
      expect(extractAmount('donate 75')).toBe(75);
    });

    it('should not extract unrelated 2-digit numbers', () => {
      expect(extractAmount('tengo 25 años')).toBeNull();
      expect(extractAmount('hace 15 días')).toBeNull();
    });
  });

  describe('Edge cases from golden conversations', () => {
    it('should handle very large amounts', () => {
      expect(extractAmount('Quiero donar $50.000')).toBe(50000);
      expect(extractAmount('$100,000')).toBe(100000);
    });

    it('should handle mixed separators', () => {
      expect(extractAmount('$3,000')).toBe(3000);
    });

    it('should return null for no amount', () => {
      expect(extractAmount('Quiero donar')).toBeNull();
      expect(extractAmount('Quiero ayudar')).toBeNull();
      expect(extractAmount('Gracias')).toBeNull();
    });

    it('should handle decimal amounts', () => {
      expect(extractAmount('$100.50')).toBe(100);
      expect(extractAmount('$1000,75')).toBe(1000);
    });
  });
});

describe('hasAmount', () => {
  it('should return true for messages with amounts', () => {
    expect(hasAmount('Quiero donar $1000')).toBe(true);
    expect(hasAmount('$1.000')).toBe(true);
    expect(hasAmount('500 pesos')).toBe(true);
    expect(hasAmount('1000')).toBe(true);
  });

  it('should return false for messages without amounts', () => {
    expect(hasAmount('Quiero donar')).toBe(false);
    expect(hasAmount('Ayudar')).toBe(false);
    expect(hasAmount('')).toBe(false);
  });
});

describe('formatAmount', () => {
  it('should format amounts in Argentine style', () => {
    expect(formatAmount(1000)).toBe('$1.000');
    expect(formatAmount(500)).toBe('$500');
    expect(formatAmount(50000)).toBe('$50.000');
  });

  it('should handle invalid amounts', () => {
    expect(formatAmount(0)).toBe('$0');
    expect(formatAmount(NaN)).toBe('$0');
  });
});

describe('validateAmount', () => {
  it('should validate reasonable amounts', () => {
    expect(validateAmount(100)).toEqual({ valid: true });
    expect(validateAmount(1000)).toEqual({ valid: true });
    expect(validateAmount(50000)).toEqual({ valid: true });
  });

  it('should reject invalid amounts', () => {
    expect(validateAmount(0).valid).toBe(false);
    expect(validateAmount(-100).valid).toBe(false);
    expect(validateAmount(NaN).valid).toBe(false);
  });

  it('should reject amounts over maximum', () => {
    expect(validateAmount(20000000).valid).toBe(false);
  });
});
