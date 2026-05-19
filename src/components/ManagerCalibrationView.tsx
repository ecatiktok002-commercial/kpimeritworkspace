import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SEED_MERIT_CONFIG } from '@/lib/mockDb';
import type { TaskDefinition, MeritConfig, KeywordRule, ActivityLog } from '@/lib/types';

interface ManagerCalibrationViewProps {
  taskDefinitions: TaskDefinition[];
  setTaskDefinitions: React.Dispatch<React.SetStateAction<TaskDefinition[]>>;
  meritConfig: MeritConfig;
  setMeritConfig: (c: MeritConfig) => void;
  activityLog: ActivityLog[];
  viewedIds: string[];
  markViewed: (id: string) => void;
}

export default function ManagerCalibrationView({ 
  taskDefinitions, 
  setTaskDefinitions, 
  meritConfig, 
  setMeritConfig,
  activityLog,
  viewedIds,
  markViewed
}: ManagerCalibrationViewProps) {
  const [isEditingGlobalTiers, setIsEditingGlobalTiers] = useState(false);
  const [tempMeritConfig, setTempMeritConfig] = useState<MeritConfig>(meritConfig);
  const [keywordSortBy, setKeywordSortBy] = useState<'tier' | 'keyword'>('tier');
  const [keywordSortOrder, setKeywordSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const dynamicTiers = [
    { name: meritConfig.tier1Name, val: meritConfig.multiplierTier1 },
    { name: meritConfig.tier2Name, val: meritConfig.multiplierTier2 },
    { name: meritConfig.tier3Name, val: meritConfig.multiplierTier3 },
    { name: meritConfig.tier4Name, val: meritConfig.multiplierTier4 },
    { name: meritConfig.tier5Name, val: meritConfig.multiplierTier5 }
  ];
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState<number>(0);
  const [editMultiplier, setEditMultiplier] = useState<number>(1.2);
  const [staffInputs, setStaffInputs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentStats, setRecentStats] = useState<Record<string, { avg: number; count: number }>>({});
  const [calibrationCounts, setCalibrationCounts] = useState<Record<string, number>>({});
  const [activePoolTab, setActivePoolTab] = useState<'inputs' | 'activity'>('inputs');

  useEffect(() => {
    fetchCalibrationStats();
    fetchStaffInputs();
    fetchCalibrationCounts();
  }, []);

  const fetchCalibrationCounts = async () => {
    const { data, error } = await supabase
      .from('task_calibration')
      .select('task_title');
    
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((d: any) => {
        counts[d.task_title] = (counts[d.task_title] || 0) + 1;
      });
      setCalibrationCounts(counts);
    }
  };

  const fetchStaffInputs = async () => {
    const { data, error } = await supabase
      .from('task_calibration')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setStaffInputs(data);
  };

  const fetchCalibrationStats = async () => {
    // Fetch average actual durations from completed tasks to help manager calibrate
    const { data, error } = await supabase
      .from('tasks')
      .select('title, actual_duration_minutes')
      .not('actual_duration_minutes', 'is', null)
      .eq('status', 'completed');

    if (data) {
      const stats: Record<string, { sum: number; count: number }> = {};
      data.forEach((t: any) => {
        if (!stats[t.title]) stats[t.title] = { sum: 0, count: 0 };
        stats[t.title].sum += t.actual_duration_minutes;
        stats[t.title].count += 1;
      });

      const finalStats: Record<string, { avg: number; count: number }> = {};
      Object.keys(stats).forEach(title => {
        finalStats[title] = {
          avg: Math.round(stats[title].sum / stats[title].count),
          count: stats[title].count
        };
      });
      setRecentStats(finalStats);
    }
  };


  const handleToggleCalibration = async (def: TaskDefinition) => {
    const newState = !def.isCalibrated;
    const { error } = await supabase
      .from('task_definitions')
      .update({ is_calibrated: newState })
      .eq('id', def.id);

    if (!error) {
      setTaskDefinitions(prev => prev.map(d => d.id === def.id ? { ...d, isCalibrated: newState } : d));
    } else {
      alert('Error updating calibration status: ' + error.message);
    }
  };

  const handleSaveMinutes = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('task_definitions')
      .update({ 
        golden_rule_minutes: editMinutes,
        tier_multiplier: editMultiplier
      })
      .eq('id', id);

    if (!error) {
      setTaskDefinitions(prev => prev.map(d => d.id === id ? { ...d, goldenRuleMinutes: editMinutes, tierMultiplier: editMultiplier } : d));
      setEditingId(null);
    } else {
      alert('Error saving configuration: ' + error.message);
    }
    setLoading(false);
  };

  const filteredInputs = staffInputs.filter(input => 
    input.task_title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (input.task_note && input.task_note.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePromoteToDefinition = async (input: any) => {
    const title = input.task_title;
    const avgMinutes = recentStats[title]?.avg || input.actual_duration_minutes || 0;
    
    // Check if already exists
    if (taskDefinitions.some(d => d.title.toLowerCase() === title.toLowerCase())) {
      return alert('This task already exists in the Standardized Definitions.');
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('task_definitions')
      .insert({
        title,
        golden_rule_minutes: avgMinutes,
        tier_multiplier: 1.2, // Default to Tier 2
        is_calibrated: false
      })
      .select()
      .single();

    if (!error && data) {
      setTaskDefinitions(prev => [...prev, {
        id: data.id,
        title: data.title,
        goldenRuleMinutes: data.golden_rule_minutes,
        tierMultiplier: data.tier_multiplier,
        isCalibrated: data.is_calibrated
      }]);
      alert(`Promoted "${title}" to a Standardized Definition with ${avgMinutes}m Golden Rule.`);
    } else {
      alert('Error promoting to definition: ' + (error?.message || 'Unknown error'));
    }
    setLoading(false);
  };

  const handlePromoteToKeyword = async (input: any) => {
    const keyword = input.task_title;
    const points = input.points_awarded;
    const tierVal = input.tier_val || 1.0;

    // Map multiplier back to tier level
    let tierLevel = 2;
    if (tierVal >= meritConfig.multiplierTier5) tierLevel = 5;
    else if (tierVal >= meritConfig.multiplierTier4) tierLevel = 4;
    else if (tierVal >= meritConfig.multiplierTier3) tierLevel = 3;
    else if (tierVal >= meritConfig.multiplierTier2) tierLevel = 2;
    else tierLevel = 1;

    // Check if already exists
    if ((meritConfig.keywordRules || []).some(r => r.keyword.toLowerCase() === keyword.toLowerCase())) {
      return alert('This keyword already exists in the Point Ledger.');
    }

    const newRule: KeywordRule = {
      id: crypto.randomUUID(),
      keyword,
      points,
      tierLevel
    };

    const newConfig = {
      ...meritConfig,
      keywordRules: [...(meritConfig.keywordRules || []), newRule]
    };

    // Save to DB
    const { error } = await supabase
      .from('system_configs')
      .upsert({ key: 'merit_config', value: newConfig }, { onConflict: 'key' });

    if (!error) {
      setMeritConfig(newConfig);
      setTempMeritConfig(newConfig); // Keep temp in sync
      alert(`Promoted "${keyword}" to a Keyword Rule with ${points} fixed points.`);
    } else {
      alert('Error promoting to keyword: ' + error.message);
    }
  };


  const handleSaveGlobalTiers = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('system_configs')
      .upsert({ key: 'merit_config', value: tempMeritConfig }, { onConflict: 'key' });

    if (!error) {
      setMeritConfig(tempMeritConfig);
      setIsEditingGlobalTiers(false);
      alert('Global Merit Configuration saved successfully.');
    } else {
      alert('Error saving global configuration: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="pt-10 px-6 max-w-6xl mx-auto pb-32 animate-in fade-in duration-300">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Antigravity Core</p>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Task Calibration</h2>
          <p className="text-on-surface-variant mt-2 text-lg">Define standards and keyword intelligence to justify autonomous point distribution.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={fetchStaffInputs} className="p-3 bg-surface-container rounded-2xl text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/10">
             <span className="material-symbols-outlined">refresh</span>
           </button>
        </div>
      </div>

      {/* SECTION: Global Tiers & Keyword Intelligence */}
      <div className="mb-10 p-8 rounded-[40px] bg-white border border-primary/20 shadow-2xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
          <div>
            <h3 className="text-2xl font-extrabold text-on-surface">Tier Points & Keyword Intelligence</h3>
            <p className="text-on-surface-variant text-sm mt-1">Customize multipliers and define keywords for automatic tier assignment.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleSaveGlobalTiers}
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-primary text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              {loading ? <span className="animate-spin material-symbols-outlined">sync</span> : <span className="material-symbols-outlined">save</span>}
              Deploy Changes
            </button>
            
            <button 
              onClick={async () => {
                if (confirm('Sync with Industry Presets? This will add default keywords and standardized definitions for Car Rental and E-hailing.')) {
                  setLoading(true);
                  // 1. Sync Keywords
                  const presets = SEED_MERIT_CONFIG.keywordRules || [];
                  const currentRules = [...(tempMeritConfig.keywordRules || [])];
                  presets.forEach(p => {
                    if (!currentRules.some(r => r.keyword.toLowerCase() === p.keyword.toLowerCase())) {
                      currentRules.push({ ...p, id: crypto.randomUUID() });
                    }
                  });
                  const newConfig = { ...tempMeritConfig, keywordRules: currentRules };
                  setTempMeritConfig(newConfig);
                  setMeritConfig(newConfig);
                  await supabase.from('system_configs').upsert({ key: 'merit_config', value: newConfig }, { onConflict: 'key' });

                  // 2. Sync Standard Definitions
                  const stdPresets = [
                    { title: 'Car Wash', mins: 15, mult: 1.0 },
                    { title: 'Refuel', mins: 10, mult: 1.0 },
                    { title: 'Daily Rental Check', mins: 20, mult: 1.0 },
                    { title: 'Vehicle Handover', mins: 25, mult: 1.2 },
                    { title: 'TikTok Shoot', mins: 60, mult: 1.5 },
                    { title: 'Video Editing', mins: 120, mult: 1.5 },
                  ];

                  for (const p of stdPresets) {
                    if (!taskDefinitions.some(d => d.title.toLowerCase() === p.title.toLowerCase())) {
                      const { data } = await supabase.from('task_definitions').insert({
                        title: p.title,
                        golden_rule_minutes: p.mins,
                        tier_multiplier: p.mult,
                        is_calibrated: true
                      }).select().single();
                      if (data) setTaskDefinitions(prev => [...prev, {
                        id: data.id,
                        title: data.title,
                        goldenRuleMinutes: data.golden_rule_minutes,
                        tierMultiplier: data.tier_multiplier,
                        isCalibrated: data.is_calibrated
                      }]);
                    }
                  }
                  setLoading(false);
                  alert('Industry Presets synced successfully!');
                }
              }}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-secondary/10 text-secondary rounded-2xl font-bold hover:bg-secondary/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">auto_fix</span>
              Sync Presets
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((tier) => {
            const nameKey = `tier${tier}Name` as keyof MeritConfig;
            const multKey = `multiplierTier${tier}` as keyof MeritConfig;
            return (
              <div key={tier} className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/10 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Tier {tier}</p>
                  {JSON.stringify(tempMeritConfig.keywordRules?.filter(r => r.tierLevel === tier)) !== JSON.stringify(meritConfig.keywordRules?.filter(r => r.tierLevel === tier)) && (
                    <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full animate-pulse">Unsaved</span>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase mb-1 block">Name</label>
                    <input 
                      type="text"
                      className="w-full bg-white border border-outline-variant/20 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary/50 transition-all"
                      value={tempMeritConfig[nameKey] as string}
                      onChange={(e) => setTempMeritConfig({...tempMeritConfig, [nameKey]: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase mb-1 block">Multiplier</label>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.1"
                        className="w-full bg-white border border-outline-variant/20 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary/50 transition-all"
                        value={tempMeritConfig[multKey] as number}
                        onChange={(e) => setTempMeritConfig({...tempMeritConfig, [multKey]: parseFloat(e.target.value) || 0})}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-on-surface-variant opacity-40">x</span>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-outline-variant/10 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">Keyword Rules</p>
                    <span className="px-2 py-0.5 rounded-full bg-primary/5 text-primary text-[10px] font-black">
                      {(tempMeritConfig.keywordRules || []).filter(r => r.tierLevel === tier).length}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION: Keyword Intelligence Ledger */}
        <div className="mt-8 pt-8 border-t border-outline-variant/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">psychology</span>
              </div>
              <div>
                <h4 className="font-bold text-xl text-on-surface">Intelligent Rule Ledger</h4>
                <p className="text-xs text-on-surface-variant">Manage synonym-aware auto-categorization across all tiers.</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar -mx-2 px-2">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/10">
                  <th 
                    className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => {
                      if (keywordSortBy === 'keyword') {
                        setKeywordSortOrder(keywordSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setKeywordSortBy('keyword');
                        setKeywordSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Keyword / Intention
                      {keywordSortBy === 'keyword' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {keywordSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-on-surface-variant cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={() => {
                      if (keywordSortBy === 'tier') {
                        setKeywordSortOrder(keywordSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setKeywordSortBy('tier');
                        setKeywordSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Automatic Tier Assignment
                      {keywordSortBy === 'tier' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {keywordSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Fixed Reward (Optional)</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {/* Adding Row */}
                <KeywordAddRow 
                  config={tempMeritConfig} 
                  setConfig={(c) => {
                    setTempMeritConfig(c);
                    setMeritConfig(c);
                  }} 
                />

                {(tempMeritConfig.keywordRules || [])
                  .sort((a, b) => {
                    if (keywordSortBy === 'tier') {
                      return keywordSortOrder === 'asc' ? (a.tierLevel - b.tierLevel) : (b.tierLevel - a.tierLevel);
                    } else {
                      return keywordSortOrder === 'asc' ? a.keyword.localeCompare(b.keyword) : b.keyword.localeCompare(a.keyword);
                    }
                  })
                  .map(rule => (
                  <tr key={rule.id} className="hover:bg-primary/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary/40 text-[16px]">key</span>
                        </div>
                        <span className="font-bold text-on-surface">{rule.keyword}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        rule.tierLevel === 5 ? 'bg-red-50 text-red-600' :
                        rule.tierLevel === 4 ? 'bg-orange-50 text-orange-600' :
                        rule.tierLevel === 3 ? 'bg-blue-50 text-blue-600' :
                        rule.tierLevel === 2 ? 'bg-green-50 text-green-600' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        Tier {rule.tierLevel}: { (tempMeritConfig as any)[`tier${rule.tierLevel}Name`] }
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-primary">
                        {rule.points ? `${rule.points} PTS` : 'Dynamic based on Tier'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={async () => {
                          const newConfig = { ...tempMeritConfig, keywordRules: (tempMeritConfig.keywordRules || []).filter(r => r.id !== rule.id) };
                          setTempMeritConfig(newConfig);
                          setMeritConfig(newConfig);
                          await supabase.from('system_configs').upsert({ key: 'merit_config', value: newConfig }, { onConflict: 'key' });
                        }}
                        className="p-2 text-on-surface-variant hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* LEFT: Calibration Standards */}
        <div className="space-y-8">
          <div className="bg-white rounded-[32px] border border-outline-variant/10 shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/10 bg-surface-container-lowest flex justify-between items-center">
               <h3 className="font-bold text-on-surface flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary">analytics</span>
                 Standardized Task Definitions
               </h3>
               <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{taskDefinitions.length} Defined</span>
            </div>
            <div className="overflow-x-auto no-scrollbar -mx-2 px-2">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant/10">
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Definition</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center">Status</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center">Golden Rule</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Observations</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {taskDefinitions.map((def) => (
                    <tr key={def.id} className="hover:bg-primary/5 transition-colors group">
                      <td className="px-6 py-5">
                        <p className="font-bold text-on-surface">{def.title}</p>
                        {editingId === def.id ? (
                          <select 
                            className="mt-1 text-[10px] bg-surface-container rounded px-1 py-0.5 font-black uppercase tracking-widest text-primary border-none outline-none cursor-pointer"
                            value={editMultiplier}
                            onChange={(e) => setEditMultiplier(parseFloat(e.target.value))}
                          >
                            {dynamicTiers.map(t => <option key={t.val} value={t.val}>{t.name} ({t.val}x)</option>)}
                          </select>
                        ) : (
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60">
                            {dynamicTiers.find(t => t.val === def.tierMultiplier)?.name || 'Custom'} ({def.tierMultiplier}x)
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button 
                            onClick={() => handleToggleCalibration(def)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                              def.isCalibrated 
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              {def.isCalibrated ? 'verified' : 'pending_actions'}
                            </span>
                            {def.isCalibrated ? 'Standard' : 'Learning'}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {editingId === def.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <input 
                              type="number" 
                              className="w-16 bg-surface-container rounded-lg px-2 py-1 text-sm font-bold border border-primary/20 outline-none"
                              value={editMinutes}
                              onChange={(e) => setEditMinutes(parseInt(e.target.value) || 0)}
                              autoFocus
                            />
                            <button onClick={() => handleSaveMinutes(def.id)} className="text-primary hover:scale-110 transition-transform">
                              <span className="material-symbols-outlined text-[18px]">save_as</span>
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer hover:text-primary transition-colors flex items-center justify-center gap-1"
                            onClick={() => { setEditingId(def.id); setEditMinutes(def.goldenRuleMinutes || 0); setEditMultiplier(def.tierMultiplier); }}
                          >
                            <span className="text-sm font-black">{def.goldenRuleMinutes || '--'}m</span>
                            <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100">edit</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {recentStats[def.title] ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-on-surface-variant">{recentStats[def.title].avg}m avg</span>
                            <span className="text-[8px] uppercase font-black tracking-widest text-on-surface-variant opacity-40">{recentStats[def.title].count} logs</span>
                          </div>
                        ) : (
                          <span className="text-[10px] italic text-on-surface-variant opacity-30">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                         <button 
                          onClick={() => { setEditingId(def.id); setEditMinutes(def.goldenRuleMinutes || 0); setEditMultiplier(def.tierMultiplier); }}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                         >
                           <span className="material-symbols-outlined text-[18px]">tune</span>
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION: Staff Observed Pool (Learning Queue) */}
          <div className="bg-white rounded-[32px] border border-outline-variant/10 shadow-xl overflow-hidden mt-8">
            <div className="px-6 py-5 border-b border-outline-variant/10 bg-surface-container-highest flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                   <span className="material-symbols-outlined">biotech</span>
                 </div>
                 <div>
                   <h3 className="font-bold text-on-surface">Staff Observed Pool</h3>
                   <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black opacity-40">Learning Queue (From task_calibration)</p>
                 </div>
               </div>
               <div className="relative">
                 <input 
                   type="text" 
                   placeholder="Filter inputs..."
                   className="bg-surface-container rounded-full px-4 py-1.5 text-xs font-bold border-none outline-none w-48 focus:ring-2 focus:ring-secondary/20"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
               </div>
            </div>
            
            <div className="overflow-x-auto no-scrollbar -mx-2 px-2">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant/10">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Task Observed</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Staff</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Duration</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Current Performance</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Standardize</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {filteredInputs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <span className="text-xs font-bold text-on-surface-variant opacity-30 uppercase tracking-widest">No staff inputs logged yet</span>
                      </td>
                    </tr>
                  ) : filteredInputs.map((input) => (
                    <tr key={input.id} className="hover:bg-secondary/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-on-surface">{input.task_title}</p>
                        {input.task_note && <p className="text-[10px] text-on-surface-variant italic truncate max-w-xs">{input.task_note}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-[10px] font-bold">
                            {input.profiles?.full_name?.charAt(0) || 'S'}
                          </div>
                          <span className="text-xs font-bold text-on-surface-variant">{input.profiles?.full_name || 'Staff'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-black text-on-surface">{input.actual_duration_minutes}m</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">{input.points_awarded} Points</span>
                          <span className="text-[8px] font-bold text-on-surface-variant uppercase opacity-40">Tier Multiplier: {input.tier_val}x</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handlePromoteToKeyword(input)}
                            className="px-3 py-1.5 rounded-xl bg-primary/5 text-primary text-[10px] font-black uppercase tracking-tighter hover:bg-primary/10"
                            title="Add to Point Ledger as Fixed Rule"
                          >
                            + Keyword
                          </button>
                          <button 
                            onClick={() => handlePromoteToDefinition(input)}
                            className="px-3 py-1.5 rounded-xl bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-tighter hover:bg-secondary/20"
                            title="Add to Standard Definitions as Golden Rule"
                          >
                            + Standard
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Card */}
          <div className="p-8 rounded-[32px] bg-surface-container-lowest border border-outline-variant/10 flex items-start gap-6 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">shield_person</span>
            </div>
            <div>
              <h4 className="font-bold text-on-surface mb-2 tracking-tight">Justifying Tiers & Rewards</h4>
              <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
                <p>
                  <strong className="text-primary">Tier 1-2 (Routine):</strong> High-frequency, low-complexity tasks. Best for <strong>Keyword Rules</strong> to automate tier assignment and prevent point inflation.
                </p>
                <p>
                  <strong className="text-primary">Tier 3-5 (Specialized):</strong> Critical operations requiring expertise. Use <strong>Golden Rules</strong> to reward efficiency and speed without compromising quality.
                </p>
                <p className="pt-2 text-[11px] font-bold text-on-surface-variant italic">
                  Note: Keywords match against both the Task Title and Note to automatically categorize staff effort.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeywordAddRow({ config, setConfig }: { config: MeritConfig, setConfig: (c: MeritConfig) => void }) {
  const [keyword, setKeyword] = useState('');
  const [tierLevel, setTierLevel] = useState(1);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    
    const rule: KeywordRule = {
      id: crypto.randomUUID(),
      keyword: keyword.trim(),
      points: points > 0 ? points : undefined,
      tierLevel
    };
    
    const newRules = [...(config.keywordRules || []), rule];
    const newConfig = { ...config, keywordRules: newRules };
    
    // Update both local and parent state immediately
    setConfig(newConfig);
    setKeyword('');
    setPoints(0);

    // Auto-save to Supabase
    try {
      await supabase.from('system_configs').upsert({ key: 'merit_config', value: newConfig }, { onConflict: 'key' });
    } catch (err) {
      console.error("Failed to save keyword:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="bg-primary/[0.04]">
      <td className="px-6 py-5">
        <input 
          type="text" 
          placeholder="Enter keyword or intent..."
          className="w-full bg-white border border-primary/20 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
      </td>
      <td className="px-6 py-5">
        <select 
          className="bg-white border border-primary/20 rounded-xl px-3 py-2 text-sm font-bold outline-none cursor-pointer hover:border-primary/50"
          value={tierLevel}
          onChange={e => setTierLevel(parseInt(e.target.value))}
        >
          {[1,2,3,4,5].map(t => (
            <option key={t} value={t}>Tier {t}: {(config as any)[`tier${t}Name`]}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-5">
        <div className="relative w-40">
          <input 
            type="number" 
            placeholder="0 (Dynamic)"
            className="w-full bg-white border border-primary/20 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
            value={points || ''}
            onChange={e => setPoints(parseInt(e.target.value) || 0)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-primary opacity-40">PTS</span>
        </div>
      </td>
      <td className="px-6 py-5 text-right">
        <button 
          onClick={handleAdd}
          disabled={loading || !keyword.trim()}
          className="bg-primary text-white px-4 py-2 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50 flex items-center gap-2 ml-auto"
        >
          {loading ? <span className="animate-spin material-symbols-outlined text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">add_circle</span>}
          <span>Add Rule</span>
        </button>
      </td>
    </tr>
  );
}
