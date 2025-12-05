/**
 * Amount Detection Utility
 *
 * Centralized logic for detecting donation amounts in messages
 * and conversation history.
 */

import type { ConversationMemory } from '../types';

/**
 * Regular expressions for amount detection
 */
const AMOUNT_PATTERNS = {
  /** Matches: $500, $1000, $5.000 */
  currency: /\$\d+/,

  /** Matches: 500 pesos, 1000 ARS */
  pesosArs: /\d+\s*(pesos|ars)/i,

  /** Matches: any number with 3 or more digits (500, 1000, etc.) */
  threeOrMoreDigits: /\d{3,}/,
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
 * @param text - The text to extract from
 * @returns The extracted amount or null if none found
 *
 * @example
 * extractAmount('Quiero donar $1000') // 1000
 * extractAmount('Quiero donar 500 pesos') // 500
 * extractAmount('Quiero donar') // null
 */
export function extractAmount(text: string): number | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Try to match currency format first ($1000)
  const currencyMatch = text.match(/\$(\d+(?:[.,]\d+)?)/);
  if (currencyMatch) {
    const amount = currencyMatch[1].replace(/[.,]/g, '');
    return parseInt(amount, 10);
  }

  // Try to match pesos/ARS format (500 pesos)
  const pesosMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(pesos|ars)/i);
  if (pesosMatch) {
    const amount = pesosMatch[1].replace(/[.,]/g, '');
    return parseInt(amount, 10);
  }

  // Try to match any 3+ digit number
  const digitMatch = text.match(/\d{3,}/);
  if (digitMatch) {
    return parseInt(digitMatch[0], 10);
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
