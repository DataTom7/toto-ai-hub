/**
 * Intent Detection Utility
 * Centralized intent detection logic that can be used by both agents and API endpoints
 * This allows toto-app to check intent without hardcoding logic
 */

export interface IntentDetectionResult {
  hasIntent: boolean;
  intent?: string;
  confidence: number;
  isAffirmative?: boolean;
  isGreeting?: boolean;
}

/**
 * Detect if a message has user intent (not just greeting/affirmative)
 * This matches the logic used in toto-app's hasUserIntent function
 */
export function detectUserIntent(message: string): IntentDetectionResult {
  const lowerMessage = message.toLowerCase().trim();

  // Check for simple affirmatives
  const simpleAffirmatives = ['si', 'sí', 'yes', 'ok', 'okay', 'vale', 'claro', 'por supuesto', 'of course', 'sure'];
  const isAffirmative = simpleAffirmatives.some(affirm => 
    lowerMessage === affirm || lowerMessage === `${affirm}.` || lowerMessage === `${affirm}!`
  );

  if (isAffirmative) {
    return {
      hasIntent: false,
      isAffirmative: true,
      confidence: 0.9
    };
  }

  // Check for simple greetings
  const simpleGreetings = ['hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches'];
  const isGreeting = simpleGreetings.includes(lowerMessage);

  if (isGreeting) {
    return {
      hasIntent: false,
      isGreeting: true,
      confidence: 0.9
    };
  }

  // Intent keywords (same as toto-app)
  const intentKeywords = [
    'donar', 'donate', 'donación', 'donation', 'colaborar', 'collaborate',
    'contribuir', 'contribute', 'dinero', 'money', 'pesos', 'dollars',
    'transferir', 'transfer', 'enviar dinero', 'send money', 'pagar', 'pay', 'pago', 'payment',
    'alias', 'cuenta bancaria', 'bank account', 'transferencia', 'bank transfer',
    'quiero donar', 'want to donate', 'cómo dono', 'how do i donate',
    'compartir', 'share', 'comparto', 'sharing', 'difundir', 'spread', 'publicar', 'post',
    'redes sociales', 'social media', 'facebook', 'instagram', 'twitter', 'whatsapp', 'telegram',
    'quiero compartir', 'want to share', 'cómo comparto', 'how do i share',
    'adoptar', 'adopt', 'adopción', 'adoption', 'hogar', 'home', 'casa', 'house',
    'quiero adoptar', 'want to adopt', 'cómo adopto', 'how do i adopt',
    'proceso de adopción', 'adoption process', 'requisitos', 'requirements',
    'qué', 'what', 'cómo', 'how', 'cuándo', 'when', 'dónde', 'where', 'por qué', 'why',
    'cuál', 'which', 'cuánto', 'how much', 'cuántos', 'how many',
    'pregunta', 'question', 'saber más', 'know more', 'información', 'information',
    'detalles', 'details', 'explicar', 'explain', 'entender', 'understand',
    'me puedes decir', 'can you tell me', 'quiero saber', 'i want to know',
    'cuéntame', 'tell me', 'dime', 'tell me about'
  ];

  const hasKeyword = intentKeywords.some(keyword => lowerMessage.includes(keyword));
  const isQuestion = lowerMessage.endsWith('?') || lowerMessage.includes('?');

  const hasIntent = hasKeyword || (isQuestion && lowerMessage.length > 3);

  // Detect specific intent type
  let detectedIntent: string | undefined;
  if (hasIntent) {
    if (lowerMessage.includes('donar') || lowerMessage.includes('donate') || lowerMessage.includes('dinero') || lowerMessage.includes('money')) {
      detectedIntent = 'donate';
    } else if (lowerMessage.includes('compartir') || lowerMessage.includes('share')) {
      detectedIntent = 'share';
    } else if (lowerMessage.includes('adoptar') || lowerMessage.includes('adopt')) {
      detectedIntent = 'adopt';
    } else if (lowerMessage.includes('ayudar') || lowerMessage.includes('help')) {
      detectedIntent = 'help';
    } else {
      detectedIntent = 'general';
    }
  }

  return {
    hasIntent,
    intent: detectedIntent,
    confidence: hasIntent ? 0.8 : 0.2,
    isAffirmative: false,
    isGreeting: false
  };
}

