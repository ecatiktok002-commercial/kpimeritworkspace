"use client";

import React, { useState } from 'react';
import type { OrganizationConfig, TeamMember, MeritConfig } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';

interface ManagerOrgViewProps {
  config: OrganizationConfig;
  setConfig: (c: OrganizationConfig) => void;
  onDeleteStaff: (id: string, name: string) => void;
  team: TeamMember[];
  setTeam: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  onSaveRoleSync: (config: OrganizationConfig) => Promise<void>;
  viewedIds: string[];
  markViewed: (id: string) => void;
  meritConfig: MeritConfig;
  setMeritConfig: (c: MeritConfig) => void;
}

export default function ManagerOrgView({
  config,
  setConfig,
  onDeleteStaff,
  team,
  setTeam,
  onSaveRoleSync,
  viewedIds,
  markViewed,
  meritConfig,
  setMeritConfig
}: ManagerOrgViewProps) {
  const allRoles = Object.keys(config.autoAssignments || {});

  // —— Create Staff ——
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRoles, setNewStaffRoles] = useState<string[]>([]); // multi-role
  const [newStaffDept, setNewStaffDept] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [creating, setCreating] = useState(false);

  const toggleNewRole = (role: string) =>
    setNewStaffRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const handleCreateStaff = async () => {
    if (!newStaffName.trim() || !newAccessCode.trim()) return alert('Name and Access Code required.');
    setCreating(true);
    const roleStr = newStaffRoles.join(', ') || 'Staff';
    const { data: profile, error } = await supabase.from('profiles').insert([{
      full_name: newStaffName.trim(),
      access_id: newStaffName.trim().toLowerCase().replace(/\s+/g, ''),
      passcode: newAccessCode.trim(),
      role: roleStr,
      department: newStaffDept.trim() || 'General',
      photo_url: `https://i.pravatar.cc/150?u=${Date.now()}`
    }]).select().single();
    setCreating(false);
    if (error) { alert('Error creating staff: ' + error.message); return; }
    alert(`Staff "${profile.full_name}" created. Access ID: ${profile.access_id}`);
    setTeam(prev => [...prev, {
      id: profile.id, name: profile.full_name, imgUrl: profile.photo_url,
      status: 'online', currentTask: 'Awaiting Task', department: profile.department || 'General',
      monthPoints: 0, rank: prev.length + 1, elapsed: '', role: roleStr,
      points: 0, level: 1, current_rank_points: 0, is_manager: false,
      last_active: new Date().toISOString()
    }]);
    setNewStaffName(''); setNewAccessCode(''); setNewStaffRoles([]); setNewStaffDept('');
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editPasscode, setEditPasscode] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (staff: any) => {
    setEditingId(staff.id);
    setEditName(staff.name || '');
    setEditRoles(staff.role ? staff.role.split(',').map((r: string) => r.trim()).filter(Boolean) : []);
    setEditPasscode('');
  };

  const toggleEditRole = (role: string) =>
    setEditRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const roleStr = editRoles.join(', ') || 'Staff';
    const updates: any = { full_name: editName.trim(), role: roleStr };
    if (editPasscode.trim()) updates.passcode = editPasscode.trim();
    const { error } = await supabase.from('profiles').update(updates).eq('id', editingId);
    setSaving(false);
    if (error) { alert('Failed to update: ' + error.message); return; }
    setTeam(prev => prev.map(s => s.id === editingId ? { ...s, name: editName.trim(), role: roleStr } : s));
    setEditingId(null);
  };

  // —— Role Config ——
  const [newRoleName, setNewRoleName] = useState('');
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  const handleAddDefaultTask = async (role: string) => {
    const taskName = taskInputs[role]?.trim();
    if (!taskName) return;
    const newConfig = { ...config, autoAssignments: { ...config.autoAssignments, [role]: { ...config.autoAssignments[role], tasks: [...config.autoAssignments[role].tasks, taskName] } } };
    setConfig(newConfig);
    setTaskInputs(prev => ({ ...prev, [role]: '' }));
    await onSaveRoleSync(newConfig);
  };

  const handleRemoveTask = async (role: string, idx: number) => {
    const newConfig = { ...config, autoAssignments: { ...config.autoAssignments, [role]: { ...config.autoAssignments[role], tasks: config.autoAssignments[role].tasks.filter((_, i) => i !== idx) } } };
    setConfig(newConfig);
    await onSaveRoleSync(newConfig);
  };

  const handleDeleteRole = async (role: string) => {
    if (!confirm(`Delete the "${role}" role configuration?`)) return;
    const { [role]: _r, ...rest } = config.autoAssignments;
    const newConfig = { ...config, autoAssignments: rest };
    setConfig(newConfig);
    await onSaveRoleSync(newConfig);
  };

  const handleCreateRole = async () => {
    const roleName = newRoleName.trim();
    if (!roleName) return;
    if (config.autoAssignments[roleName]) { alert('Role already exists.'); return; }
    const newConfig = { ...config, autoAssignments: { ...config.autoAssignments, [roleName]: { tasks: [] } } };
    setConfig(newConfig);
    setNewRoleName('');
    await onSaveRoleSync(newConfig);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Workspace Governance</p>
        <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Organization Settings</h2>
        <p className="text-on-surface-variant mt-2 text-lg">Manage business roles, auto-assignments, and issue staff access codes.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Col: Staff Management */}
        <div className="xl:col-span-5 space-y-8">
          {/* Economy Target Config */}
          <div className="bg-white p-6 sm:p-8 rounded-[40px] border border-outline-variant/10 shadow-xl">
            <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">monitoring</span> Output Threshold
            </h3>
            <div className="flex gap-4">
              <input 
                type="number"
                value={meritConfig.weeklyThreshold || 975}
                onChange={e => setMeritConfig({ ...meritConfig, weeklyThreshold: Number(e.target.value) })}
                className="w-full bg-surface-container-low rounded-2xl px-5 py-4 text-2xl font-black border border-outline-variant/10 focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <button
                onClick={async () => {
                  const { error } = await supabase.from('system_configs').update({ value: meritConfig }).eq('key', 'merit_config');
                  if (error) alert('Failed to sync threshold: ' + error.message);
                  else alert('Weekly Threshold Synchronized Globally!');
                }}
                className="bg-primary text-white px-6 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-primary/20"
              >
                Sync
              </button>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant opacity-60 mt-4 font-black">Standard baseline: 975 points/week</p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-[40px] border border-outline-variant/10 shadow-xl">
            <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">badge</span> Staff Enrollment
            </h3>

            {/* Create Staff Form */}
            <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5 shadow-inner mb-8 space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block opacity-60">Full Name / Identifier</label>
                <input 
                  className="w-full bg-white rounded-2xl px-5 py-3 text-sm font-bold border border-outline-variant/10 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder="e.g. Alexander Vance"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block opacity-60">Department</label>
                <input 
                  className="w-full bg-white rounded-2xl px-5 py-3 text-sm font-bold border border-outline-variant/10 outline-none"
                  placeholder="e.g. Logistics"
                  value={newStaffDept}
                  onChange={e => setNewStaffDept(e.target.value)}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 block opacity-60">Assign Operational Roles</p>
                {allRoles.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic">No roles configured yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allRoles.map(role => {
                      const checked = newStaffRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleNewRole(role)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                            checked
                              ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                              : 'bg-white text-on-surface-variant border-outline-variant/20 hover:border-primary/40 hover:text-primary'
                          }`}
                        >
                          {checked && <span className="mr-1">✓</span>}{role}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={newAccessCode}
                  onChange={e => setNewAccessCode(e.target.value)}
                  placeholder="Set Passcode..."
                  className="flex-1 bg-white rounded-2xl py-3 px-5 text-sm font-bold border border-outline-variant/10 outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => setNewAccessCode(Math.floor(100000 + Math.random() * 900000).toString())}
                  className="px-5 py-3 bg-surface-container rounded-2xl text-primary hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">refresh</span>
                </button>
              </div>

              <button
                disabled={creating}
                onClick={handleCreateStaff}
                className="w-full bg-primary text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
              >
                {creating ? 'Issuing Gateway...' : 'Initialize Access'}
              </button>
            </div>

            {/* Staff List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 opacity-40">Active Credentials</p>
              {team.map(staff => (
                <div key={staff.id} className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/5 shadow-sm group hover:bg-white hover:border-primary/20 transition-all">
                  {editingId === staff.id ? (
                    <div className="space-y-4">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full bg-white rounded-xl p-3 text-sm font-bold border border-primary/20 outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-bold">Save</button>
                        <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-surface-container text-on-surface-variant rounded-xl text-xs font-bold">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={staff.imgUrl} className="w-10 h-10 rounded-xl object-cover" alt="" />
                        <div>
                          <p className="font-bold text-sm text-on-surface">{staff.name}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary mt-0.5">{staff.role || 'Staff'} · {staff.department}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(staff)} className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onClick={() => onDeleteStaff(staff.id, staff.name)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
                          <span className="material-symbols-outlined text-[18px]">person_remove</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Role Matrix */}
        <div className="xl:col-span-7 space-y-8">
          <div className="bg-white p-6 sm:p-8 rounded-[40px] border border-outline-variant/10 shadow-xl h-full flex flex-col">
            <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">diversity_3</span> Role Definition Matrix
            </h3>

            {/* Create Role */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="New Role Title (e.g. Creative Lead)"
                className="flex-1 bg-surface-container-low rounded-2xl py-3 px-5 outline-none border border-outline-variant/10 text-sm font-bold focus:border-primary/30 transition-all"
              />
              <button
                onClick={handleCreateRole}
                className="bg-primary text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-md hover:scale-[1.05] active:scale-95 transition-all"
              >
                Deploy Role
              </button>
            </div>

            {/* Role List */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              {allRoles.map(role => (
                <div key={role} className="p-6 rounded-[2.5rem] bg-surface-container-low border border-outline-variant/5 shadow-inner">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-xl font-extrabold font-headline text-on-surface">{role}</h4>
                      <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant mt-1 opacity-60">Standard Mission Scope</p>
                    </div>
                    <button onClick={() => handleDeleteRole(role)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>

                  <div className="space-y-2 mb-6">
                    {config.autoAssignments[role].tasks.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic opacity-40 px-2">No standard tasks assigned.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {config.autoAssignments[role].tasks.map((task, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/50 p-3 rounded-2xl border border-outline-variant/5 group">
                            <span className="text-xs font-bold text-on-surface">{task}</span>
                            <button onClick={() => handleRemoveTask(role, i)} className="text-error opacity-0 group-hover:opacity-100 transition-opacity p-1">
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={taskInputs[role] || ''}
                      onChange={e => setTaskInputs({ ...taskInputs, [role]: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleAddDefaultTask(role)}
                      placeholder="Add standard task..."
                      className="flex-1 bg-white border border-outline-variant/10 rounded-2xl py-3 px-5 text-sm font-bold focus:border-primary/30 outline-none transition-all"
                    />
                    <button
                      onClick={() => handleAddDefaultTask(role)}
                      className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-outline-variant/10">
               <button
                onClick={() => onSaveRoleSync(config)}
                className="w-full bg-surface-container text-on-surface-variant py-5 rounded-3xl text-[11px] font-black uppercase tracking-[0.25em] border border-outline-variant/10 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
              >
                Sync Global Architecture
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
