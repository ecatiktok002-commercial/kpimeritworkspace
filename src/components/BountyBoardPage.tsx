import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Bounty, Task } from '@/lib/types';

interface BountyBoardPageProps {
  currentUserId: string;
  onBountyClaimed: (task: Task) => void;
}

export default function BountyBoardPage({ currentUserId, onBountyClaimed }: BountyBoardPageProps) {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBounties();

    const channel = supabase.channel('bounty-board-sync');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bounties' }, () => { fetchBounties(); });
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBounties = async () => {
    const { data, error } = await supabase
      .from('bounties')
      .select('*')
      .eq('status', 'open')
      .order('point_reward', { ascending: false });

    if (!error && data) {
      setBounties(data as Bounty[]);
    }
    setLoading(false);
  };

  const handleClaim = async (bounty: Bounty) => {
    // 1. Update Bounty Status
    const { error: bountyError } = await supabase
      .from('bounties')
      .update({ status: 'claimed', claimed_by: currentUserId })
      .eq('id', bounty.id);

    if (bountyError) {
      alert('Failed to claim bounty. Someone else might have grabbed it!');
      return;
    }

    // 2. Remove from local view
    setBounties(prev => prev.filter(b => b.id !== bounty.id));

    // 3. Create a linked task
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: `[BOUNTY] ${bounty.title}`,
      note: bounty.description,
      totalSec: 3600, // Default 1 hour estimation
      elapsedSec: 0,
      status: 'queued',
      tierName: 'Bounty',
      tierVal: 2.0,
      points: bounty.point_reward, // Hardcode the bounty points
      commencementDate: new Date().toISOString(),
      ownerId: currentUserId,
      collaboratorIds: [],
      collaborators: [],
      frequency: { type: 'once' },
      isContinuous: false,
      workflow: []
    };

    // 4. Save Task to Supabase
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const dbTask = {
      id: newTask.id,
      title: newTask.title,
      note: newTask.note,
      total_sec: newTask.totalSec,
      elapsed_sec: newTask.elapsedSec,
      status: newTask.status,
      tier_name: newTask.tierName,
      tier_val: newTask.tierVal,
      points: newTask.points,
      staff_id: isUUID(currentUserId) ? currentUserId : '00000000-0000-0000-0000-000000000000'
    };

    await supabase.from('tasks').insert([dbTask]);

    // 5. Update parent state
    onBountyClaimed(newTask);

    // Provide gamified feedback
    alert(`🎯 BOUNTY CLAIMED! "${bounty.title}" added to your active tasks.`);
  };

  if (loading) {
    return <div className="p-10 text-center text-amber-500 font-bold uppercase tracking-widest">Loading Bounties...</div>;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8 sm:mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-[0.2em] text-amber-400 font-headline drop-shadow-md">Bounty Board</h1>
        <p className="text-xs sm:text-sm font-bold text-on-surface-variant uppercase tracking-widest mt-2">High-Value Targets. Grab them before others do.</p>
      </div>

      {bounties.length === 0 ? (
        <div className="text-center py-16 sm:py-20 bg-slate-800/50 rounded-3xl border border-slate-700 backdrop-blur-md">
          <span className="material-symbols-outlined text-5xl sm:text-6xl text-slate-500 mb-4 block">radar</span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-300">No active bounties</h2>
          <p className="text-sm text-slate-500 mt-2 px-6">Check back later when management posts new targets.</p>
        </div>
      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bounties.map(bounty => (
            <div key={bounty.id} className="relative group bg-slate-900/80 rounded-3xl p-6 border-2 border-amber-500/20 hover:border-amber-500/60 transition-all duration-300 shadow-xl overflow-hidden backdrop-blur-md flex flex-col justify-between">
              {/* Decorative Wanted Poster Vibe */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 opacity-50 group-hover:opacity-100 transition-opacity" />
              
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">local_police</span>
                    Open Target
                  </div>
                  <div className="text-2xl font-black text-amber-400 font-headline">
                    +{bounty.point_reward}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2 leading-tight">{bounty.title}</h3>
                <p className="text-slate-400 text-sm mb-6 line-clamp-3">{bounty.description}</p>
              </div>

              <button
                onClick={() => handleClaim(bounty)}
                className="w-full py-4 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-900 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]"
              >
                <span>Claim Bounty</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
