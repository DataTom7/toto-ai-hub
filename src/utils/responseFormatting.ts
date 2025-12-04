/**
 * Response Formatting Utilities
 * Analyzes AI responses and generates formatting hints for better UI rendering
 * This allows toto-app to use consistent chunking without hardcoding logic
 */

export interface FormattingHints {
  paragraphBreaks: number[]; // Character positions for natural paragraph breaks
  sentenceBreaks: number[]; // Character positions for sentence breaks
  emphasisPoints: number[]; // Character positions that should be emphasized
  chunkingStrategy: 'sentence-based' | 'paragraph-based' | 'question-based';
  suggestedChunks: string[]; // Pre-chunked message for typing animation
  hasQuestions: boolean; // Whether response contains questions
  questionPositions: number[]; // Character positions where questions start
}

/**
 * Analyze a message and generate formatting hints
 * This helps toto-app render messages with better typing animation
 */
export function generateFormattingHints(message: string): FormattingHints {
  if (!message || message.trim().length === 0) {
    return {
      paragraphBreaks: [],
      sentenceBreaks: [],
      emphasisPoints: [],
      chunkingStrategy: 'sentence-based',
      suggestedChunks: [],
      hasQuestions: false,
      questionPositions: []
    };
  }

  const hints: FormattingHints = {
    paragraphBreaks: [],
    sentenceBreaks: [],
    emphasisPoints: [],
    chunkingStrategy: 'sentence-based',
    suggestedChunks: [],
    hasQuestions: false,
    questionPositions: []
  };

  // Detect questions (Spanish and English)
  const questionPattern = /[¿?]/g;
  let match;
  while ((match = questionPattern.exec(message)) !== null) {
    hints.hasQuestions = true;
    // Find the start of the question (look backwards for ¿ or sentence start)
    let questionStart = match.index;
    for (let i = match.index - 1; i >= 0; i--) {
      if (message[i] === '¿' || message[i] === '\n' || (i > 0 && /[.!?]\s/.test(message.substring(i - 1, i + 1)))) {
        questionStart = i + 1;
        break;
      }
      if (i === 0) questionStart = 0;
    }
    if (!hints.questionPositions.includes(questionStart)) {
      hints.questionPositions.push(questionStart);
    }
  }

  // Detect sentence breaks
  const sentencePattern = /[.!?]+(?=\s|$|¿)/g;
  let lastIndex = 0;
  while ((match = sentencePattern.exec(message)) !== null) {
    const breakPoint = match.index + match[0].length;
    hints.sentenceBreaks.push(breakPoint);
    lastIndex = breakPoint;
  }

  // Generate suggested chunks based on intelligent paragraph grouping
  // Strategy: Group sentences into paragraphs (max 2 sentences), but separate questions
  const chunks = generateSuggestedChunks(message, hints);
  hints.suggestedChunks = chunks;

  // Calculate paragraph breaks based on chunks
  let currentPos = 0;
  for (let i = 0; i < chunks.length - 1; i++) {
    currentPos += chunks[i].length;
    // Add space between chunks
    if (message[currentPos] === ' ') currentPos++;
    hints.paragraphBreaks.push(currentPos);
  }

  // Determine chunking strategy
  if (hints.hasQuestions && hints.questionPositions.length > 0) {
    hints.chunkingStrategy = 'question-based';
  } else if (hints.sentenceBreaks.length > 3) {
    hints.chunkingStrategy = 'paragraph-based';
  } else {
    hints.chunkingStrategy = 'sentence-based';
  }

  // Find emphasis points (exclamation marks, important words)
  const emphasisPattern = /[¡!]|(?:importante|important|urgente|urgent|gracias|thanks|ayuda|help)/gi;
  while ((match = emphasisPattern.exec(message)) !== null) {
    hints.emphasisPoints.push(match.index);
  }

  return hints;
}

/**
 * Generate suggested chunks for typing animation
 * Groups sentences intelligently: max 2 sentences per chunk, questions get their own chunk
 * Also handles bullet points and markdown lists - each bullet becomes its own chunk
 */
function generateSuggestedChunks(message: string, hints: FormattingHints): string[] {
  // First, check for bullet points or markdown lists
  const bulletPattern = /^[\s]*[\*\-\•]|^[\s]*\d+[\.\)]/gm;
  const hasBullets = bulletPattern.test(message);
  
  if (hasBullets) {
    // Split by bullet points - each bullet becomes its own chunk
    const lines = message.split(/\n/);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this line is a bullet point
      if (bulletPattern.test(trimmedLine)) {
        // Save previous chunk if exists
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Clean up bullet point formatting (remove *, -, •, numbers, bold markers)
        let cleanLine = trimmedLine
          .replace(/^[\*\-\•\d]+[\.\)]\s*/, '') // Remove bullet markers
          .replace(/\*\*/g, '') // Remove bold markers
          .replace(/\*/g, '') // Remove remaining asterisks
          .trim();
        
        chunks.push(cleanLine);
      } else if (trimmedLine) {
        // Regular text - add to current chunk
        if (currentChunk) {
          currentChunk += ' ' + trimmedLine;
        } else {
          currentChunk = trimmedLine;
        }
      }
    }
    
    // Add remaining chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Filter out empty chunks
    return chunks.filter(c => c.length > 0);
  }
  
  // Fallback to sentence-based chunking for non-bullet text
  // Split into sentences first
  const sentencePattern = /[.!?]+(?=\s|$|¿)/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sentencePattern.exec(message)) !== null) {
    const sentence = message.substring(lastIndex, match.index + match[0].length).trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text if any
  if (lastIndex < message.length) {
    const remaining = message.substring(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }
  }

  // Group sentences into chunks
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const isQuestion = sentence.trim().startsWith('¿') || sentence.includes('?');

    // If it's a question and we have content, start a new chunk
    if (isQuestion && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' ').trim());
      currentChunk = [sentence];
    } else {
      currentChunk.push(sentence);

      // If we have 2 sentences, save as chunk
      if (currentChunk.length >= 2) {
        chunks.push(currentChunk.join(' ').trim());
        currentChunk = [];
      }
    }
  }

  // Add remaining sentences
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' ').trim());
  }

  return chunks;
}

/**
 * Get optimal typing delay based on chunk length
 * Longer chunks need more time to type
 */
export function getTypingDelay(chunk: string, baseDelay: number = 30): number {
  const wordCount = chunk.split(/\s+/).length;
  // Base delay per word, with minimum delay
  return Math.max(baseDelay, wordCount * 20);
}

