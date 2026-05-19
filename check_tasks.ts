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
  const { data: tasks, error } = await supabase.from('tasks').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Tasks fetched:', tasks?.length);
    console.log('First task:', tasks?.[0]);
  }
}

main();
