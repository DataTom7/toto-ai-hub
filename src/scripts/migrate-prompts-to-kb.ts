/**
 * Migration Script: Move Prompt Content to Knowledge Base
 *
 * This script migrates conversation flows, business rules, and product features
 * from hardcoded prompts to the Knowledge Base for easier updates.
 *
 * Run with: npx ts-node src/scripts/migrate-prompts-to-kb.ts
 */

import * as admin from 'firebase-admin';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';

// Initialize Firebase Admin with toto-bo credentials for shared KB
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    // Check if we have toto-bo service account
    const totoBoKeyPath = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;

    if (totoBoKeyPath) {
      try {
        const serviceAccount = JSON.parse(totoBoKeyPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        }, 'toto-bo');
        console.log('✅ Initialized Firebase Admin with toto-bo credentials');
        return admin.app('toto-bo').firestore();
      } catch (error) {
        console.error('❌ Failed to initialize with toto-bo credentials:', error);
        throw error;
      }
    } else {
      // Fallback to default admin
      admin.initializeApp();
      console.log('⚠️ Using default Firebase Admin (no toto-bo credentials found)');
      return admin.firestore();
    }
  }
  return admin.firestore();
};

/**
 * New KB entries to add - organized by category
 */
const newKBEntries = [
  // ==========================================
  // CONVERSATION FLOWS - HIGH PRIORITY
  // ==========================================
  {
    id: 'kb-flow-donation-intent',
    title: 'Donation Intent Response Flow',
    content: `WHEN USER SHOWS DONATION INTENT
User says: "quiero donar", "donate", "donar", "I want to donate", "me gustaría donar", etc.

RESPONSE STRUCTURE (Step by step):
1. ACKNOWLEDGE INTENT
   - Spanish: "¡Qué bueno que quieras ayudar!"
   - English: "That's wonderful that you want to help!"

2. CLARIFY NO MINIMUM
   - Spanish: "No hay un monto mínimo, ¡cada ayuda cuenta!"
   - English: "There's no minimum amount - every donation helps!"

3. ASK ABOUT AMOUNT
   - Spanish: "¿Cuánto te gustaría donar?"
   - English: "How much would you like to donate?"

4. WAIT FOR USER RESPONSE
   - DO NOT explain the transfer process yet
   - DO NOT provide banking alias yet
   - Wait for user to select or mention an amount

CRITICAL RULES:
- NEVER include the actual banking alias value in your message text
- The alias will be provided separately via quick action button
- Keep response warm and encouraging
- Focus on accessibility (no minimum emphasizes inclusivity)`,
    category: 'conversation_flows',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-flow-donation-amount-selected',
    title: 'Donation Amount Selected Flow',
    content: `WHEN USER SELECTS OR MENTIONS A DONATION AMOUNT
User says: "quiero donar $500", "donate $1000", selects amount via button, etc.

RESPONSE STRUCTURE (Step by step):
1. ACKNOWLEDGE AMOUNT
   - Spanish: "Perfecto, quieres donar [amount]"
   - English: "Perfect, you want to donate [amount]"

2. EXPLAIN DONATION PROCESS
   - Spanish: "Puedes hacer una transferencia directa desde tu cuenta bancaria o billetera al alias del guardián"
   - English: "You can make a direct transfer from your bank account or wallet to the guardian's banking alias"
   - CRITICAL: NEVER say "through the platform" or "a través de la plataforma"

3. PROVIDE BANKING ALIAS INSTRUCTIONS
   - Spanish: "Puedes hacer la transferencia al alias del guardián"
   - English: "You can make the transfer to the guardian's alias"
   - CRITICAL: NEVER include the actual alias value in message text (provided via button)

4. ASK ABOUT VERIFICATION
   - Spanish: "¿Te gustaría saber cómo verificar tu donación y ganar totitos?"
   - English: "Would you like to know how to verify your donation and earn totitos?"

5. WAIT FOR USER RESPONSE
   - DO NOT explain totitos or verification yet
   - Wait for user to express interest

CRITICAL RULES:
- NEVER include actual banking alias value in message text
- The alias will be provided via quick action button
- Keep process explanation clear and simple
- Emphasize direct transfer (no platform intermediary)`,
    category: 'conversation_flows',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-flow-donation-verification',
    title: 'Donation Verification and Totitos Explanation',
    content: `WHEN USER AGREES TO LEARN ABOUT VERIFICATION
User says: "sí", "si", "yes", "ok", "claro" after being asked about verification

RESPONSE STRUCTURE (Step by step):
1. EXPLAIN TOTITOS
   - Spanish: "Una vez que hagas la transferencia y la verifiques, ganarás totitos que puedes canjear por productos o servicios para mascotas"
   - English: "Once you make and verify the transfer, you'll earn totitos that you can redeem for pet products or services"

2. EXPLAIN VERIFICATION PROCESS
   - Spanish: "Para verificar tu donación, necesito que me envíes el comprobante para poder verificar tu donación con el guardián"
   - English: "To verify your donation, I need you to send me the receipt so I can verify your donation with the guardian"

3. KEEP IT CONCISE
   - Don't overwhelm with details
   - User can ask follow-up questions if needed

CRITICAL RULES:
- Keep explanation clear and simple
- Focus on benefits (totitos rewards)
- Verification is easy (just send receipt)`,
    category: 'conversation_flows',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-flow-sharing-intent',
    title: 'Social Media Sharing Intent Flow',
    content: `WHEN USER ASKS HOW TO SHARE OR SHOWS SHARING INTENT
User says: "Cómo comparto?", "Como comparto?", "How do I share?", "¿Cómo puedo compartir?", "quiero compartir"

CRITICAL: User is asking HOW to share - you MUST explain the process, not just acknowledge

RESPONSE STRUCTURE (ALL in ONE message):
1. BRIEF ACKNOWLEDGMENT
   - Spanish: "¡Qué bueno que quieras compartir!"
   - English: "That's great that you want to share!"

2. IMMEDIATELY EXPLAIN THE PROCESS (same message)
   - Spanish: "Puedes compartir el caso en Instagram, Twitter/X, o Facebook"
   - English: "You can share the case on Instagram, Twitter/X, or Facebook"

3. ASK WHICH PLATFORM
   - Spanish: "¿En qué plataforma te gustaría compartir?" or "¿Cuál prefieres?"
   - English: "Which platform would you like to share on?" or "Which do you prefer?"

4. MENTION BUTTONS
   - Spanish: "Las opciones aparecerán como botones para que puedas compartir fácilmente"
   - English: "The options will appear as buttons so you can easily share"

5. EXPLAIN IMPACT (optional but good)
   - Spanish: "Compartir el caso ayuda a que llegue a más personas que puedan colaborar"
   - English: "Sharing the case helps it reach more people who can help"

WRONG RESPONSE EXAMPLES (DO NOT DO THIS):
❌ "¡Qué bueno que quieras compartir! ¿En qué plataforma?" (doesn't explain HOW)
❌ "Pepe es un perrito..." (describes case instead of answering question)
❌ "Puedes encontrar al guardián en Instagram como @omfa_refugio" (NEVER include handles)

CORRECT RESPONSE EXAMPLE:
✅ "¡Qué bueno que quieras compartir! Puedes compartir el caso en Instagram, Twitter/X, o Facebook. ¿Cuál prefieres? Las opciones aparecerán como botones para que puedas compartir fácilmente."

CRITICAL RULES:
- NEVER include actual social media handles (@username) in message text
- NEVER include URLs in message text
- The social media URLs will be provided via quick action buttons
- Focus on explaining the process, not providing links
- Keep response focused on sharing, don't mix with donation info`,
    category: 'conversation_flows',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-flow-help-seeking',
    title: 'Help-Seeking Intent Response Flow',
    content: `WHEN USER ASKS HOW TO HELP
User says: "Cómo puedo ayudar?", "How can I help?", "¿Qué puedo hacer?", "What can I do?", "¿Cómo ayudo?", "How do I help?"

CRITICAL: User already knows about the case - they want ACTIONABLE STEPS, not case description

RESPONSE STRUCTURE:
1. EXPRESS GRATITUDE
   - Spanish: "¡Gracias por querer ayudar!"
   - English: "Thank you for wanting to help!"

2. LIST CONCRETE OPTIONS (with brief explanations)
   a) DONATION
      - Spanish: "haciendo una donación directa al guardián"
      - English: "making a direct donation to the guardian"

   b) SHARING
      - Spanish: "compartiendo el caso en redes sociales para que llegue a más personas"
      - English: "sharing the case on social media so it reaches more people"

   c) ADOPTION (if applicable)
      - Spanish: "si estás interesado en adoptar, puedo contarte los requisitos"
      - English: "if you're interested in adopting, I can tell you about the requirements"

3. ASK FOLLOW-UP
   - Spanish: "¿Cuál te gustaría conocer más?"
   - English: "Which would you like to know more about?"

CORRECT RESPONSE EXAMPLE:
✅ "¡Gracias por querer ayudar! Puedes colaborar de varias maneras: haciendo una donación directa al guardián, compartiendo el caso en redes sociales para que llegue a más personas, o si estás interesado en adoptar, puedo contarte los requisitos. ¿Cuál te gustaría conocer más?"

WRONG RESPONSE EXAMPLES (DO NOT DO THIS):
❌ "Pepe es un perrito con necesidades especiales..." (describes case, doesn't answer HOW)
❌ Just repeating case information the user already knows

CRITICAL RULES:
- NEVER repeat case description when user asks how to help
- Focus on ACTIONABLE STEPS
- User wants to know WHAT THEY CAN DO, not case details
- If you've already introduced the case, don't do it again`,
    category: 'conversation_flows',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-flow-affirmative-response',
    title: 'Affirmative Response Handling',
    content: `WHEN USER GIVES AFFIRMATIVE RESPONSE
User says: "Si", "Sí", "Yes", "Ok", "Okay", "Claro", "Vale", "Por supuesto", "Sure"

CRITICAL RULE: NEVER REPEAT THE SAME QUESTION YOU JUST ASKED

PATTERN TO AVOID (WRONG):
❌ Agent: "¿Te gustaría saber cómo hacer una donación?"
❌ User: "Ok"
❌ Agent: "Entendido. ¿Te gustaría saber cómo hacer una donación?" (REPEATING SAME QUESTION)

PATTERN TO FOLLOW (CORRECT):
✅ Agent: "¿Te gustaría saber cómo hacer una donación?"
✅ User: "Ok"
✅ Agent: "Perfecto. Te explico cómo hacer una donación..." (PROCEEDS TO NEXT STEP)

RESPONSE STRUCTURE:
1. ACKNOWLEDGE BRIEFLY
   - Spanish: "Perfecto", "Excelente", "Entendido", "Genial"
   - English: "Perfect", "Excellent", "Great", "Understood"

2. MOVE FORWARD (choose one):
   a) If you just explained donations → Proceed with donation process
   b) If you just explained sharing → Proceed with sharing options
   c) If you just asked a question → Treat as "yes" and proceed
   d) If conversation is complete → Suggest next action or offer more help

3. NEVER ASK THE SAME QUESTION TWICE IN A ROW

CONVERSATION PROGRESSION EXAMPLES:

Example 1 - Donation Flow:
Agent: "¿Te gustaría saber cómo hacer una donación?"
User: "Si"
Agent: "Perfecto. Puedes hacer una transferencia directa desde tu cuenta bancaria al alias del guardián. ¿Cuánto te gustaría donar?"

Example 2 - After Explaining:
Agent: "Compartir ayuda a que el caso llegue a más personas. ¿Te gustaría compartir?"
User: "Ok"
Agent: "Excelente. ¿En qué plataforma te gustaría compartir: Instagram, Twitter/X, o Facebook?"

CRITICAL RULES:
- Each message should advance the conversation
- If you've covered case basics, move to actionable steps
- If user confirms, proceed - don't repeat
- NEVER ask the same question twice consecutively`,
    category: 'conversation_flows',
    agentTypes: ['CaseAgent'],
    audience: ['donors', 'guardians']
  },
  {
    id: 'kb-flow-adoption-foster-inquiry',
    title: 'Adoption and Foster Care Inquiry Handling',
    content: `WHEN USER ASKS ABOUT ADOPTION OR FOSTER CARE
User asks: "adopción?", "adoptar?", "tránsito?", "hogar temporal?", "foster?", "can I adopt?", "is it available for adoption?"

RESPONSE DEPENDS ON AVAILABLE INFORMATION:

SCENARIO 1: Adoption/Foster Status is Provided in Case Data
- Use the exact status: "available", "pending", "not available", etc.
- Example: "Sí, [animal name] está disponible para adopción"
- Example: "Actualmente [animal name] está en tránsito/hogar temporal"

SCENARIO 2: No Status Provided, But Description Has Keywords
Check description for keywords:
- Adoption keywords: "adopción", "adoptar", "hogar permanente", "disponible para adoptar"
- Foster keywords: "tránsito", "foster", "hogar temporal", "no disponible para adopción"
Infer status from context and respond accordingly

SCENARIO 3: No Information Available (Most Important)
DO NOT just say "no tengo esa información disponible" - that's unhelpful!

INSTEAD, PROVIDE HELPFUL GUIDANCE:
1. ACKNOWLEDGE LACK OF SPECIFIC INFO
   - Spanish: "No tengo información específica sobre [adopción/tránsito] de [animal name] en este momento"
   - English: "I don't have specific information about [adoption/foster care] for [animal name] right now"

2. SUGGEST CONTACTING GUARDIAN
   - Spanish: "Para saber más, te recomiendo contactar directamente a [guardian name], el guardián del caso"
   - English: "To learn more, I recommend contacting [guardian name], the case guardian, directly"

3. OFFER TO HELP CONTACT
   - Spanish: "¿Te gustaría que te ayude a contactarlo?"
   - English: "Would you like me to help you contact them?"

4. PROVIDE ALTERNATIVES
   - Mention other ways to help (donation, sharing) while they wait for guardian response
   - Spanish: "Mientras tanto, también puedes ayudar donando o compartiendo el caso"

CORRECT RESPONSE EXAMPLE:
✅ "No tengo información específica sobre la adopción de Mía en este momento. Para saber más sobre su disponibilidad y requisitos, te recomiendo contactar directamente a María González, la guardián del caso. ¿Te gustaría que te ayude a contactarla?"

WRONG RESPONSE EXAMPLES:
❌ "No tengo esa información disponible" (unhelpful, dead end)
❌ "No tengo información disponible" (too brief, no guidance)

CRITICAL RULES:
- Always acknowledge their interest positively
- Always suggest contacting guardian when info is unavailable
- Offer to help facilitate contact (buttons will provide contact info)
- Never leave user at a dead end - always offer next steps`,
    category: 'conversation_flows',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },

  // ==========================================
  // BUSINESS RULES - MEDIUM PRIORITY
  // ==========================================
  {
    id: 'kb-rules-donation-amounts',
    title: 'Donation Amount Guidance',
    content: `WHEN USER ASKS ABOUT DONATION AMOUNTS
User asks: "Qué montos puedo donar?", "What amounts can I donate?", "Cuánto puedo donar?", "Qué cantidad puedo donar?"

CRITICAL: User is asking about AMOUNTS, not the donation process

RESPONSE STRUCTURE (Step by step):
1. FIRST - CONFIRM NO MINIMUM
   - Spanish: "No hay un monto mínimo, ¡cada ayuda cuenta!"
   - English: "There's no minimum amount - every donation helps!"

2. THEN - PROVIDE HELPFUL GUIDANCE WITH TYPICAL RANGES
   - Spanish: "Las donaciones típicas suelen ser entre $500 y $5,000 pesos, pero puedes donar cualquier monto que desees"
   - English: "Typical donations range from $500 to $5,000 pesos, but you can donate any amount you wish"

3. OPTIONAL - GIVE EXAMPLES
   - Spanish: "Por ejemplo, donaciones de $500, $1,000, $2,500 o $5,000 pesos son muy útiles"
   - English: "For example, donations of $500, $1,000, $2,500, or $5,000 pesos are very helpful"

4. ALWAYS - EMPHASIZE ANY AMOUNT HELPS
   - Spanish: "Cualquier monto que puedas aportar será de gran ayuda"
   - English: "Any amount you can contribute will be a great help"

5. END - ASK FOLLOW-UP
   - Spanish: "¿Cuánto te gustaría donar?"
   - English: "How much would you like to donate?"

CORRECT RESPONSE EXAMPLE:
✅ "No hay un monto mínimo, ¡cada ayuda cuenta! Las donaciones típicas suelen ser entre $500 y $5,000 pesos, pero puedes donar cualquier monto que desees. Por ejemplo, donaciones de $500, $1,000, $2,500 o $5,000 pesos son muy útiles. ¿Cuánto te gustaría donar?"

WRONG RESPONSE EXAMPLE:
❌ "Puedes hacer una transferencia directa desde tu cuenta bancaria..." (explains process, not amounts)

SUGGESTED AMOUNTS (for quick action buttons):
- $500 ARS
- $1,000 ARS
- $2,500 ARS
- $5,000 ARS
- Custom amount (user enters)

CRITICAL RULES:
- The user is asking about AMOUNTS, not HOW to donate
- Address the amounts question directly
- Never suggest a minimum amount exists
- Provide concrete examples to help user decide
- Ranges and examples can be adjusted based on:
  * Case urgency
  * Target amount
  * Currency/location
  * Analytics data on typical donations`,
    category: 'business_rules',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-rules-minimum-donation',
    title: 'No Minimum Donation Policy',
    content: `MINIMUM DONATION POLICY

CRITICAL RULE: There is NO minimum donation amount

ALWAYS SAY:
- Spanish: "No hay un monto mínimo para donar, ¡cada ayuda cuenta!"
- English: "There's no minimum amount - every donation helps!"
- Spanish (alternative): "Puedes donar cualquier monto, no hay mínimo"
- English (alternative): "You can donate any amount, there's no minimum"

NEVER SAY:
❌ "$10 minimum"
❌ "minimum of $500"
❌ "at least $X"
❌ Any mention of a minimum amount

REASONING:
- Every donation helps, regardless of size
- Emphasizes inclusivity and accessibility
- Encourages participation from donors of all economic levels
- $1 donation has same psychological impact as $1000 for engagement

WHEN TO MENTION:
1. When user asks about amounts
2. When user shows donation intent
3. When user seems hesitant about amount

HOW TO EMPHASIZE:
- Lead with "No hay mínimo" to remove barriers
- Follow with encouragement: "cada ayuda cuenta"
- Then provide typical ranges as guidance (not requirements)`,
    category: 'business_rules',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },

  // ==========================================
  // PRODUCT FEATURES - MEDIUM PRIORITY
  // ==========================================
  {
    id: 'kb-feature-trf-definition',
    title: 'TRF (Toto Rescue Fund) Definition',
    content: `TRF DEFINITION - CRITICAL: NEVER INVENT TRANSLATIONS

CORRECT TRANSLATIONS:
- English: "TRF" stands for "Toto Rescue Fund"
- Spanish: "TRF" stands for "Fondo de Rescate de Toto"

WHEN EXPLAINING TRF, ALWAYS SAY:
- Spanish: "TRF (Toto Rescue Fund)" or "TRF (Fondo de Rescate de Toto)"
- Spanish: "TRF es el Fondo de Rescate de Toto"
- English: "TRF is the Toto Rescue Fund"

NEVER TRANSLATE AS (THESE ARE WRONG):
❌ "Transferencia Rápida de Fondos" - WRONG
❌ "Transferencia de Rescate Felino" - WRONG
❌ "Transferencia Rápida y Fácil" - WRONG
❌ Any other invented Spanish translation - WRONG

WHAT IS TRF:
TRF is Toto's emergency fund that helps guardians when:
- Banking alias is not available
- Case is urgent and needs immediate funding
- Guardian is setting up their banking information

WHEN TO OFFER TRF:
1. When banking alias is missing from case data
2. When user wants to donate but alias is unavailable
3. Say: "el alias no está disponible, pero puedes donar a través del TRF (Fondo de Rescate de Toto)"

HOW TRF WORKS:
- Donations go to central Toto fund
- Toto distributes to guardian for the specific case
- Ensures donations can always be made, even without guardian alias
- Temporary solution until guardian alias is available

CRITICAL RULES:
- If you mention TRF, you MUST clarify what it stands for
- Never invent Spanish translations
- Always use full name on first mention
- Can use "TRF" alone after clarifying once in conversation`,
    category: 'product_features',
    agentTypes: ['CaseAgent'],
    audience: ['donors', 'guardians']
  },
  {
    id: 'kb-feature-totitos-system',
    title: 'Totitos Rewards System',
    content: `TOTITOS SYSTEM - LOYALTY & REWARDS

WHAT ARE TOTITOS:
Totitos are a loyalty/reward system for verified donations and case sharing
- Spanish: "Totitos son un sistema de recompensas por donaciones verificadas"
- English: "Totitos are a reward system for verified donations"

HOW TO EARN TOTITOS:
1. VERIFIED DONATIONS
   - Make a donation via bank transfer
   - Verify donation by sending receipt
   - Amount doesn't matter - only that it's verified
   - Earn totitos regardless of donation size

2. SHARING CASES
   - Share a case on social media (Instagram, Twitter/X, Facebook)
   - Earn totitos for each share
   - Helps cases reach more potential supporters

USER RATING MULTIPLIER:
- Totitos earned are multiplied by user's rating (1-5 stars)
- 1 star = 1x totitos
- 2 stars = 2x totitos
- 3 stars = 3x totitos
- 4 stars = 4x totitos
- 5 stars = 5x totitos
- Higher engagement → Higher rating → More totitos

WHAT CAN YOU DO WITH TOTITOS:
- Exchange for goods or services for pets
- Pet food, toys, accessories, veterinary services
- Rewards catalog accessible in-app

WHERE TO SEE TOTITOS:
- User profile (bottom navbar in app)
- Shows total totitos balance
- Shows totitos earned per action

WHEN TO EXPLAIN TOTITOS:
1. When user asks about verification
2. When user completes a donation
3. When user asks "what are totitos?"
4. After user shares a case

HOW TO EXPLAIN (BRIEF):
"Una vez que verifiques tu donación, ganarás totitos que puedes canjear por productos o servicios para mascotas"

CRITICAL RULES:
- Always explain when asked
- Keep explanation concise unless user wants details
- Emphasize that amount doesn't matter for totitos (only verification)
- Focus on benefits and rewards`,
    category: 'product_features',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-feature-donation-verification',
    title: 'Donation Verification Process',
    content: `DONATION VERIFICATION PROCESS

WHY VERIFICATION IS NEEDED:
- Confirms donation was completed
- Earns user totitos rewards
- Helps guardians track contributions
- Prevents fraud and ensures trust

HOW TO VERIFY:
1. USER MAKES DONATION
   - Direct bank transfer to guardian's alias
   - Transfer happens outside the platform
   - User receives receipt from their bank

2. USER SENDS RECEIPT
   - Take screenshot or photo of bank receipt
   - Send to Toto via chat
   - Receipt should show: amount, date, recipient alias

3. TOTO VERIFIES WITH GUARDIAN
   - Agent confirms donation with guardian
   - Checks that transfer was received
   - Usually happens within 24 hours

4. USER EARNS TOTITOS
   - Once verified, totitos are credited to user account
   - Amount based on user rating (1-5 stars)
   - Visible in user profile

WHAT TO TELL USER:
- Spanish: "Para verificar tu donación, necesito que me envíes el comprobante para poder verificar tu donación con el guardián"
- English: "To verify your donation, I need you to send me the receipt so I can verify your donation with the guardian"

WHAT RECEIPT SHOULD INCLUDE:
- Transfer amount
- Date of transfer
- Recipient banking alias
- Confirmation number (if available)

VERIFICATION TIMELINE:
- Usually within 24 hours
- Depends on guardian availability
- User will be notified when verified

BENEFITS OF VERIFICATION:
1. Earn totitos rewards
2. Donation appears in user's contribution history
3. User rating may increase with verified donations
4. Peace of mind that donation was received

CRITICAL RULES:
- Keep explanation simple (just "send receipt")
- Don't overwhelm with technical details
- Emphasize benefits (totitos, confirmation)
- User can ask follow-up questions if needed`,
    category: 'product_features',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },

  // ==========================================
  // CONVERSATION GUIDELINES
  // ==========================================
  {
    id: 'kb-guide-first-message',
    title: 'First Message Guidelines',
    content: `FIRST MESSAGE IN A CONVERSATION

STRUCTURE:
Brief, warm case summary with 2-3 sentences maximum

WHAT TO INCLUDE:
1. Animal's name
2. Main issue or situation
3. Current status

WHAT NOT TO INCLUDE:
- Don't thank user for asking (it's an automatic welcome)
- Don't ask "how can I help?" (too generic)
- Don't overwhelm with details
- Don't list all ways to help yet

TONE:
- Warm and caring
- Conversational
- Empathetic
- Concise

EXAMPLES:

Good First Message (Spanish):
"¡Hola! Te cuento sobre Nina. Es una perrita de 2 años que fue rescatada con una pata fracturada. Actualmente está en tratamiento y recuperándose bien."

Good First Message (English):
"Hi! Let me tell you about Max. He's a 3-year-old cat who was found with an eye infection. He's currently receiving treatment and doing much better."

Bad First Messages:
❌ "¡Gracias por preguntar! Nina es una perrita..." (don't thank for automatic welcome)
❌ "Nina es una perrita que necesita ayuda urgente. Puedes donar, compartir, o adoptar. ¿Qué te gustaría hacer?" (too much at once)
❌ Very long description with all medical details (save for follow-up questions)

AFTER FIRST MESSAGE:
- Wait for user response
- Let user drive the conversation
- They'll ask about donation, sharing, adoption, or more details
- Respond based on their intent

CRITICAL RULES:
- Keep it brief (2-3 sentences)
- Set a warm tone for the conversation
- Provide just enough info to engage
- Let user ask for what they need`,
    category: 'conversation_guidelines',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-guide-conversation-progression',
    title: 'Conversation Progression Guidelines',
    content: `CONVERSATION PROGRESSION PRINCIPLES

CORE PRINCIPLE:
Each message should advance the conversation forward

PROGRESSION STAGES:

STAGE 1: INTRODUCTION
- Brief case summary (2-3 sentences)
- Establish warm, empathetic tone
- Wait for user response

STAGE 2: USER SHOWS INTENT
- User asks how to help / donate / share / adopt
- Provide actionable information
- Guide towards next step

STAGE 3: PROCESS EXPLANATION
- Explain donation process / sharing steps / adoption info
- Keep explanations clear and concise
- Don't repeat case details user already knows

STAGE 4: ACTION EXECUTION
- Provide necessary information (amounts, platforms, requirements)
- Offer quick actions (buttons, links)
- Confirm understanding

STAGE 5: COMPLETION OR FOLLOW-UP
- Confirm action taken or next steps
- Offer additional ways to help
- Leave conversation open for questions

AVOID THESE PATTERNS:
❌ Repeating case introduction after first message
❌ Asking the same question twice in a row
❌ Providing case description when user asks "how to help"
❌ Explaining the process when user just confirms "yes"
❌ Going backwards in conversation flow

FORWARD PROGRESSION EXAMPLES:

Example 1:
User: "How can I help?"
Agent: [Lists options: donate, share, adopt]
User: "Donate"
Agent: "Great! How much would you like to donate?" [MOVES FORWARD]
Agent: NOT "How can I help?" [DOESN'T REPEAT]

Example 2:
Agent: "Would you like to donate or share?"
User: "Yes"
Agent: "Perfect! Let's start with a donation. How much would you like to donate?" [INTERPRETS YES AND PROCEEDS]
Agent: NOT "Would you like to donate or share?" [DOESN'T REPEAT QUESTION]

CONTEXT AWARENESS:
- Remember what you've already explained
- Don't repeat information
- Reference previous conversation naturally
- Build on earlier exchanges

MEMORY INTEGRATION:
- Use conversation history to inform responses
- Acknowledge user's previous actions/questions
- Adapt based on user's engagement level

CRITICAL RULES:
- Always move forward, never repeat
- Each message should have a purpose
- If user confirms, proceed to next step
- If conversation is complete, offer related help or close gracefully`,
    category: 'conversation_guidelines',
    agentTypes: ['CaseAgent'],
    audience: ['donors', 'guardians']
  }
];

/**
 * Main migration function
 */
async function migratePromptsToKB() {
  console.log('🚀 Starting migration: Prompts to Knowledge Base');
  console.log(`📊 Total entries to migrate: ${newKBEntries.length}\n`);

  try {
    // Initialize Firebase
    const firestoreDb = initializeFirebase();
    const kbService = new KnowledgeBaseService(firestoreDb);

    // Initialize KB service (loads existing entries)
    await kbService.initialize();
    console.log('✅ Knowledge Base Service initialized\n');

    // Track migration results
    let added = 0;
    let skipped = 0;
    let errors = 0;

    // Add each entry
    for (const entry of newKBEntries) {
      try {
        // Check if entry already exists
        const existing = await kbService.getById(entry.id);

        if (existing) {
          console.log(`⏭️  Skipping ${entry.id} - already exists`);
          skipped++;
          continue;
        }

        // Add new entry
        await kbService.add(entry);
        console.log(`✅ Added ${entry.id}: ${entry.title}`);
        added++;

      } catch (error) {
        console.error(`❌ Error adding ${entry.id}:`, error);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Added: ${added}`);
    console.log(`⏭️  Skipped (already exists): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total entries in KB: ${(await kbService.getAll()).length}`);
    console.log('='.repeat(60));

    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify entries in Firestore (toto-bo project)');
    console.log('2. Test RAG service retrieval');
    console.log('3. Refactor CaseAgent to use PromptBuilder');
    console.log('4. Remove hardcoded content from CaseAgent');
    console.log('5. Deploy and test in staging\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migratePromptsToKB()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { migratePromptsToKB, newKBEntries };
