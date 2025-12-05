import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

/**
 * Extracted information from donation receipt image
 */
export interface DonationReceiptAnalysis {
  // Financial information
  amount: {
    value: number; // Amount in ARS (as number, not string)
    currency: string; // 'ARS' or detected currency
    confidence: number;
    rawText?: string; // Original text found in receipt
  };
  
  // Transaction details
  transactionId?: {
    value: string;
    confidence: number;
    rawText?: string;
  };
  
  // Banking information
  bank: {
    name?: string; // Bank name (e.g., "Banco Nación", "Mercado Pago", "Ualá")
    type?: 'traditional' | 'digital_wallet' | 'unknown';
    confidence: number;
  };
  
  // Recipient information (guardian alias)
  recipientAlias?: {
    value: string; // Banking alias (CVU/CBU)
    confidence: number;
    rawText?: string;
  };
  
  // Date information
  transactionDate?: {
    value: string; // ISO 8601 date string
    confidence: number;
    rawText?: string;
  };
  
  // Sender information (if visible)
  senderAccount?: {
    lastDigits?: string; // Last 4 digits of sender account
    accountType?: string; // "Cuenta Corriente", "Caja de Ahorro", etc.
    confidence: number;
  };
  
  // Overall analysis
  confidence: number; // Overall confidence (0-1)
  isValidReceipt: boolean; // Whether this appears to be a valid donation receipt
  receiptType?: 'bank_transfer' | 'wallet_transfer' | 'unknown';
  warnings?: string[]; // Any issues or missing information
  extractedText?: string; // Full OCR text for reference
}

/**
 * Service for analyzing donation receipt images using Gemini Vision
 * Extracts bank, amount, transaction ID, date, and other relevant information
 */
export class DonationReceiptAnalysisService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    // Use gemini-2.0-flash for vision (supports both text and images)
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-001" // Flash experimental supports vision
    });
  }

  /**
   * Analyze a donation receipt image and extract structured information
   */
  async analyzeReceipt(
    imageUrl: string,
    context?: {
      expectedAmount?: number; // Expected donation amount (for validation)
      expectedAlias?: string; // Expected recipient alias (for validation)
    }
  ): Promise<DonationReceiptAnalysis> {
    try {
      console.log(`🧾 Analyzing donation receipt: ${imageUrl}`);

      // Fetch the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const imageData = Buffer.from(imageBuffer).toString('base64');

      // Create analysis prompt
      const prompt = this.createAnalysisPrompt(context);

      // Generate content with image and text
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: this.detectMimeType(imageUrl),
            data: imageData,
          },
        },
        { text: prompt },
      ]);

      const response = await result.response;
      const analysisText = response.text();

      // Parse the JSON response
      const analysis = this.parseAnalysisResponse(analysisText, context);

      console.log(`✅ Receipt analysis complete - Amount: ${analysis.amount.value}, Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);

      return analysis;

    } catch (error) {
      console.error('Error analyzing donation receipt:', error);

      // Return a low-confidence default analysis on error
      return this.createDefaultAnalysis(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create the analysis prompt for Gemini
   */
  private createAnalysisPrompt(context?: {
    expectedAmount?: number;
    expectedAlias?: string;
  }): string {
    const contextInfo = context?.expectedAmount 
      ? `\n\nCONTEXT: The expected donation amount is ${context.expectedAmount} ARS. Use this to validate the extracted amount.`
      : '';
    
    const aliasContext = context?.expectedAlias
      ? `\n\nCONTEXT: The expected recipient banking alias is "${context.expectedAlias}". Use this to validate the extracted alias.`
      : '';

    return `You are analyzing a donation receipt image from Argentina. This is a bank transfer or digital wallet transfer receipt showing a donation.

Extract ALL relevant information from the receipt image and return it as structured JSON.

CRITICAL INFORMATION TO EXTRACT:

1. **AMOUNT** (REQUIRED):
   - Extract the transfer amount in ARS (Argentine Pesos)
   - Convert to number (remove currency symbols, commas, periods used as thousands separators)
   - Example: "$1.500,00" or "1500" → 1500
   - Example: "$5.000" → 5000
   - Include confidence score (0-1)

2. **TRANSACTION ID** (if available):
   - Look for: "Número de operación", "ID de transacción", "Código", "Referencia"
   - Extract the transaction/operation number
   - Include confidence score

3. **BANK/WALLET NAME**:
   - Identify the bank or digital wallet (e.g., "Banco Nación", "Mercado Pago", "Ualá", "MODO", "BNA", "Santander")
   - Determine if it's a traditional bank or digital wallet
   - Include confidence score

4. **RECIPIENT ALIAS** (if visible):
   - Look for banking alias (CVU/CBU) - typically 6-20 characters, alphanumeric with dots/hyphens
   - Format: "alias", "CVU", "CBU", "destinatario"
   - Include confidence score

5. **TRANSACTION DATE**:
   - Extract date in format: YYYY-MM-DD
   - Look for: "Fecha", "Fecha de operación", timestamp
   - Include confidence score

6. **SENDER ACCOUNT** (if visible):
   - Last 4 digits of sender account
   - Account type if mentioned
   - Include confidence score

7. **RECEIPT TYPE**:
   - Determine: 'bank_transfer' (traditional bank) or 'wallet_transfer' (digital wallet like Mercado Pago, Ualá)
   - Include confidence score

VALIDATION RULES:
- If expected amount is provided, validate extracted amount matches (allow small differences for fees)
- If expected alias is provided, validate extracted alias matches
- Mark isValidReceipt as false if critical information is missing or doesn't match expectations
- Include warnings for any discrepancies or missing information

RESPONSE FORMAT (JSON only, no markdown):
{
  "amount": {
    "value": 1500,
    "currency": "ARS",
    "confidence": 0.95,
    "rawText": "$1.500,00"
  },
  "transactionId": {
    "value": "123456789",
    "confidence": 0.90,
    "rawText": "Nro. Operación: 123456789"
  },
  "bank": {
    "name": "Mercado Pago",
    "type": "digital_wallet",
    "confidence": 0.95
  },
  "recipientAlias": {
    "value": "dmartinez",
    "confidence": 0.85,
    "rawText": "Alias: dmartinez"
  },
  "transactionDate": {
    "value": "2025-12-15",
    "confidence": 0.90,
    "rawText": "15/12/2025"
  },
  "senderAccount": {
    "lastDigits": "1234",
    "accountType": "Cuenta Corriente",
    "confidence": 0.70
  },
  "confidence": 0.90,
  "isValidReceipt": true,
  "receiptType": "wallet_transfer",
  "warnings": [],
  "extractedText": "Full OCR text here..."
}${contextInfo}${aliasContext}

IMPORTANT:
- Return ONLY valid JSON, no markdown, no code blocks
- If information is not found, use null or omit the field
- Confidence scores should reflect how certain you are about the extraction
- Be thorough - extract ALL visible information`;

  }

  /**
   * Parse the JSON response from Gemini
   */
  private parseAnalysisResponse(
    responseText: string,
    context?: {
      expectedAmount?: number;
      expectedAlias?: string;
    }
  ): DonationReceiptAnalysis {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanedText);

      // Validate and normalize the response
      const analysis: DonationReceiptAnalysis = {
        amount: {
          value: parsed.amount?.value || 0,
          currency: parsed.amount?.currency || 'ARS',
          confidence: parsed.amount?.confidence || 0,
          rawText: parsed.amount?.rawText,
        },
        transactionId: parsed.transactionId ? {
          value: String(parsed.transactionId.value || ''),
          confidence: parsed.transactionId.confidence || 0,
          rawText: parsed.transactionId.rawText,
        } : undefined,
        bank: {
          name: parsed.bank?.name,
          type: parsed.bank?.type || 'unknown',
          confidence: parsed.bank?.confidence || 0,
        },
        recipientAlias: parsed.recipientAlias ? {
          value: String(parsed.recipientAlias.value || ''),
          confidence: parsed.recipientAlias.confidence || 0,
          rawText: parsed.recipientAlias.rawText,
        } : undefined,
        transactionDate: parsed.transactionDate ? {
          value: parsed.transactionDate.value,
          confidence: parsed.transactionDate.confidence || 0,
          rawText: parsed.transactionDate.rawText,
        } : undefined,
        senderAccount: parsed.senderAccount ? {
          lastDigits: parsed.senderAccount.lastDigits,
          accountType: parsed.senderAccount.accountType,
          confidence: parsed.senderAccount.confidence || 0,
        } : undefined,
        confidence: parsed.confidence || 0,
        isValidReceipt: parsed.isValidReceipt !== false,
        receiptType: parsed.receiptType || 'unknown',
        warnings: parsed.warnings || [],
        extractedText: parsed.extractedText,
      };

      // Validate against expected values if provided
      if (context?.expectedAmount && analysis.amount.value > 0) {
        const amountDiff = Math.abs(analysis.amount.value - context.expectedAmount);
        const tolerance = context.expectedAmount * 0.1; // 10% tolerance
        
        if (amountDiff > tolerance) {
          analysis.warnings = analysis.warnings || [];
          analysis.warnings.push(`Amount mismatch: extracted ${analysis.amount.value} but expected ${context.expectedAmount}`);
          analysis.isValidReceipt = false;
        }
      }

      if (context?.expectedAlias && analysis.recipientAlias?.value) {
        if (analysis.recipientAlias.value.toLowerCase() !== context.expectedAlias.toLowerCase()) {
          analysis.warnings = analysis.warnings || [];
          analysis.warnings.push(`Alias mismatch: extracted "${analysis.recipientAlias.value}" but expected "${context.expectedAlias}"`);
        }
      }

      return analysis;

    } catch (error) {
      console.error('Error parsing analysis response:', error);
      console.error('Response text:', responseText);
      throw new Error(`Failed to parse image analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect MIME type from image URL
   */
  private detectMimeType(imageUrl: string): string {
    const url = imageUrl.toLowerCase();
    if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
    if (url.includes('.png')) return 'image/png';
    if (url.includes('.gif')) return 'image/gif';
    if (url.includes('.webp')) return 'image/webp';
    return 'image/jpeg'; // Default
  }

  /**
   * Create default analysis on error
   */
  private createDefaultAnalysis(error: Error): DonationReceiptAnalysis {
    return {
      amount: {
        value: 0,
        currency: 'ARS',
        confidence: 0,
      },
      bank: {
        type: 'unknown',
        confidence: 0,
      },
      confidence: 0,
      isValidReceipt: false,
      receiptType: 'unknown',
      warnings: [`Analysis failed: ${error.message}`],
    };
  }
}

