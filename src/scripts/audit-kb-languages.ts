/**
 * KB Language Audit Script
 *
 * Analyzes all existing KB entries to identify:
 * - Bilingual entries (Spanish + English)
 * - English-only entries
 * - Spanish-only entries
 * - Entries that need language conversion
 *
 * Run with: npx ts-node src/scripts/audit-kb-languages.ts
 */

import * as admin from 'firebase-admin';
import { KnowledgeBaseService, KnowledgeItem } from '../services/KnowledgeBaseService';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const totoBoKeyPath = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;

    if (totoBoKeyPath) {
      try {
        const serviceAccount = JSON.parse(totoBoKeyPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        }, 'toto-bo');
        return admin.app('toto-bo').firestore();
      } catch (error) {
        console.error('❌ Failed to initialize with toto-bo credentials');
        throw error;
      }
    } else {
      // Fallback for local development
      const localPaths = [
        path.join(__dirname, '../../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json'),
        path.join(__dirname, '../../toto-bo-firebase-adminsdk-fbsvc-138f229598.json')
      ];

      for (const localPath of localPaths) {
        if (fs.existsSync(localPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          console.log(`✅ Using local service account: ${path.basename(localPath)}`);
          return admin.firestore();
        }
      }

      throw new Error('No Firebase credentials found');
    }
  }
  return admin.firestore();
};

/**
 * Analyze KB entry for language structure
 */
function analyzeLanguageStructure(entry: KnowledgeItem): {
  type: 'bilingual' | 'english-only' | 'spanish-only' | 'mixed' | 'unknown';
  bilingualPatterns: string[];
  needsConversion: boolean;
  suggestions: string[];
} {
  const content = entry.content.toLowerCase();
  const bilingualPatterns: string[] = [];
  const suggestions: string[] = [];

  // Check for bilingual patterns
  const patterns = [
    { pattern: /spanish:|español:/gi, name: 'Spanish label' },
    { pattern: /english:|inglés:/gi, name: 'English label' },
    { pattern: /-\s*spanish:/gi, name: 'Dash Spanish' },
    { pattern: /-\s*english:/gi, name: 'Dash English' },
  ];

  for (const { pattern, name } of patterns) {
    if (pattern.test(content)) {
      bilingualPatterns.push(name);
    }
  }

  // Determine type
  let type: 'bilingual' | 'english-only' | 'spanish-only' | 'mixed' | 'unknown' = 'unknown';

  if (bilingualPatterns.length > 0) {
    type = 'bilingual';
    suggestions.push('Convert to English-only with tone guidance');
    suggestions.push('Remove language labels (Spanish:/English:)');
    suggestions.push('Add cultural notes to metadata instead');
  } else {
    // Check content for language hints
    const hasEnglishWords = /\b(the|is|are|when|user|response|example)\b/i.test(content);
    const hasSpanishWords = /\b(cuando|usuario|respuesta|ejemplo|el|la|los)\b/i.test(content);

    if (hasEnglishWords && !hasSpanishWords) {
      type = 'english-only';
      suggestions.push('Already English-only ✅');
      suggestions.push('Consider adding cultural notes for Spanish/Portuguese');
    } else if (hasSpanishWords && !hasEnglishWords) {
      type = 'spanish-only';
      suggestions.push('Convert to English');
      suggestions.push('Add Spanish cultural notes to metadata');
    } else if (hasEnglishWords && hasSpanishWords) {
      type = 'mixed';
      suggestions.push('Analyze manually - mixed content detected');
    }
  }

  const needsConversion = type === 'bilingual' || type === 'spanish-only' || type === 'mixed';

  return {
    type,
    bilingualPatterns,
    needsConversion,
    suggestions
  };
}

/**
 * Main audit function
 */
async function auditKBLanguages() {
  console.log('🔍 Starting KB Language Audit\n');

  try {
    // Initialize Firebase
    const firestoreDb = initializeFirebase();
    const kbService = new KnowledgeBaseService(firestoreDb);

    // Initialize KB service
    await kbService.initialize();
    console.log('✅ KB Service initialized\n');

    // Get all entries
    const allEntries = await kbService.getAll();
    console.log(`📊 Total KB entries: ${allEntries.length}\n`);

    // Analyze each entry
    const results: {
      entry: KnowledgeItem;
      analysis: ReturnType<typeof analyzeLanguageStructure>;
    }[] = [];

    for (const entry of allEntries) {
      const analysis = analyzeLanguageStructure(entry);
      results.push({ entry, analysis });
    }

    // Group by type
    const byType = {
      'bilingual': results.filter(r => r.analysis.type === 'bilingual'),
      'english-only': results.filter(r => r.analysis.type === 'english-only'),
      'spanish-only': results.filter(r => r.analysis.type === 'spanish-only'),
      'mixed': results.filter(r => r.analysis.type === 'mixed'),
      'unknown': results.filter(r => r.analysis.type === 'unknown')
    };

    // Print summary
    console.log('=' .repeat(80));
    console.log('📊 LANGUAGE STRUCTURE SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ English-only entries: ${byType['english-only'].length}`);
    console.log(`⚠️  Bilingual entries (need conversion): ${byType['bilingual'].length}`);
    console.log(`⚠️  Spanish-only entries (need conversion): ${byType['spanish-only'].length}`);
    console.log(`❓ Mixed entries (need manual review): ${byType['mixed'].length}`);
    console.log(`❓ Unknown entries: ${byType['unknown'].length}`);
    console.log('='.repeat(80));
    console.log();

    // Print details for entries that need conversion
    if (byType['bilingual'].length > 0) {
      console.log('🔴 BILINGUAL ENTRIES (Need Conversion)');
      console.log('='.repeat(80));
      for (const { entry, analysis } of byType['bilingual']) {
        console.log(`\n📄 ${entry.id}`);
        console.log(`   Title: ${entry.title}`);
        console.log(`   Category: ${entry.category}`);
        console.log(`   Patterns found: ${analysis.bilingualPatterns.join(', ')}`);
        console.log(`   Suggestions:`);
        for (const suggestion of analysis.suggestions) {
          console.log(`     - ${suggestion}`);
        }
        console.log(`   Content preview: ${entry.content.substring(0, 100)}...`);
      }
      console.log();
    }

    if (byType['spanish-only'].length > 0) {
      console.log('🟡 SPANISH-ONLY ENTRIES (Need Translation)');
      console.log('='.repeat(80));
      for (const { entry, analysis } of byType['spanish-only']) {
        console.log(`\n📄 ${entry.id}`);
        console.log(`   Title: ${entry.title}`);
        console.log(`   Category: ${entry.category}`);
        console.log(`   Suggestions:`);
        for (const suggestion of analysis.suggestions) {
          console.log(`     - ${suggestion}`);
        }
        console.log(`   Content preview: ${entry.content.substring(0, 100)}...`);
      }
      console.log();
    }

    if (byType['mixed'].length > 0) {
      console.log('🟠 MIXED ENTRIES (Manual Review Needed)');
      console.log('='.repeat(80));
      for (const { entry, analysis } of byType['mixed']) {
        console.log(`\n📄 ${entry.id}`);
        console.log(`   Title: ${entry.title}`);
        console.log(`   Category: ${entry.category}`);
        console.log(`   Content preview: ${entry.content.substring(0, 150)}...`);
      }
      console.log();
    }

    if (byType['english-only'].length > 0) {
      console.log('🟢 ENGLISH-ONLY ENTRIES (Good!)');
      console.log('='.repeat(80));
      for (const { entry } of byType['english-only']) {
        console.log(`   ✅ ${entry.id} - ${entry.title}`);
      }
      console.log();
    }

    // Generate conversion plan
    const needsConversion = results.filter(r => r.analysis.needsConversion);

    if (needsConversion.length > 0) {
      console.log('='.repeat(80));
      console.log('📋 CONVERSION PLAN');
      console.log('='.repeat(80));
      console.log(`Total entries to convert: ${needsConversion.length}`);
      console.log();
      console.log('Options:');
      console.log('1. Create conversion script (recommended)');
      console.log('2. Manual conversion via toto-bo dashboard');
      console.log('3. Export entries, convert offline, re-import');
      console.log();
      console.log('Recommended: Create conversion script that:');
      console.log('  - Detects bilingual patterns');
      console.log('  - Extracts English content');
      console.log('  - Moves Spanish examples to cultural notes');
      console.log('  - Preserves all metadata');
      console.log('  - Updates entries in Firestore');
      console.log('='.repeat(80));
    } else {
      console.log('🎉 All entries are already in optimal format!');
    }

    // Save results to file
    const resultsPath = path.join(__dirname, '../../kb-language-audit-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: allEntries.length,
        'english-only': byType['english-only'].length,
        'bilingual': byType['bilingual'].length,
        'spanish-only': byType['spanish-only'].length,
        'mixed': byType['mixed'].length,
        'unknown': byType['unknown'].length,
        needsConversion: needsConversion.length
      },
      details: results.map(r => ({
        id: r.entry.id,
        title: r.entry.title,
        category: r.entry.category,
        type: r.analysis.type,
        needsConversion: r.analysis.needsConversion,
        patterns: r.analysis.bilingualPatterns,
        suggestions: r.analysis.suggestions
      }))
    }, null, 2));

    console.log(`\n✅ Results saved to: ${resultsPath}`);
    console.log('\n🎯 Next steps:');
    console.log('1. Review the audit results');
    console.log('2. Decide on conversion strategy');
    console.log('3. Run conversion script (if needed)');
    console.log('4. Test with multiple languages');

  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run audit
if (require.main === module) {
  auditKBLanguages()
    .then(() => {
      console.log('\n✅ Audit completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Audit failed:', error);
      process.exit(1);
    });
}

export { auditKBLanguages, analyzeLanguageStructure };
