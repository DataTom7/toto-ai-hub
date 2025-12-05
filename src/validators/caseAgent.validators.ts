/**
 * Validation Schemas for CaseAgent
 *
 * Uses Zod for runtime type validation and sanitization
 * of all inputs to CaseAgent methods.
 */

import { z } from 'zod';

/**
 * Message validation schema
 *
 * Prevents:
 * - Empty messages
 * - Excessively long messages (DoS)
 * - Script injection attempts
 */
export const MessageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(5000, 'Message too long (max 5000 characters)')
  .trim()
  .refine(
    (msg) => !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(msg),
    'Invalid characters in message'
  )
  .refine(
    (msg) => !/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi.test(msg),
    'Invalid characters in message'
  );

/**
 * Case Data validation schema
 *
 * Ensures all required case fields are present and valid
 */
export const CaseDataSchema = z.object({
  id: z.string().min(1, 'Case ID is required'),
  name: z.string().min(1, 'Case name is required').max(200, 'Case name too long'),
  description: z.string().min(1, 'Case description is required').max(10000, 'Description too long'),
  status: z.enum(['draft', 'active', 'urgent', 'completed'], {
    errorMap: () => ({ message: 'Invalid case status' })
  }),
  priority: z.enum(['urgent', 'normal'], {
    errorMap: () => ({ message: 'Invalid priority' })
  }),
  category: z.enum(['rescue', 'surgery', 'treatment', 'transit', 'foster'], {
    errorMap: () => ({ message: 'Invalid category' })
  }),
  guardianId: z.string().min(1, 'Guardian ID is required'),
  donationsReceived: z.number().min(0, 'Donations cannot be negative'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  animalType: z.string().optional(),
  location: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * User Context validation schema
 *
 * Validates user identity and permissions
 */
export const UserContextSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  userRole: z.enum(['user', 'guardian', 'admin', 'investor', 'lead_investor', 'partner'], {
    errorMap: () => ({ message: 'Invalid user role' })
  }),
  language: z.enum(['es', 'en'], {
    errorMap: () => ({ message: 'Unsupported language' })
  }).default('es'),
  userEmail: z.string().email('Invalid email').optional(),
  userName: z.string().optional(),
});

/**
 * Conversation Context validation schema (optional parameter)
 */
export const ConversationContextSchema = z.object({
  conversationId: z.string().optional(),
  previousMessages: z.array(z.object({
    role: z.enum(['user', 'agent']),
    message: z.string(),
    timestamp: z.string().optional(),
  })).optional(),
  metadata: z.record(z.any()).optional(),
}).optional();

/**
 * Complete processCaseInquiry input validation schema
 */
export const ProcessCaseInquiryInputSchema = z.object({
  message: MessageSchema,
  caseData: CaseDataSchema,
  userContext: UserContextSchema,
  conversationContext: ConversationContextSchema,
});

/**
 * Validate processCaseInquiry inputs
 *
 * @param input - Raw input object
 * @returns Validated and sanitized input
 * @throws ZodError with detailed validation errors
 *
 * @example
 * try {
 *   const validated = validateProcessCaseInquiryInput({
 *     message: userMessage,
 *     caseData: case,
 *     userContext: user,
 *   });
 *   // Use validated data
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error('Validation failed:', error.errors);
 *   }
 * }
 */
export function validateProcessCaseInquiryInput(input: unknown) {
  return ProcessCaseInquiryInputSchema.parse(input);
}

/**
 * Safe validation that returns result object instead of throwing
 *
 * @param input - Raw input object
 * @returns Success result with data, or error result with issues
 */
export function safeValidateProcessCaseInquiryInput(input: unknown) {
  return ProcessCaseInquiryInputSchema.safeParse(input);
}

/**
 * Banking alias validation
 */
export const BankingAliasSchema = z
  .string()
  .min(3, 'Banking alias too short (min 3 characters)')
  .max(50, 'Banking alias too long (max 50 characters)')
  .regex(/^[a-z0-9.]+$/, 'Banking alias must contain only lowercase letters, numbers, and dots')
  .trim();

/**
 * Donation amount validation
 */
export const DonationAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .finite('Amount must be a valid number')
  .max(10_000_000, 'Amount exceeds maximum (10,000,000 ARS)')
  .refine((amount) => amount >= 1, 'Amount must be at least 1 ARS');
