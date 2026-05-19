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
  const { data: orgConfig, error: e1 } = await supabase.from('org_config').select('*');
  console.log('org_config table:', JSON.stringify(orgConfig, null, 2));
  console.log('e1:', e1);

  const { data: sysConfigs, error: e2 } = await supabase.from('system_configs').select('*');
  console.log('system_configs table:', JSON.stringify(sysConfigs, null, 2));
  console.log('e2:', e2);
}

main();
