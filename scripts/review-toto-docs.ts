/**
 * Script to help review toto-docs and categorize for KB extraction
 * 
 * Usage:
 *   npx ts-node scripts/review-toto-docs.ts [action]
 * 
 * Actions:
 *   - inventory: List all markdown files in toto-docs
 *   - categorize: Show categorization template for each file
 */

import * as fs from 'fs';
import * as path from 'path';

const TOTO_DOCS_PATH = path.join(__dirname, '../../toto-docs/app/docs');

interface DocFile {
  path: string;
  relativePath: string;
  category: string;
  title?: string;
  suggestedAction: 'extract' | 'keep-only' | 'outdated' | 'roadmap' | 'review';
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

/**
 * Get all markdown files recursively
 */
function getAllMarkdownFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .git, build directories
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' || 
          entry.name === 'build' ||
          entry.name === 'docs-management') {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...getAllMarkdownFiles(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

/**
 * Extract title from markdown file
 */
function extractTitle(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Try to find title in frontmatter
    const frontmatterMatch = content.match(/^---\s*\n(?:.*\n)*?title:\s*(.+)\n/);
    if (frontmatterMatch) {
      return frontmatterMatch[1].trim().replace(/['"]/g, '');
    }
    // Try to find first H1
    const h1Match = content.match(/^#\s+(.+)\n/);
    if (h1Match) {
      return h1Match[1].trim();
    }
    // Fallback to filename
    return path.basename(filePath, '.md');
  } catch (error) {
    return undefined;
  }
}

/**
 * Categorize file based on path and content
 */
function categorizeFile(filePath: string, relativePath: string): DocFile {
  const category = path.dirname(relativePath).split(path.sep)[0] || 'root';
  const title = extractTitle(filePath);
  
  // Determine suggested action based on category and path
  let suggestedAction: DocFile['suggestedAction'] = 'review';
  let priority: DocFile['priority'] = 'medium';
  let notes = '';
  
  // High priority - operational procedures
  if (category === 'development' || category === 'deployment') {
    suggestedAction = 'extract';
    priority = 'high';
    notes = 'Operational procedures - extract to KB';
  }
  // Architecture - extract current state
  else if (category === 'architecture') {
    suggestedAction = 'extract';
    priority = 'high';
    notes = 'Current architecture - extract facts to KB';
  }
  // Production readiness - extract current practices
  else if (category === 'production-readiness') {
    suggestedAction = 'extract';
    priority = 'high';
    notes = 'Current production practices - extract to KB';
  }
  // API reference - keep external only
  else if (category === 'api-reference') {
    suggestedAction = 'keep-only';
    priority = 'low';
    notes = 'External-facing API docs - keep in toto-docs only';
  }
  // Audits - keep external only
  else if (relativePath.includes('audit') || category === 'audits') {
    suggestedAction = 'keep-only';
    priority = 'low';
    notes = 'Audit reports - keep in toto-docs only';
  }
  // Roadmap/TODO - don't extract
  else if (relativePath.includes('roadmap') || relativePath.includes('todo')) {
    suggestedAction = 'roadmap';
    priority = 'low';
    notes = 'Future plans - do not extract to KB';
  }
  // User guides - may already be in KB
  else if (category === 'user-guides') {
    suggestedAction = 'review';
    priority = 'medium';
    notes = 'Check if already in KB with user audience';
  }
  // AI system - extract operational info
  else if (category === 'ai-system') {
    suggestedAction = 'extract';
    priority = 'high';
    notes = 'AI system operational info - extract to KB';
  }
  // Getting started - extract setup procedures
  else if (category === 'getting-started') {
    suggestedAction = 'extract';
    priority = 'high';
    notes = 'Setup procedures - extract to KB';
  }
  
  return {
    path: filePath,
    relativePath,
    category,
    title,
    suggestedAction,
    priority,
    notes
  };
}

/**
 * Generate inventory
 */
function generateInventory(): void {
  console.log('📚 Generating toto-docs inventory...\n');
  
  if (!fs.existsSync(TOTO_DOCS_PATH)) {
    console.error(`❌ toto-docs path not found: ${TOTO_DOCS_PATH}`);
    console.log('💡 Make sure toto-docs is in the workspace root');
    process.exit(1);
  }
  
  const files = getAllMarkdownFiles(TOTO_DOCS_PATH);
  console.log(`Found ${files.length} markdown files\n`);
  
  const categorized: DocFile[] = files.map(filePath => {
    const relativePath = path.relative(TOTO_DOCS_PATH, filePath);
    return categorizeFile(filePath, relativePath);
  });
  
  // Group by category
  const byCategory = new Map<string, DocFile[]>();
  categorized.forEach(doc => {
    if (!byCategory.has(doc.category)) {
      byCategory.set(doc.category, []);
    }
    byCategory.get(doc.category)!.push(doc);
  });
  
  // Print summary
  console.log('📊 Summary by Category:\n');
  for (const [category, docs] of Array.from(byCategory.entries()).sort()) {
    const extract = docs.filter(d => d.suggestedAction === 'extract').length;
    const keepOnly = docs.filter(d => d.suggestedAction === 'keep-only').length;
    const review = docs.filter(d => d.suggestedAction === 'review').length;
    const roadmap = docs.filter(d => d.suggestedAction === 'roadmap').length;
    
    console.log(`${category}: ${docs.length} files`);
    console.log(`  - Extract to KB: ${extract}`);
    console.log(`  - Keep in toto-docs only: ${keepOnly}`);
    console.log(`  - Review needed: ${review}`);
    console.log(`  - Roadmap/Future: ${roadmap}`);
    console.log('');
  }
  
  // Print detailed list
  console.log('\n📋 Detailed File List:\n');
  console.log('| Priority | Action | Category | File | Title |');
  console.log('|----------|--------|----------|------|-------|');
  
  // Sort by priority and category
  const sorted = categorized.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.category.localeCompare(b.category);
  });
  
  sorted.forEach(doc => {
    const title = doc.title || 'N/A';
    const titleShort = title.length > 40 ? title.substring(0, 37) + '...' : title;
    console.log(`| ${doc.priority} | ${doc.suggestedAction} | ${doc.category} | ${doc.relativePath} | ${titleShort} |`);
  });
  
  // Save to JSON for further processing
  const outputPath = path.join(__dirname, '../toto-docs-inventory.json');
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2));
  console.log(`\n✅ Inventory saved to: ${outputPath}`);
}

/**
 * Main function
 */
function main() {
  const action = process.argv[2] || 'inventory';
  
  switch (action) {
    case 'inventory':
      generateInventory();
      break;
    default:
      console.log('Usage: npx ts-node scripts/review-toto-docs.ts [inventory]');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generateInventory, categorizeFile };

