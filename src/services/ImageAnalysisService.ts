import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

/**
 * Image Analysis Result Interface
 * Structured output from Gemini vision analysis of pet rescue images
 */
export interface ImageAnalysis {
  petAppearance: {
    breed: string;
    confidence: number;
    age: string; // 'puppy', 'young', 'adult', 'senior', 'unknown'
    color: string;
    size?: 'small' | 'medium' | 'large' | 'unknown';
  };
  healthIndicators: {
    visibleInjuries: string[];
    signsOfDistress: string[];
    bodyCondition: 'emaciated' | 'thin' | 'healthy' | 'overweight' | 'unknown';
    furCondition?: 'poor' | 'moderate' | 'good' | 'unknown';
    confidence: number;
  };
  environment: {
    setting: 'indoors' | 'outdoors' | 'shelter' | 'veterinary' | 'unknown';
    cleanliness: 'clean' | 'moderate' | 'dirty' | 'unknown';
    safety: 'safe' | 'moderate' | 'unsafe' | 'unknown';
    confidence: number;
  };
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // Overall confidence in the analysis
  analysisTimestamp: Date;
  warnings?: string[]; // Any warnings or edge cases detected
}

/**
 * Service for analyzing pet rescue images using Gemini Vision
 * Detects injuries, breeds, health conditions, and urgency levels
 */
export class ImageAnalysisService {
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
   * Analyze a pet rescue image for health indicators, urgency, and breed
   */
  async analyzeImage(
    imageUrl: string,
    context?: {
      postText?: string;
      platform?: 'twitter' | 'instagram';
      guardianName?: string;
    }
  ): Promise<ImageAnalysis> {
    try {
      console.log(`🖼️  Analyzing image: ${imageUrl}`);

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
      const analysis = this.parseAnalysisResponse(analysisText);

      console.log(`✅ Image analysis complete - Urgency: ${analysis.urgencyLevel}, Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);

      return analysis;

    } catch (error) {
      console.error('Error analyzing image:', error);

      // Return a low-confidence default analysis on error
      return this.createDefaultAnalysis(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Analyze multiple images and combine insights
   */
  async analyzeMultipleImages(
    imageUrls: string[],
    context?: {
      postText?: string;
      platform?: 'twitter' | 'instagram';
      guardianName?: string;
    }
  ): Promise<ImageAnalysis> {
    if (imageUrls.length === 0) {
      return this.createDefaultAnalysis(new Error('No images provided') as Error);
    }

    if (imageUrls.length === 1) {
      return this.analyzeImage(imageUrls[0], context);
    }

    // For multiple images, analyze each and combine results
    console.log(`🖼️  Analyzing ${imageUrls.length} images...`);

    const analyses = await Promise.all(
      imageUrls.map(url => this.analyzeImage(url, context))
    );

    // Combine analyses - take the most urgent/critical findings
    return this.combineAnalyses(analyses);
  }

  /**
   * Create the analysis prompt for Gemini
   */
  private createAnalysisPrompt(context?: {
    postText?: string;
    platform?: 'twitter' | 'instagram';
    guardianName?: string;
  }): string {
    const contextInfo = context?.postText
      ? `\n\nPost Text: "${context.postText}"\nPosted by: ${context.guardianName || 'Unknown guardian'}\nPlatform: ${context.platform || 'social media'}`
      : '';

    return `You are a veterinary image analysis AI helping to assess pet rescue cases.

Analyze this image and provide a detailed assessment in JSON format.

${contextInfo}

Please provide your analysis as a JSON object with this EXACT structure:

{
  "petAppearance": {
    "breed": "string (specific breed or 'mixed breed' or 'unknown')",
    "confidence": number (0-1),
    "age": "string ('puppy', 'young', 'adult', 'senior', or 'unknown')",
    "color": "string (describe coat color)",
    "size": "string ('small', 'medium', 'large', or 'unknown')"
  },
  "healthIndicators": {
    "visibleInjuries": ["array of specific injuries seen, or empty array"],
    "signsOfDistress": ["array of distress signals, or empty array"],
    "bodyCondition": "string ('emaciated', 'thin', 'healthy', 'overweight', or 'unknown')",
    "furCondition": "string ('poor', 'moderate', 'good', or 'unknown')",
    "confidence": number (0-1)
  },
  "environment": {
    "setting": "string ('indoors', 'outdoors', 'shelter', 'veterinary', or 'unknown')",
    "cleanliness": "string ('clean', 'moderate', 'dirty', or 'unknown')",
    "safety": "string ('safe', 'moderate', 'unsafe', or 'unknown')",
    "confidence": number (0-1)
  },
  "urgencyLevel": "string ('low', 'medium', 'high', or 'critical')",
  "confidence": number (0-1, overall confidence),
  "warnings": ["array of any concerns or edge cases, or empty array"]
}

URGENCY GUIDELINES:
- "critical": Visible severe injuries, extreme distress, life-threatening condition
- "high": Visible injuries, signs of neglect, unsafe environment
- "medium": Minor injuries, moderate distress, questionable environment
- "low": Healthy appearance, safe environment, no visible issues

Return ONLY the JSON object, no other text.`;
  }

  /**
   * Parse the analysis response from Gemini
   */
  private parseAnalysisResponse(responseText: string): ImageAnalysis {
    try {
      // Remove markdown code blocks if present
      let jsonString = responseText.trim();
      if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(jsonString);

      // Add timestamp
      return {
        ...parsed,
        analysisTimestamp: new Date(),
      } as ImageAnalysis;

    } catch (error) {
      console.error('Failed to parse image analysis response:', error);
      console.error('Response text:', responseText);
      throw new Error(`Failed to parse image analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Combine multiple image analyses into one
   */
  private combineAnalyses(analyses: ImageAnalysis[]): ImageAnalysis {
    // Take the highest urgency
    const urgencyOrder = ['low', 'medium', 'high', 'critical'];
    const maxUrgency = analyses.reduce((max, curr) => {
      const maxIndex = urgencyOrder.indexOf(max.urgencyLevel);
      const currIndex = urgencyOrder.indexOf(curr.urgencyLevel);
      return currIndex > maxIndex ? curr : max;
    }, analyses[0]);

    // Combine all unique injuries and distress signs
    const allInjuries = new Set<string>();
    const allDistress = new Set<string>();
    const allWarnings = new Set<string>();

    analyses.forEach(a => {
      a.healthIndicators.visibleInjuries.forEach(i => allInjuries.add(i));
      a.healthIndicators.signsOfDistress.forEach(d => allDistress.add(d));
      a.warnings?.forEach(w => allWarnings.add(w));
    });

    // Average confidence scores
    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
    const avgHealthConfidence = analyses.reduce((sum, a) => sum + a.healthIndicators.confidence, 0) / analyses.length;
    const avgEnvConfidence = analyses.reduce((sum, a) => sum + a.environment.confidence, 0) / analyses.length;

    // Use the first analysis as base, but combine findings
    return {
      petAppearance: analyses[0].petAppearance,
      healthIndicators: {
        ...analyses[0].healthIndicators,
        visibleInjuries: Array.from(allInjuries),
        signsOfDistress: Array.from(allDistress),
        confidence: avgHealthConfidence,
      },
      environment: {
        ...analyses[0].environment,
        confidence: avgEnvConfidence,
      },
      urgencyLevel: maxUrgency.urgencyLevel,
      confidence: avgConfidence,
      analysisTimestamp: new Date(),
      warnings: Array.from(allWarnings),
    };
  }

  /**
   * Detect MIME type from image URL
   */
  private detectMimeType(imageUrl: string): string {
    const url = imageUrl.toLowerCase();
    if (url.includes('.png')) return 'image/png';
    if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
    if (url.includes('.gif')) return 'image/gif';
    if (url.includes('.webp')) return 'image/webp';
    // Default to JPEG
    return 'image/jpeg';
  }

  /**
   * Create a default low-confidence analysis when errors occur
   */
  private createDefaultAnalysis(error: Error): ImageAnalysis {
    return {
      petAppearance: {
        breed: 'unknown',
        confidence: 0.0,
        age: 'unknown',
        color: 'unknown',
        size: 'unknown',
      },
      healthIndicators: {
        visibleInjuries: [],
        signsOfDistress: [],
        bodyCondition: 'unknown',
        furCondition: 'unknown',
        confidence: 0.0,
      },
      environment: {
        setting: 'unknown',
        cleanliness: 'unknown',
        safety: 'unknown',
        confidence: 0.0,
      },
      urgencyLevel: 'low',
      confidence: 0.0,
      analysisTimestamp: new Date(),
      warnings: [`Image analysis failed: ${error.message}`],
    };
  }
}
