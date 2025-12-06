/**
 * Amount Detection Utility
 *
 * Centralized logic for detecting donation amounts in messages
 * and conversation history.
 */

import type { ConversationMemory } from '../types';

/**
 * Regular expressions for amount detection
 *
 * Supports all format variations from golden conversations:
 * - Currency: $1000, $1.000, $1,000, $ 1000
 * - Pesos/ARS: 500 pesos, 1.000 ARS
 * - Plain numbers: 1000, 100
 */
const AMOUNT_PATTERNS = {
  /** Matches: $500, $1000, $5.000, $1,000, $ 1000 (with/without thousands separators and optional space) */
  currency: /\$\s*\d+/,

  /** Matches: 500 pesos, 1000 ARS, 1.000 pesos */
  pesosArs: /\d+(?:[.,]\d{3})*\s*(pesos|ars)/i,

  /** Matches: any number with 2 or more digits (for "Otro monto" inputs like "50", "100") */
  twoOrMoreDigits: /\b\d{2,}\b/,
} as const;

/**
 * Check if a text contains a donation amount
 *
 * @param text - The text to check
 * @returns True if the text contains an amount pattern
 *
 * @example
 * hasAmount('Quiero donar $1000') // true
 * hasAmount('Quiero donar 500 pesos') // true
 * hasAmount('Quiero donar') // false
 */
export function hasAmount(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  return Object.values(AMOUNT_PATTERNS).some(pattern => pattern.test(text));
}

/**
 * Check if conversation history contains an amount
 *
 * @param memory - The conversation memory to check
 * @returns True if any user message in history contains an amount
 *
 * @example
 * hasAmountInHistory(memory) // true if user said "$1000" at any point
 */
export function hasAmountInHistory(memory: ConversationMemory): boolean {
  if (!memory || !memory.conversationHistory) {
    return false;
  }

  return memory.conversationHistory.some((entry: any) => {
    return entry.user && hasAmount(entry.user);
  });
}

/**
 * Extract the numerical amount from text
 *
 * Supports all format variations found in golden conversations:
 * - $1000, $1.000 (Argentine), $1,000 (US), $ 1000 (with space)
 * - 500 pesos, 1000 ARS
 * - Just numbers: 1000, 100
 *
 * @param text - The text to extract from
 * @returns The extracted amount or null if none found
 *
 * @example
 * extractAmount('Quiero donar $1000') // 1000
 * extractAmount('Quiero donar $1.000') // 1000 (Argentine format)
 * extractAmount('Quiero donar $1,000') // 1000 (US format)
 * extractAmount('Quiero donar $ 1000') // 1000 (space after $)
 * extractAmount('Quiero donar 500 pesos') // 500
 * extractAmount('100') // 100 (from "Otro monto" input)
 * extractAmount('Quiero donar') // null
 */
export function extractAmount(text: string): number | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Pattern 1: Currency format with optional thousands separators and optional space after $
  // Matches: $1000, $1.000, $1,000, $ 1000, $ 1.000, etc.
  const currencyMatch = text.match(/\$\s*(\d{1,}(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
  if (currencyMatch) {
    // Remove thousands separators (dots or commas) but preserve decimal point
    let amount = currencyMatch[1];

    // Check if there's a decimal part (last separator followed by exactly 2 digits)
    const hasDecimal = /[.,]\d{2}$/.test(amount);

    if (hasDecimal) {
      // Has decimal: remove all separators except the last one, then convert to dot
      amount = amount.replace(/[.,](?=.*[.,])/g, '').replace(',', '.');
    } else {
      // No decimal: remove all separators (they're thousands separators)
      amount = amount.replace(/[.,]/g, '');
    }

    return Math.floor(parseFloat(amount));
  }

  // Pattern 2: Pesos/ARS format with optional thousands separators
  // Matches: 500 pesos, 1.000 pesos, 1,000 ARS
  const pesosMatch = text.match(/(\d{1,}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(pesos|ars)/i);
  if (pesosMatch) {
    let amount = pesosMatch[1];

    // Check if there's a decimal part
    const hasDecimal = /[.,]\d{2}$/.test(amount);

    if (hasDecimal) {
      amount = amount.replace(/[.,](?=.*[.,])/g, '').replace(',', '.');
    } else {
      amount = amount.replace(/[.,]/g, '');
    }

    return Math.floor(parseFloat(amount));
  }

  // Pattern 3: Just a number (3+ digits) - from "Otro monto" input or amount-only messages
  // Matches: 1000, 100, 5000
  const digitMatch = text.match(/\b(\d{3,})\b/);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }

  // Pattern 4: Small amounts (2 digits) if preceded by donation keywords
  // Matches: "donar 50", "donate 75" (edge case for very small donations)
  if (/\b(donar|donate|donation|donación)\b/i.test(text)) {
    const smallAmountMatch = text.match(/\b(\d{2,})\b/);
    if (smallAmountMatch) {
      return parseInt(smallAmountMatch[1], 10);
    }
  }

  return null;
}

/**
 * Format an amount for display
 *
 * @param amount - The amount to format
 * @param currency - The currency symbol (default: '$')
 * @returns Formatted amount string
 *
 * @example
 * formatAmount(1000) // '$1.000'
 * formatAmount(500) // '$500'
 */
export function formatAmount(amount: number, currency: string = '$'): string {
  if (!amount || typeof amount !== 'number' || !isFinite(amount)) {
    return `${currency}0`;
  }

  // Use Argentine/Spanish formatting (dots as thousands separator)
  const formatted = amount.toLocaleString('es-AR');
  return `${currency}${formatted}`;
}

/**
 * Validate that an amount is reasonable for donations
 *
 * @param amount - The amount to validate
 * @returns Validation result with error message if invalid
 */
export function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (!amount || typeof amount !== 'number' || !isFinite(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (amount < 0) {
    return { valid: false, error: 'Amount cannot be negative' };
  }

  if (amount === 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  // Optional: set a maximum reasonable amount (e.g., 10 million ARS)
  const MAX_AMOUNT = 10_000_000;
  if (amount > MAX_AMOUNT) {
    return { valid: false, error: `Amount cannot exceed ${formatAmount(MAX_AMOUNT)}` };
  }

  return { valid: true };
}
