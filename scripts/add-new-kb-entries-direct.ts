import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const newEntries = [
  {
    id: 'kb-donations-installments',
    title: 'Donation Payment Methods and Installments',
    content: 'CURRENT PAYMENT METHODS\n- Direct bank transfers only (one-time donations)\n- Transfer from your bank account or wallet to guardian\'s banking alias\n- Immediate, simple, and secure\n\nINSTALLMENT DONATIONS (FREQUENTLY ASKED)\n- Currently: Only one-time transfers available\n- Why: Guardian banking aliases receive immediate transfers, not recurring payments\n- Coming soon: Credit card installments (estimated Q1 2026)\n\nALTERNATIVES FOR MULTIPLE DONATIONS\n- You can make multiple smaller donations over time\n- Each donation earns totitos separately\n- Multiple donations = more totitos earned!\n- No minimum amount - donate what you can, when you can\n\nBENEFITS OF CURRENT SYSTEM\n- 100% goes directly to guardian (no fees)\n- Instant transfer to pet\'s care\n- Simple and transparent\n- Earn totitos for each verified donation',
    category: 'donations',
    agentTypes: ['CaseAgent'],
    audience: ['donors'],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'kb-sharing-guidelines',
    title: 'Social Media Sharing Guidelines and Best Practices',
    content: 'PLATFORM-SPECIFIC SHARING\n\nINSTAGRAM:\n- Best for: Visual stories and image-focused posts\n- Use Stories or Feed posts with case photo\n- Include case name and urgent need\n- Tag guardian\'s Instagram if available\n- Add hashtags: #Rescate #AdoptaNoCompres #Ayuda\n\nTWITTER:\n- Best for: Rapid sharing and viral potential\n- Keep message concise (280 characters)\n- Use impactful hashtags: #Rescate #Urgente #Ayuda\n- Include case photo and direct link\n- Retweet from guardian\'s account if available\n\nFACEBOOK:\n- Best for: Community groups and local reach\n- Share in pet adoption/rescue groups\n- Include detailed case information\n- Post in local community groups\n- Encourage friends to share\n\nHOW SHARING WORKS IN TOTO:\n- Click platform button (Instagram/Twitter/Facebook)\n- Platform opens with case URL ready to share\n- Case URL includes: case name, photo, description, donation link\n- Your share helps reach more potential donors and adopters\n\nWHY SHARING HELPS:\n- Increases case visibility\n- Reaches potential donors who care\n- Builds community support\n- You earn totitos for sharing (same as donations)\n- Even if people can\'t donate, they might share further',
    category: 'social',
    agentTypes: ['CaseAgent'],
    audience: ['all'],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    usageCount: 0,
  },
];

async function main() {
  console.log('Adding 2 new KB entries...\n');

  for (const entry of newEntries) {
    console.log(`Adding: ${entry.id} - ${entry.title}`);
    await db.collection('shared-knowledge-base').doc(entry.id).set(entry);
    console.log(`✅ Added successfully\n`);
  }

  console.log('✅ All entries added!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
