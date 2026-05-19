import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env: any = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
);

async function main() {
  const currentId = 'ee468898-28cc-438d-adb7-ce51edf937f7'; // staff ID from earlier
  let query = supabase.from('tasks').select('*').or(`staff_id.eq.${currentId},collaborator_ids.cs.{${currentId}}`);
  const { data: tasks, error } = await query;
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Tasks fetched:', tasks?.length);
  }
}

main();
