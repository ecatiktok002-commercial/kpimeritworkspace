import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env: any = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
async function main() {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
  if (!data) return;
  const tasks = data.map(t => ({
    id: t.id,
    status: t.status,
    commencementDate: t.commencement_date || t.created_at,
    ownerId: t.staff_id,
    collaboratorIds: t.collaborator_ids || []
  }));
  const currentUserId = 'ee468898-28cc-438d-adb7-ce51edf937f7';
  const visibleTasks = tasks.filter(task => {
    if (!task.ownerId) return true;
    if (task.ownerId === currentUserId) return true;
    if (task.collaboratorIds && task.collaboratorIds.includes(currentUserId)) return true;
    return false;
  });
  const getKLTime = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(new Date()).replace(', ', 'T');
  };
  const klTodayStr = getKLTime().split('T')[0];
  console.log('klTodayStr:', klTodayStr);
  const todayTasks = visibleTasks.filter(t => {
    if (!t.commencementDate) return true;
    return t.commencementDate.split('T')[0] <= klTodayStr;
  });
  console.log('total tasks:', tasks.length);
  console.log('visibleTasks:', visibleTasks.length);
  console.log('todayTasks:', todayTasks.length);
  console.log('first task commencement:', todayTasks[0]?.commencementDate);
}
main();
