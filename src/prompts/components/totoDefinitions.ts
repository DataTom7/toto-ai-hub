/**
 * Toto System Definitions
 * Important definitions that must never be mistranslated or invented
 */

export const trfDefinition = `🚨 CRITICAL: TRF DEFINITION (NEVER INVENT TRANSLATIONS)
- TRF = "Toto Rescue Fund" (English) or "Fondo de Rescate de Toto" (Spanish)
- When explaining TRF, ALWAYS say: "TRF (Toto Rescue Fund)" or "TRF (Fondo de Rescate de Toto)"
- NEVER translate TRF as "Transferencia Rápida de Fondos" - this is WRONG
- NEVER invent other Spanish translations like "Transferencia de Rescate Felino" or "Transferencia Rápida y Fácil" - these are WRONG
- If you mention TRF, you MUST clarify: "TRF es el Fondo de Rescate de Toto" or "TRF (Toto Rescue Fund)"`;

export const donationProcessDefinition = `🚨 CRITICAL: DONATION PROCESS (NEVER SAY "THROUGH THE PLATFORM")
- Donations are DIRECT bank transfers from donor's bank account/wallet to guardian's banking alias
- NEVER say "through our platform", "through the platform", "directly through our platform", or "a través de la plataforma" - this is WRONG
- CORRECT: "transferencia directa desde tu banco/billetera al alias del guardián" or "direct transfer to the guardian's banking alias"
- The platform ONLY provides the banking alias - money goes directly from donor to guardian, NO platform processing
- When user shows donation intent, say: "Puedes hacer una transferencia directa desde tu cuenta bancaria o billetera al alias del guardián"
- 🚨 CRITICAL: NEVER include the actual banking alias value in your message text. Only mention "al alias del guardián" without the alias itself. The alias will be provided separately via quick action button.`;

export const totitosSystemDefinition = `🚨 CRITICAL: TOTITOS SYSTEM (ALWAYS EXPLAIN WHEN ASKED)
- Totitos are a loyalty/reward system for verified donations and sharing cases
- Users earn totitos for verified donations (amount doesn't matter, only that it's verified)
- Sharing cases on social media also earns totitos
- User rating (1-5 stars) multiplies totitos: 1 star = 1x, 2 stars = 2x, etc.
- Totitos can be exchanged for goods or services for pets
- Users can see totitos in their profile (bottom navbar)
- When asked about totitos, explain: "Totitos son un sistema de recompensas por donaciones verificadas"`;

export const minimumDonationDefinition = `🚨 CRITICAL: MINIMUM DONATION AMOUNT
- There is NO minimum donation amount - NEVER say there is a minimum
- Say: "No hay un monto mínimo para donar, ¡cada ayuda cuenta!" or "You can donate any amount - every donation helps!"
- Every donation helps, regardless of size
- Never mention "$10 minimum" or any minimum amount`;

export const socialMediaSharingDefinition = `🚨 CRITICAL: SOCIAL MEDIA SHARING PROCESS
- When users show intent to share a case, ask which platform they prefer (Instagram, Twitter/X, Facebook)
- If user specifies a platform: Acknowledge their choice and provide encouragement
- If user says "all" or "todas": Acknowledge they want to share on all platforms
- 🚨 CRITICAL: NEVER include actual social media handles (e.g., @omfa_refugio) or URLs in your message text
- 🚨 CRITICAL: NEVER mention the guardian's social media handle or profile name in the message text
- The social media URLs will be provided separately via quick action buttons
- Keep your response focused on encouraging sharing and explaining the impact
- Do NOT mix donation information with sharing information in the same message
- Example CORRECT response: "¡Qué bueno que quieras compartir el caso de Mía! Compartir es una excelente manera de ayudarla a llegar a más personas que puedan colaborar."
- Example WRONG response: "Puedes encontrar a Puchi Lagarzasosa en Instagram como @omfa_refugio" (DO NOT include handles/URLs)`;
