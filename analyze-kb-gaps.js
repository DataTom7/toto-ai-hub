// Script to analyze conversation and identify KB gaps
// Simulates a conversation to see what information the agent needs

const conversation = [
  {
    user: "¡Hola! Te presento a Chloe. Chloe es una perra desnutrida encontrada en mal estado. Necesita apoyo nutricional y cuidados médicos. ¿Te gustaría ayudar a Chloe?",
    agent: "[Welcome message - should be brief]"
  },
  {
    user: "Quiero donar.",
    agent: "[Should explain donation process once, mention alias, no minimum, offer totitos info]"
  },
  {
    user: "Si, claro. Qué son?",
    agent: "[Should explain totitos - what they are, how to earn them, where to see them]"
  },
  {
    user: "Si.",
    agent: "[Should explain verification process - how to upload receipt, when verification happens, what happens after]"
  },
  {
    user: "Dale.",
    agent: "[Should provide step-by-step verification instructions - NOT repeat donation process]"
  },
  {
    user: "Si.",
    agent: "[Should move forward - maybe ask if they want to share, or confirm they understand, NOT repeat again]"
  }
];

// What information does the agent need at each step?
const requiredKnowledge = {
  step1_welcome: {
    needed: [
      "How to introduce a case (brief, warm, 2-3 sentences)",
      "What NOT to include in welcome (don't repeat case name unnecessarily)"
    ],
    kbEntries: ["kb-cases-001", "kb-cases-002"]
  },
  step2_donation_intent: {
    needed: [
      "Donation process explanation (one time only)",
      "When to mention alias (once, via quick action)",
      "No minimum amount",
      "How to transition to totitos explanation"
    ],
    kbEntries: ["kb-donations-001", "kb-donations-013"]
  },
  step3_totitos_explanation: {
    needed: [
      "What totitos are",
      "How to earn them (verified donations, sharing)",
      "Where to see them (profile)",
      "How rating multiplies them",
      "What they can be used for"
    ],
    kbEntries: ["kb-donations-014"]
  },
  step4_verification_interest: {
    needed: [
      "How verification works",
      "When to upload receipt (after donation)",
      "Where to upload (in chat dialog)",
      "What happens after upload (weekly review with guardian)",
      "What happens after verification (totitos earned)"
    ],
    kbEntries: ["kb-donations-002"]
  },
  step5_verification_steps: {
    needed: [
      "Step-by-step verification process",
      "What to upload (receipt, screenshot, bank document)",
      "How to upload (in chat dialog)",
      "Timeline (weekly verification)",
      "What to expect (notification when verified)"
    ],
    kbEntries: ["kb-donations-002"]
  },
  step6_progression: {
    needed: [
      "How to avoid repetition",
      "When to move conversation forward",
      "What to suggest next (sharing, other cases, etc.)",
      "How to confirm understanding without repeating"
    ],
    kbEntries: ["kb-conversation-001"] // This might be missing!
  }
};

// Analyze what's missing
console.log("🔍 Analyzing KB Gaps from Conversation\n");
console.log("=".repeat(60));

const gaps = [];

conversation.forEach((turn, index) => {
  const step = `step${index + 1}`;
  const knowledge = requiredKnowledge[step];
  
  if (knowledge) {
    console.log(`\n📝 Step ${index + 1}: ${turn.user.substring(0, 50)}...`);
    console.log(`   Agent needs: ${knowledge.needed.length} pieces of information`);
    console.log(`   KB entries: ${knowledge.kbEntries.join(", ")}`);
    
    // Check if conversation progression KB exists
    if (index >= 3 && !knowledge.kbEntries.includes("kb-conversation-001")) {
      gaps.push({
        step: index + 1,
        issue: "No KB entry for conversation progression/avoiding repetition",
        needed: "General guidelines on when to move forward vs repeat information"
      });
    }
  }
});

console.log("\n" + "=".repeat(60));
console.log("\n🚨 Identified KB Gaps:\n");

if (gaps.length === 0) {
  console.log("✅ No obvious gaps found!");
} else {
  gaps.forEach((gap, i) => {
    console.log(`${i + 1}. Step ${gap.step}: ${gap.issue}`);
    console.log(`   Needed: ${gap.needed}\n`);
  });
}

// Suggested KB entries
console.log("\n💡 Suggested New KB Entries:\n");

const suggestedEntries = [
  {
    id: "kb-conversation-001",
    title: "Conversation Progression and Avoiding Repetition",
    category: "conversation",
    content: `GENERAL PRINCIPLE: Each message should advance the conversation forward. Never repeat information you've already provided.

WHEN TO REPEAT:
- Only if user explicitly asks "can you repeat that?" or "what was that again?"
- If user seems confused and asks for clarification
- Never repeat just because user says "Si" or "Ok" after you've explained something

WHEN TO MOVE FORWARD:
- After explaining donation process: Ask about verification or sharing
- After explaining totitos: Ask if they want to verify donation or share case
- After explaining verification: Confirm understanding and suggest next action
- If user says "Si" after you've explained something: Acknowledge and move to next step

CONVERSATION FLOW:
1. Welcome → Case intro (brief)
2. Donation intent → Explain donation process (once)
3. Totitos question → Explain totitos
4. Verification interest → Explain verification process
5. Ready to verify → Provide step-by-step instructions
6. Confirmation → Move forward (suggest sharing, other cases, or close)

AVOID:
- Repeating donation instructions multiple times
- Repeating case information after welcome
- Asking the same question multiple times
- Going in circles with the same information`
  },
  {
    id: "kb-conversation-002",
    title: "Handling Affirmative Responses",
    category: "conversation",
    content: `When user says "Si", "Sí", "Ok", "Dale", "Claro", etc.:

CONTEXT MATTERS:
- If you just explained something: Acknowledge and move to next step
- If you asked a question: Treat as "yes" to that question
- If you offered to explain: Proceed with explanation
- If you already explained: Don't repeat, move forward

EXAMPLES:
- "¿Te gustaría saber cómo verificar?" → User: "Si" → Explain verification
- "Puedes hacer una transferencia..." → User: "Si" → Ask about verification or sharing
- After explaining totitos → User: "Si" → Ask if they want to verify donation

NEVER:
- Repeat the same explanation you just gave
- Ask the same question again
- Assume "Si" means "repeat everything"`
  },
  {
    id: "kb-donations-015",
    title: "Donation Verification Step-by-Step Guide",
    category: "donations",
    content: `STEP-BY-STEP VERIFICATION PROCESS:

STEP 1: Make the donation
- User transfers money to guardian's banking alias
- No minimum amount required
- Transfer happens directly (not through platform)

STEP 2: Upload receipt (optional but recommended)
- User uploads receipt/comprobante in the chat dialog
- Can be: bank document, wallet receipt, screenshot
- Upload happens in same chat where they're talking to agent

STEP 3: Wait for verification
- Verification happens weekly with guardian
- Guardian reviews and approves donations
- Cross-checks with their records

STEP 4: Receive notification
- User gets automatic notification when verified
- Can also be verified by guardian independently

STEP 5: Earn totitos
- Once verified, totitos are automatically added
- Amount multiplied by user's rating (1-5 stars)
- Can see totitos in profile (bottom navbar)

IMPORTANT:
- Verification is optional but recommended
- No penalties for unverified donations
- Donations still help the cause even if not verified
- Guardian can verify independently if user forgets to upload`
  }
];

suggestedEntries.forEach((entry, i) => {
  console.log(`${i + 1}. ${entry.id}: ${entry.title}`);
  console.log(`   Category: ${entry.category}`);
  console.log(`   Content preview: ${entry.content.substring(0, 100)}...\n`);
});

console.log("\n" + "=".repeat(60));
console.log("\n✅ Analysis complete!");
console.log("\nNext steps:");
console.log("1. Review suggested KB entries");
console.log("2. Add entries to KB (via TotoAPIGateway or directly)");
console.log("3. Test conversation again to see improvement");

