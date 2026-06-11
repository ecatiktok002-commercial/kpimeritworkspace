/**
 * Migration Script: Re-classify all tasks from legacy categories (ECA HQ, etc.)
 * into the 4 new business categories based on task title intent.
 * 
 * Categories:
 * 1. ECA Rental - E-hailing: Car rental for Grab Drivers
 * 2. ECA Rental - Daily Rental: Normal domestic car rental
 * 3. ECA Marketing: Marketing department supporting all units
 * 4. ECA IT R&D: Software/tools development for efficiency
 */

const SUPABASE_URL = 'https://zemrthfyntbiicntaich.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbXJ0aGZ5bnRiaWljbnRhaWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODMwMTMsImV4cCI6MjA5MTY1OTAxM30.aiAUz3Z32eiGQsoOz8cuo_7hH2kPeK2RdtYw_DaEJLU';

// Classify a task title into the correct category
function classifyTask(title) {
  const t = (title || '').toLowerCase();
  
  // E-hailing: Grab drivers, e-hailing specific
  if (t.includes('e-hailing') || t.includes('hailing') || t.includes('grab') || 
      t.includes('ehailing') || t.includes('e hailing')) {
    return 'ECA Rental - E-hailing';
  }
  
  // Marketing: content, ads, social, creative, branding, design
  if (t.includes('marketing') || t.includes('ads') || t.includes('tiktok') || 
      t.includes('instagram') || t.includes('social media') || t.includes('content') || 
      t.includes('creative') || t.includes('campaign') || t.includes('video') || 
      t.includes('post') || t.includes('viral') || t.includes('ad copy') || 
      t.includes('promo') || t.includes('brand') || t.includes('design') || 
      t.includes('poster') || t.includes('carousel') || t.includes('reel') || 
      t.includes('photo') || t.includes('shoot') || t.includes('banner') ||
      t.includes('copywrit') || t.includes('seo') || t.includes('google ads') ||
      t.includes('facebook') || t.includes('social') || t.includes('flyer') ||
      t.includes('graphic') || t.includes('logo') || t.includes('advertis')) {
    return 'ECA Marketing';
  }
  
  // IT R&D: software, dev, tech, tools, system, app, automation
  if (t.includes('software') || t.includes('r&d') || t.includes('code') || 
      t.includes('api') || t.includes('bug') || t.includes('feature') || 
      t.includes('develop') || t.includes('ui') || t.includes('ux') || 
      t.includes('database') || t.includes('tech') || t.includes('saas') || 
      t.includes('system') || t.includes('tool') || t.includes('automat') ||
      t.includes('deploy') || t.includes('server') || t.includes('website') || 
      t.includes('platform') || t.includes('dashboard') || t.includes('kpi') || 
      t.includes('merit') || t.includes('integration') || t.includes('digital') ||
      t.includes('crm') || t.includes('erp') || t.includes('whatsapp bot') ||
      t.includes('chatbot') || t.includes('script') || t.includes('excel') ||
      t.includes('spreadsheet') || t.includes('report') || t.includes('analytics')) {
    return 'ECA IT R&D';
  }
  
  // Daily rental: car rental, booking, fleet, maintenance, customer, contract, operations
  if (t.includes('daily') || t.includes('rental') || t.includes('fleet') || 
      t.includes('car') || t.includes('vehicle') || t.includes('maintenance') || 
      t.includes('booking') || t.includes('customer') || t.includes('contract') || 
      t.includes('insurance') || t.includes('return') || t.includes('delivery') ||
      t.includes('pickup') || t.includes('handover') || t.includes('inspection') ||
      t.includes('driver') || t.includes('road tax') || t.includes('jpj') ||
      t.includes('myeg') || t.includes('puspakom') || t.includes('service') ||
      t.includes('workshop') || t.includes('tyre') || t.includes('tire') ||
      t.includes('oil change') || t.includes('accident') || t.includes('claim') ||
      t.includes('damage') || t.includes('deposit') || t.includes('tenant') ||
      t.includes('renter')) {
    return 'ECA Rental - Daily Rental';
  }
  
  // Default: Daily Rental (most operational tasks fall here)
  return 'ECA Rental - Daily Rental';
}

// Parse the METADATA block from a task note
function parseMetadata(note) {
  if (!note || !note.includes('=== METADATA ===')) {
    return { category: '', initiative: '', cleanNote: note || '' };
  }
  const parts = note.split('=== METADATA ===');
  const cleanNote = parts[0].trim();
  const metaBlock = parts[1] || '';
  
  let category = '';
  let initiative = '';
  
  const catMatch = metaBlock.match(/category:\s*(.+)/i);
  if (catMatch) category = catMatch[1].trim();
  
  const initMatch = metaBlock.match(/initiative:\s*(.+)/i);
  if (initMatch) initiative = initMatch[1].trim();
  
  return { category, initiative, cleanNote };
}

// Format a note with new metadata
function formatMetadata(cleanNote, category, initiative) {
  return `${cleanNote}\n\n=== METADATA ===\ncategory: ${category}\ninitiative: ${initiative}`;
}

async function migrate() {
  console.log('🚀 Starting category migration...\n');
  
  // Fetch all tasks
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=id,title,note&order=created_at.asc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  
  const tasks = await resp.json();
  console.log(`📦 Found ${tasks.length} total tasks\n`);
  
  // Categorize stats
  const stats = {
    'ECA Rental - E-hailing': 0,
    'ECA Rental - Daily Rental': 0,
    'ECA Marketing': 0,
    'ECA IT R&D': 0,
  };
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const task of tasks) {
    const { category: oldCategory, initiative: oldInitiative, cleanNote } = parseMetadata(task.note);
    
    // Determine new category from task title
    const newCategory = classifyTask(task.title);
    
    // Keep existing initiative if valid, otherwise auto-classify
    let newInitiative = oldInitiative;
    const validTags = ['Strategic', 'Operations', 'Marketing', 'Finance'];
    if (!validTags.includes(newInitiative)) {
      newInitiative = 'Operations'; // default
    }
    
    // Check if update needed
    const validCategories = Object.keys(stats);
    if (validCategories.includes(oldCategory) && oldCategory === newCategory) {
      skipped++;
      stats[newCategory]++;
      continue; // Already correct
    }
    
    // Build new note with updated metadata
    const newNote = formatMetadata(cleanNote, newCategory, newInitiative);
    
    // Update in Supabase
    const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ note: newNote }),
    });
    
    if (updateResp.ok) {
      updated++;
      stats[newCategory]++;
      console.log(`✅ [${newCategory}] "${task.title}" (was: ${oldCategory || 'none'})`);
    } else {
      errors++;
      console.log(`❌ Failed to update: "${task.title}" - ${updateResp.statusText}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total tasks:    ${tasks.length}`);
  console.log(`Updated:        ${updated}`);
  console.log(`Already correct: ${skipped}`);
  console.log(`Errors:         ${errors}`);
  console.log('\n📁 Distribution:');
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`   ${cat}: ${count} tasks`);
  }
  console.log('='.repeat(60));
}

migrate().catch(console.error);
