const fs = require('fs');
const path = require('path');

const categories = ['donation', 'share', 'help', 'information', 'edge-cases'];

let total = 0;
let updated = 0;

for (const category of categories) {
  const categoryDir = path.join(__dirname, category);
  
  if (!fs.existsSync(categoryDir)) continue;
  
  const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(categoryDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const conversation = JSON.parse(content);
    
    total++;
    
    if (!conversation.metadata.reviewed) {
      conversation.metadata.reviewed = true;
      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2) + '\n', 'utf-8');
      console.log(`✅ Marked as reviewed: ${category}/${file}`);
      updated++;
    }
  }
}

console.log(`\n✅ Complete! ${updated} conversations marked as reviewed (${total} total)`);
