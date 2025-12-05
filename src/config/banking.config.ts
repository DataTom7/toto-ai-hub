/**
 * Banking Configuration
 *
 * Centralized configuration for banking-related features including
 * TRF (Toto Rescue Fund) alias and validation rules.
 */

export interface BankingConfig {
  /**
   * TRF (Toto Rescue Fund) banking alias for alternative donations
   */
  trfBankingAlias: string;

  /**
   * Regular expression for validating banking alias format
   */
  guardianAliasFormat: RegExp;

  /**
   * Validates a banking alias
   */
  aliasValidation: (alias: string) => boolean;
}

/**
 * Banking configuration singleton
 *
 * TRF alias can be overridden via environment variable TRF_BANKING_ALIAS
 */
export const bankingConfig: BankingConfig = {
  trfBankingAlias: process.env.TRF_BANKING_ALIAS || 'toto.fondo.rescate',

  guardianAliasFormat: /^[a-z0-9.]+$/,

  aliasValidation: (alias: string): boolean => {
    if (!alias || typeof alias !== 'string') {
      return false;
    }

    const trimmed = alias.trim();
    if (trimmed.length < 3 || trimmed.length > 50) {
      return false;
    }

    return bankingConfig.guardianAliasFormat.test(trimmed);
  }
};

/**
 * Get TRF banking alias
 *
 * @returns The TRF banking alias for alternative donations
 */
export function getTRFAlias(): string {
  return bankingConfig.trfBankingAlias;
}

/**
 * Validate a banking alias
 *
 * @param alias - The alias to validate
 * @returns True if the alias is valid, false otherwise
 */
export function isValidBankingAlias(alias: string): boolean {
  return bankingConfig.aliasValidation(alias);
}
