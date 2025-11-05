/**
 * Script to reprocess existing social media posts and extract guardian insights
 * 
 * Usage: node scripts/reprocess-guardian-insights.js [guardianId]
 * 
 * If guardianId is provided, only processes that guardian's posts.
 * Otherwise, processes all guardians.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
let app;
try {
  // Try to get existing app first
  app = admin.app();
  console.log('✅ Using existing Firebase Admin app');
} catch (error) {
  try {
    let serviceAccount = null;
    
    // Try environment variable first (for production)
    const serviceAccountJson = process.env.TOTO_APP_STG_SERVICE_ACCOUNT_KEY;
    if (serviceAccountJson) {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log('✅ Using service account from environment variable');
    } else {
      // Try local file (for development)
      const serviceAccountPath = path.join(__dirname, '../toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(serviceAccountFile);
        console.log('✅ Using local service account file');
      } else {
        throw new Error('No service account found');
      }
    }
    
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'toto-f9d2f-stg'
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin:', err.message);
    console.error('   Make sure TOTO_APP_STG_SERVICE_ACCOUNT_KEY is set or');
    console.error('   toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json exists in toto-ai-hub root');
    process.exit(1);
  }
}

const db = app.firestore();

// Simple extraction functions (matching GuardianInsightsService logic)
function extractPaymentInfo(postContent) {
  const bankingAliases = [];
  const whatsappNumbers = [];
  const phoneNumbers = [];

  const content = postContent.toLowerCase();

  // Extract Mercado Pago aliases
  const mpPatterns = [
    /alias\s*mercado\s*pago[:\s]*([a-z0-9._-]+)/gi,
    /mp[:\s]*([a-z0-9._-]+)/gi,
    /mercado\s*pago[:\s]*([a-z0-9._-]+)/gi,
  ];
  mpPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const alias = match[1]?.trim();
      if (alias && alias.length > 3 && alias.length < 50) {
        bankingAliases.push({
          value: alias,
          type: 'mercado_pago',
          confidence: 0.9
        });
      }
    }
  });

  // Extract Banco Nación aliases
  const bnPatterns = [
    /alias\s*banco\s*nacion[:\s]*([a-z0-9._-]+)/gi,
    /banco\s*nacion[:\s]*([a-z0-9._-]+)/gi,
    /bn[:\s]*([a-z0-9._-]+)/gi,
  ];
  bnPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const alias = match[1]?.trim();
      if (alias && alias.length > 3 && alias.length < 50) {
        bankingAliases.push({
          value: alias,
          type: 'banco_nacion',
          confidence: 0.9
        });
      }
    }
  });

  // Extract PayPal
  const paypalPatterns = [
    /paypal[:\s]*([a-z0-9._@-]+)/gi,
    /paypal[:\s]*([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/gi,
  ];
  paypalPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const value = match[1]?.trim();
      if (value && value.length > 3) {
        bankingAliases.push({
          value: value,
          type: 'paypal',
          confidence: 0.85
        });
      }
    }
  });

  // Extract WhatsApp numbers
  const whatsappPatterns = [
    /whatsapp[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
    /wa[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
    /(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/g,
    /(\d{2,4}\s*\d{4}\s*\d{4})/g,
  ];
  whatsappPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const number = match[1]?.trim().replace(/\s+/g, '');
      if (number && number.length >= 10 && number.length <= 15) {
        whatsappNumbers.push({
          value: number,
          confidence: pattern.source.includes('whatsapp') || pattern.source.includes('wa') ? 0.9 : 0.7
        });
      }
    }
  });

  // Extract phone numbers
  const phonePatterns = [
    /tel[éfono]?[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
    /contacto[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
  ];
  phonePatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const number = match[1]?.trim().replace(/\s+/g, '');
      if (number && number.length >= 10 && number.length <= 15) {
        phoneNumbers.push({
          value: number,
          confidence: 0.8
        });
      }
    }
  });

  // Remove duplicates
  const uniqueAliases = Array.from(
    new Map(bankingAliases.map(a => [a.value.toLowerCase(), a])).values()
  );
  const uniqueWhatsApp = Array.from(
    new Map(whatsappNumbers.map(w => [w.value.replace(/\s+/g, ''), w])).values()
  );
  const uniquePhones = Array.from(
    new Map(phoneNumbers.map(p => [p.value.replace(/\s+/g, ''), p])).values()
  );

  return {
    bankingAliases: uniqueAliases,
    whatsappNumbers: uniqueWhatsApp,
    phoneNumbers: uniquePhones
  };
}

function analyzeBehavioralPatterns(posts) {
  if (posts.length === 0) {
    return {
      postingFrequency: 'irregular',
      communicationStyle: 'casual',
      commonTopics: [],
      engagementLevel: 'low',
      preferredPlatform: 'twitter'
    };
  }

  const now = new Date();
  const postsLast30Days = posts.filter(p => {
    const postDate = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
    const daysDiff = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30;
  }).length;

  let postingFrequency;
  if (postsLast30Days >= 20) {
    postingFrequency = 'daily';
  } else if (postsLast30Days >= 4) {
    postingFrequency = 'weekly';
  } else if (postsLast30Days >= 1) {
    postingFrequency = 'monthly';
  } else {
    postingFrequency = 'irregular';
  }

  const allContent = posts.map(p => p.postContent.toLowerCase()).join(' ');
  let communicationStyle;
  
  const emotionalWords = ['❤', '💔', '😢', '😟', '❤️', '💖', '🐾', '🐶', '😭'];
  const formalWords = ['solicitamos', 'requerimos', 'informamos', 'comunicamos'];
  const casualWords = ['hola', 'chicos', 'amigos', 'gente'];
  
  const emotionalCount = emotionalWords.filter(w => allContent.includes(w)).length;
  const formalCount = formalWords.filter(w => allContent.includes(w)).length;
  const casualCount = casualWords.filter(w => allContent.includes(w)).length;
  
  if (emotionalCount > 5) {
    communicationStyle = 'emotional';
  } else if (formalCount > casualCount) {
    communicationStyle = 'formal';
  } else if (allContent.includes('refugio') || allContent.includes('rescue')) {
    communicationStyle = 'professional';
  } else {
    communicationStyle = 'casual';
  }

  const topicKeywords = {};
  const commonWords = ['alimento', 'comida', 'tratamiento', 'veterinario', 'rescate', 'adopción', 'donación', 'ayuda', 'emergencia', 'casita'];
  commonWords.forEach(word => {
    const count = (allContent.match(new RegExp(word, 'g')) || []).length;
    if (count > 0) {
      topicKeywords[word] = count;
    }
  });
  const commonTopics = Object.entries(topicKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  const avgPostLength = posts.reduce((sum, p) => sum + p.postContent.length, 0) / posts.length;
  let engagementLevel;
  if (posts.length > 10 && avgPostLength > 200) {
    engagementLevel = 'high';
  } else if (posts.length > 5 || avgPostLength > 100) {
    engagementLevel = 'medium';
  } else {
    engagementLevel = 'low';
  }

  const twitterCount = posts.filter(p => p.platform === 'twitter').length;
  const instagramCount = posts.filter(p => p.platform === 'instagram').length;
  let preferredPlatform;
  if (twitterCount > instagramCount * 1.5) {
    preferredPlatform = 'twitter';
  } else if (instagramCount > twitterCount * 1.5) {
    preferredPlatform = 'instagram';
  } else {
    preferredPlatform = 'both';
  }

  return {
    postingFrequency,
    communicationStyle,
    commonTopics,
    engagementLevel,
    preferredPlatform
  };
}

async function processGuardianInsights(guardianId) {
  console.log(`\n🔍 Processing insights for guardian: ${guardianId}`);

  // Fetch all posts for this guardian
  let query = db.collection('socialMediaPosts').where('guardianId', '==', guardianId);
  const snapshot = await query.limit(1000).get(); // Get up to 1000 posts

  if (snapshot.empty) {
    console.log(`   ⚠️ No posts found for guardian ${guardianId}`);
    return;
  }

  const posts = snapshot.docs.map(doc => {
    const data = doc.data();
    
    // Handle createdAt - could be Firestore Timestamp, Date, string, or number
    let createdAt = new Date();
    if (data.createdAt) {
      if (typeof data.createdAt.toDate === 'function') {
        // Firestore Timestamp
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else if (typeof data.createdAt === 'string') {
        createdAt = new Date(data.createdAt);
      } else if (typeof data.createdAt === 'number') {
        createdAt = new Date(data.createdAt);
      }
    }
    
    return {
      id: doc.id,
      platform: data.platform,
      postContent: data.postContent || '',
      postUrl: data.postUrl,
      createdAt
    };
  });

  console.log(`   📊 Found ${posts.length} posts`);

  // Extract payment info from all posts
  const paymentMethods = {
    bankingAliases: [],
    whatsappNumbers: [],
    phoneNumbers: []
  };

  const seenAliases = new Set();
  const seenWhatsApp = new Set();
  const seenPhones = new Set();

  for (const post of posts) {
    const extracted = extractPaymentInfo(post.postContent);
    
    extracted.bankingAliases.forEach(alias => {
      const key = alias.value.toLowerCase();
      if (!seenAliases.has(key)) {
        seenAliases.add(key);
        paymentMethods.bankingAliases.push({
          value: alias.value,
          type: alias.type,
          verified: false,
          source: post.postUrl || post.id,
          confidence: alias.confidence,
          extractedAt: post.createdAt
        });
      }
    });

    extracted.whatsappNumbers.forEach(wa => {
      const key = wa.value.replace(/\s+/g, '');
      if (!seenWhatsApp.has(key)) {
        seenWhatsApp.add(key);
        paymentMethods.whatsappNumbers.push({
          value: wa.value,
          verified: false,
          source: post.postUrl || post.id,
          confidence: wa.confidence,
          extractedAt: post.createdAt
        });
      }
    });

    extracted.phoneNumbers.forEach(phone => {
      const key = phone.value.replace(/\s+/g, '');
      if (!seenPhones.has(key)) {
        seenPhones.add(key);
        paymentMethods.phoneNumbers.push({
          value: phone.value,
          verified: false,
          source: post.postUrl || post.id,
          confidence: phone.confidence,
          extractedAt: post.createdAt
        });
      }
    });
  }

  // Analyze behavioral patterns
  const behavioralPatterns = analyzeBehavioralPatterns(posts);

  // Check if insights already exist
  const insightsRef = db.collection('guardianInsights').doc(guardianId);
  const existingInsights = await insightsRef.get();

  let finalPaymentMethods = paymentMethods;
  if (existingInsights.exists) {
    const existing = existingInsights.data();
    if (existing.paymentMethods) {
      // Merge with existing (preserve verified info)
      const existingAliases = new Map(
        existing.paymentMethods.bankingAliases?.map(a => [a.value.toLowerCase(), a]) || []
      );
      const existingWhatsApp = new Map(
        existing.paymentMethods.whatsappNumbers?.map(w => [w.value.replace(/\s+/g, ''), w]) || []
      );
      const existingPhones = new Map(
        existing.paymentMethods.phoneNumbers?.map(p => [p.value.replace(/\s+/g, ''), p]) || []
      );

      // Add new aliases if not already present
      paymentMethods.bankingAliases.forEach(alias => {
        const key = alias.value.toLowerCase();
        if (!existingAliases.has(key)) {
          existingAliases.set(key, alias);
        }
      });

      paymentMethods.whatsappNumbers.forEach(wa => {
        const key = wa.value.replace(/\s+/g, '');
        if (!existingWhatsApp.has(key)) {
          existingWhatsApp.set(key, wa);
        }
      });

      paymentMethods.phoneNumbers.forEach(phone => {
        const key = phone.value.replace(/\s+/g, '');
        if (!existingPhones.has(key)) {
          existingPhones.set(key, phone);
        }
      });

      finalPaymentMethods = {
        bankingAliases: Array.from(existingAliases.values()),
        whatsappNumbers: Array.from(existingWhatsApp.values()),
        phoneNumbers: Array.from(existingPhones.values())
      };
    }
  }

  // Save insights
  const insightData = {
    guardianId,
    extractedAt: admin.firestore.FieldValue.serverTimestamp(),
    paymentMethods: finalPaymentMethods,
    behavioralPatterns,
    lastAnalyzed: admin.firestore.FieldValue.serverTimestamp(),
    totalPostsAnalyzed: posts.length,
    insightsVersion: 1
  };

  await insightsRef.set(insightData, { merge: true });

  console.log(`   ✅ Saved insights for guardian ${guardianId}`);
  console.log(`      - Banking Aliases: ${finalPaymentMethods.bankingAliases.length}`);
  console.log(`      - WhatsApp Numbers: ${finalPaymentMethods.whatsappNumbers.length}`);
  console.log(`      - Phone Numbers: ${finalPaymentMethods.phoneNumbers.length}`);
  console.log(`      - Behavioral Patterns: ${JSON.stringify(behavioralPatterns)}`);
}

async function main() {
  const guardianId = process.argv[2];

  try {
    if (guardianId) {
      // Process specific guardian
      await processGuardianInsights(guardianId);
    } else {
      // Process all guardians
      console.log('🔍 Fetching all guardians from posts...');
      
      // Get unique guardian IDs from posts
      const postsSnapshot = await db.collection('socialMediaPosts')
        .select('guardianId')
        .get();
      
      const guardianIds = new Set();
      postsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.guardianId) {
          guardianIds.add(data.guardianId);
        }
      });

      console.log(`📊 Found ${guardianIds.size} unique guardian(s) with posts\n`);

      let processed = 0;
      let failed = 0;

      for (const gId of guardianIds) {
        try {
          await processGuardianInsights(gId);
          processed++;
        } catch (error) {
          console.error(`   ❌ Error processing guardian ${gId}:`, error);
          failed++;
        }
      }

      console.log(`\n✅ Processing complete!`);
      console.log(`   - Processed: ${processed}`);
      console.log(`   - Failed: ${failed}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();

