import os
import re

file_path = r"c:\Users\user\OneDrive\Desktop\.antigravity\.kpimerit\kpi-merit-app\src\app\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Use regex to find the setAppeals call and the following alert
pattern = r"setAppeals\(prev => \[\.\.\.prev, \{ id: Date\.now\(\)\.toString\(\), staffName: currentProfile\.name \|\| authProfile\?\.full_name \|\| 'Staff', department: currentProfile\.department \|\| 'General', taskTitle: task\.title, originalPoints: task\.points, appealComment: msg, imgUrl: currentProfile\.photoUrl \|\| currentProfile\.photo_url \|\| \"https://i\.pravatar\.cc/150\", resolved: false \}\]\);\s+alert\('Dispute submitted for Triage\.'\);"

replacement = """const newId = crypto.randomUUID();
                                  const newAppeal: AppealItem = { 
                                    id: newId, 
                                    staffName: currentProfile.name || authProfile?.full_name || 'Staff', 
                                    department: currentProfile.department || 'General', 
                                    taskTitle: task.title, 
                                    originalPoints: task.points, 
                                    appealComment: msg, 
                                    imgUrl: currentProfile.photoUrl || currentProfile.photo_url || "https://i.pravatar.cc/150", 
                                    resolved: false 
                                  };
                                  setAppeals(prev => [...prev, newAppeal]);
                                  
                                  const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
                                  await supabase.from('appeals').insert([{
                                    id: newId,
                                    staff_id: isValidUUID(authProfile?.id || '') ? authProfile.id : null,
                                    staff_name: newAppeal.staffName,
                                    department: newAppeal.department,
                                    task_title: newAppeal.taskTitle,
                                    original_points: newAppeal.originalPoints,
                                    appeal_comment: newAppeal.appealComment,
                                    img_url: newAppeal.imgUrl,
                                    resolved: false
                                  }]);
                                  alert('Dispute submitted for Triage.');"""

new_content = re.sub(pattern, replacement, content)

if new_content != content:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Success")
else:
    print("Pattern not found")
