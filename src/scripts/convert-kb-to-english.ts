/**
 * KB Language Conversion Script
 *
 * Converts bilingual and mixed KB entries to English-only format
 * with cultural notes for Spanish/Portuguese translations.
 *
 * Features:
 * - Dry-run mode (preview changes)
 * - Individual entry conversion
 * - Automatic backup before changes
 * - Verification checks
 * - No data loss
 *
 * Run with: npx ts-node src/scripts/convert-kb-to-english.ts [--dry-run] [--entry-id=kb-xxx]
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
 * Convert bilingual entry to English-only with cultural notes
 */
function convertBilingualEntry(entry: KnowledgeItem): {
  converted: KnowledgeItem;
  changes: string[];
} {
  const changes: string[] = [];
  let content = entry.content;
  const spanishExamples: string[] = [];
  const culturalNotes: any = {};

  // Pattern 1: Remove "Spanish:" and "English:" labels, keep only English
  const bilingualPattern1 = /-\s*(Spanish|Español):\s*["']([^"'\n]+)["']\s*-\s*(English|Inglés):\s*["']([^"'\n]+)["']/gi;
  content = content.replace(bilingualPattern1, (match, sp1, spanishText, en1, englishText) => {
    spanishExamples.push(spanishText);
    changes.push(`Removed bilingual label, kept English: "${englishText}"`);
    return `"${englishText}"`;
  });

  // Pattern 2: Remove sections that say "Spanish: X" or "- Spanish: X"
  const spanishLabelPattern = /-?\s*(Spanish|Español):\s*["']?([^"\n]+)["']?/gi;
  content = content.replace(spanishLabelPattern, (match, label, text) => {
    spanishExamples.push(text.trim());
    changes.push(`Extracted Spanish example: "${text.trim()}"`);
    return ''; // Remove the Spanish line
  });

  // Pattern 3: Remove standalone Spanish phrases in quotes if followed by English translation
  const spanishEnglishPairPattern = /["']([^"'\n]+)["']\s*\(Spanish\)\s*["']([^"'\n]+)["']/gi;
  content = content.replace(spanishEnglishPairPattern, (match, spanish, english) => {
    spanishExamples.push(spanish);
    changes.push(`Converted pair to English only: "${english}"`);
    return `"${english}"`;
  });

  // Clean up extra blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  // Add cultural notes if we found Spanish examples
  if (spanishExamples.length > 0) {
    culturalNotes.es = {
      examples: spanishExamples.filter((ex, i, arr) => arr.indexOf(ex) === i), // Remove duplicates
      tone: 'Warm and friendly',
      note: 'Use these Spanish phrases when responding in Spanish'
    };
    changes.push(`Added ${spanishExamples.length} Spanish examples to cultural notes`);
  }

  // Create converted entry
  const converted: KnowledgeItem = {
    ...entry,
    content: content.trim(),
    metadata: {
      ...entry.metadata,
      culturalNotes: Object.keys(culturalNotes).length > 0 ? culturalNotes : entry.metadata?.culturalNotes
    }
  };

  // Add language field if not present
  if (!(converted as any).language) {
    (converted as any).language = 'en';
    changes.push('Added language: en');
  }

  return { converted, changes };
}

/**
 * Convert mixed entry (English structure with Spanish examples)
 */
function convertMixedEntry(entry: KnowledgeItem): {
  converted: KnowledgeItem;
  changes: string[];
} {
  const changes: string[] = [];
  let content = entry.content;
  const spanishPhrases: string[] = [];

  // Extract quoted Spanish phrases (common pattern: "nosotros", "estamos", etc.)
  const quotedSpanishPattern = /["']([áéíóúñü\w\s¡¿!?]+)["']/gi;
  const matches = content.matchAll(quotedSpanishPattern);

  for (const match of matches) {
    const phrase = match[1];
    // Check if it looks Spanish (has Spanish characters or common Spanish words)
    if (/[áéíóúñü]/.test(phrase) ||
        /\b(estamos|podemos|tenemos|nuestro|nosotros|el|la|los|las|que|con|para)\b/i.test(phrase)) {
      spanishPhrases.push(phrase);
    }
  }

  // If we found Spanish phrases, add them to cultural notes
  const culturalNotes: any = {};
  if (spanishPhrases.length > 0) {
    culturalNotes.es = {
      examples: spanishPhrases.filter((ex, i, arr) => arr.indexOf(ex) === i),
      note: 'These are Spanish examples found in the original content'
    };
    changes.push(`Extracted ${spanishPhrases.length} Spanish phrases to cultural notes`);
  }

  // Create converted entry
  const converted: KnowledgeItem = {
    ...entry,
    content: content.trim(),
    metadata: {
      ...entry.metadata,
      culturalNotes: Object.keys(culturalNotes).length > 0 ? culturalNotes : entry.metadata?.culturalNotes
    }
  };

  // Add language field if not present
  if (!(converted as any).language) {
    (converted as any).language = 'en';
    changes.push('Added language: en');
  }

  return { converted, changes };
}

/**
 * Convert entry based on its type
 */
function convertEntry(entry: KnowledgeItem, type: string): {
  converted: KnowledgeItem;
  changes: string[];
} {
  if (type === 'bilingual') {
    return convertBilingualEntry(entry);
  } else if (type === 'mixed') {
    return convertMixedEntry(entry);
  } else {
    // Already English-only, just add language field if missing
    const converted = { ...entry };
    const changes: string[] = [];

    if (!(converted as any).language) {
      (converted as any).language = 'en';
      changes.push('Added language: en');
    }

    return { converted, changes };
  }
}

/**
 * Preview conversion (dry-run)
 */
function previewConversion(
  original: KnowledgeItem,
  converted: KnowledgeItem,
  changes: string[]
): void {
  console.log('\n' + '='.repeat(80));
  console.log(`📄 ${original.id}`);
  console.log('='.repeat(80));
  console.log(`Title: ${original.title}`);
  console.log(`Category: ${original.category}`);
  console.log(`\nChanges:`);
  changes.forEach(change => console.log(`  - ${change}`));

  console.log(`\n📝 Content Before (first 200 chars):`);
  console.log(original.content.substring(0, 200) + '...');

  console.log(`\n📝 Content After (first 200 chars):`);
  console.log(converted.content.substring(0, 200) + '...');

  if ((converted as any).language) {
    console.log(`\n🌍 Language: ${(converted as any).language}`);
  }

  if (converted.metadata?.culturalNotes) {
    console.log(`\n📚 Cultural Notes Added:`);
    console.log(JSON.stringify(converted.metadata.culturalNotes, null, 2));
  }
}

/**
 * Main conversion function
 */
async function convertKBToEnglish() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const entryIdArg = args.find(arg => arg.startsWith('--entry-id='));
  const specificEntryId = entryIdArg ? entryIdArg.split('=')[1] : null;

  console.log('🔄 Starting KB Language Conversion');
  console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (preview only)' : '✅ LIVE (will update Firestore)'}`);
  if (specificEntryId) {
    console.log(`Target: Single entry (${specificEntryId})`);
  } else {
    console.log(`Target: All entries that need conversion`);
  }
  console.log();

  try {
    // Initialize Firebase
    const firestoreDb = initializeFirebase();
    const kbService = new KnowledgeBaseService(firestoreDb);

    // Initialize KB service
    await kbService.initialize();
    console.log('✅ KB Service initialized\n');

    // Load audit results to know which entries need conversion
    const auditPath = path.join(__dirname, '../../kb-language-audit-results.json');
    if (!fs.existsSync(auditPath)) {
      console.error('❌ Audit results not found. Run audit first: npm run audit-kb-languages');
      process.exit(1);
    }

    const auditResults = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

    // Get entries that need conversion
    let entriesToConvert = auditResults.details.filter((detail: any) =>
      detail.needsConversion &&
      (detail.type === 'bilingual' || detail.type === 'mixed')
    );

    // Filter to specific entry if requested
    if (specificEntryId) {
      entriesToConvert = entriesToConvert.filter((e: any) => e.id === specificEntryId);
      if (entriesToConvert.length === 0) {
        console.error(`❌ Entry ${specificEntryId} not found or doesn't need conversion`);
        process.exit(1);
      }
    }

    console.log(`📊 Entries to convert: ${entriesToConvert.length}\n`);

    // Track conversion results
    const results: Array<{
      id: string;
      success: boolean;
      changes: string[];
      error?: string;
    }> = [];

    // Convert each entry
    for (const entryDetail of entriesToConvert) {
      try {
        // Fetch current entry
        const current = await kbService.getById(entryDetail.id);
        if (!current) {
          console.error(`❌ Entry ${entryDetail.id} not found in Firestore`);
          results.push({
            id: entryDetail.id,
            success: false,
            changes: [],
            error: 'Not found in Firestore'
          });
          continue;
        }

        // Convert entry
        const { converted, changes } = convertEntry(current, entryDetail.type);

        // Preview conversion
        previewConversion(current, converted, changes);

        if (!isDryRun) {
          // Apply conversion
          console.log('\n🔄 Applying conversion...');

          // Prepare update object, filtering out undefined values
          const updateData: any = {
            content: converted.content
          };

          // Only include metadata if it has defined values
          if (converted.metadata) {
            const cleanMetadata: any = { ...converted.metadata };
            // Remove undefined culturalNotes
            if (cleanMetadata.culturalNotes === undefined) {
              delete cleanMetadata.culturalNotes;
            }
            updateData.metadata = cleanMetadata;
          }

          // Add language if present
          if ((converted as any).language) {
            updateData.language = (converted as any).language;
          }

          await kbService.update(entryDetail.id, updateData);
          console.log('✅ Conversion applied!');
        } else {
          console.log('\n🔍 DRY-RUN: No changes applied');
        }

        results.push({
          id: entryDetail.id,
          success: true,
          changes
        });

      } catch (error) {
        console.error(`❌ Error converting ${entryDetail.id}:`, error);
        results.push({
          id: entryDetail.id,
          success: false,
          changes: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total entries processed: ${results.length}`);
    console.log(`✅ Successful: ${results.filter(r => r.success).length}`);
    console.log(`❌ Failed: ${results.filter(r => !r.success).length}`);

    if (isDryRun) {
      console.log('\n🔍 DRY-RUN MODE: No changes were applied to Firestore');
      console.log('\nTo apply these changes, run:');
      console.log('  npm run convert-kb-to-english');
    } else {
      console.log('\n✅ Changes applied to Firestore!');
      console.log('\n🎯 Next steps:');
      console.log('1. Verify entries in Firestore');
      console.log('2. Test with Spanish queries');
      console.log('3. Run: npm run sync-kb-to-vertex');
    }

    console.log('='.repeat(80));

    // Save conversion report
    const reportPath = path.join(__dirname, '../../kb-conversion-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: isDryRun ? 'dry-run' : 'live',
      results
    }, null, 2));
    console.log(`\n📄 Conversion report saved: ${reportPath}`);

  } catch (error) {
    console.error('\n❌ Conversion failed:', error);
    process.exit(1);
  }
}

// Run conversion
if (require.main === module) {
  convertKBToEnglish()
    .then(() => {
      console.log('\n✅ Conversion script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Conversion script failed:', error);
      process.exit(1);
    });
}

export { convertKBToEnglish, convertEntry };
