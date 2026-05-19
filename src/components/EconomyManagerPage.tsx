import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Bounty, Reward, RewardRedemption } from '@/lib/types';
import EfficiencyBadge from '@/components/EfficiencyBadge';

interface EconomyManagerProps {
  onBack?: () => void;
  viewedIds?: string[];
  markViewed?: (id: string) => void;
  tasks?: any[];
}

export default function EconomyManagerPage({ onBack, viewedIds = [], markViewed, tasks = [] }: EconomyManagerProps) {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [newBounty, setNewBounty] = useState({ title: '', description: '', points: 100 });
  const [newReward, setNewReward] = useState({ title: '', description: '', points: 500, icon: 'card_giftcard' });

  useEffect(() => {
    fetchData();

    // Realtime sync for economy tables
    const channel = supabase.channel('economy-manager-sync');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bounties' }, () => { fetchData(); });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, () => { fetchData(); });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => { fetchData(); });
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const [bRes, rRes, redRes] = await Promise.all([
      supabase.from('bounties').select('*').order('created_at', { ascending: false }),
      supabase.from('rewards').select('*').order('created_at', { ascending: false }),
      supabase.from('reward_redemptions').select(`
        *,
        profiles ( full_name ),
        rewards ( title, point_cost, icon_type )
      `).eq('status', 'pending').order('created_at', { ascending: false })
    ]);

    if (bRes.data) setBounties(bRes.data as Bounty[]);
    if (rRes.data) setRewards(rRes.data as Reward[]);
    if (redRes.data) setRedemptions(redRes.data as unknown as RewardRedemption[]);
    
    setLoading(false);
  };

  const handlePostBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBounty.title || !newBounty.description) return;
    
    const { data, error } = await supabase.from('bounties').insert([{
      title: newBounty.title,
      description: newBounty.description,
      point_reward: newBounty.points,
      status: 'open'
    }]).select();

    if (!error && data) {
      setBounties([data[0] as Bounty, ...bounties]);
      setNewBounty({ title: '', description: '', points: 100 });
      alert('Bounty posted to the board!');
    } else {
      alert('Error posting bounty');
    }
  };

  const handleDeleteBounty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bounty?')) return;
    const { error } = await supabase.from('bounties').delete().eq('id', id);
    if (!error) {
      setBounties(bounties.filter(b => b.id !== id));
    } else {
      alert('Error deleting bounty');
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReward.title || !newReward.description) return;

    const { data, error } = await supabase.from('rewards').insert([{
      title: newReward.title,
      description: newReward.description,
      point_cost: newReward.points,
      icon_type: newReward.icon,
      is_active: true
    }]).select();

    if (!error && data) {
      setRewards([data[0] as Reward, ...rewards]);
      setNewReward({ title: '', description: '', points: 500, icon: 'card_giftcard' });
      alert('Reward added to the store!');
    } else {
      alert('Error creating reward');
    }
  };

  const toggleRewardActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('rewards').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      setRewards(rewards.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
    }
  };

  const fulfillRedemption = async (id: string) => {
    if (!confirm('Mark this reward as fulfilled? This implies you have given the staff their reward.')) return;
    const { error } = await supabase.from('reward_redemptions').update({ status: 'fulfilled' }).eq('id', id);
    if (!error) {
      // realtime sync will update the UI
      alert('Marked as fulfilled!');
    }
  };

  if (loading) return <div className="p-10 text-center text-primary font-bold uppercase">Loading Reward Systems...</div>;

  return (
    <div className="mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Section 1: Post Bounties */}
        <section className="bg-surface-container rounded-3xl p-8 border border-outline-variant/10 shadow-lg">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">campaign</span>
            Post New Bounty
          </h2>
          <form onSubmit={handlePostBounty} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-on-surface-variant mb-1 block">Bounty Title</label>
              <input required value={newBounty.title} onChange={e => setNewBounty({...newBounty, title: e.target.value})} className="w-full bg-surface py-3 px-4 rounded-xl text-sm border border-outline-variant/20 focus:border-amber-500 outline-none transition-colors" placeholder="e.g. Audit Q3 Expenses" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-on-surface-variant mb-1 block">Description</label>
              <textarea required value={newBounty.description} onChange={e => setNewBounty({...newBounty, description: e.target.value})} className="w-full bg-surface py-3 px-4 rounded-xl text-sm border border-outline-variant/20 focus:border-amber-500 outline-none transition-colors h-24" placeholder="Task requirements..." />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-on-surface-variant mb-1 block">Point Reward</label>
              <input required type="number" value={newBounty.points} onChange={e => setNewBounty({...newBounty, points: Number(e.target.value)})} className="w-full bg-surface-container-high py-3 px-4 rounded-xl text-sm border border-outline-variant/20 focus:border-amber-500 outline-none transition-colors" />
            </div>
            <button type="submit" className="w-full bg-amber-500 text-slate-900 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 transition-colors shadow-md">
              Publish to Board
            </button>
          </form>

          <div className="mt-8 border-t border-outline-variant/10 pt-6">
            <h3 className="text-sm font-bold uppercase text-on-surface-variant mb-4">Recent Bounties</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {bounties.slice(0,5).map(b => (
                <div key={b.id} className="flex items-center justify-between bg-surface p-3 rounded-lg border border-outline-variant/10 group">
                  <div>
                    <div className="font-bold text-sm truncate w-48">{b.title}</div>
                    <div className="text-[10px] uppercase text-on-surface-variant font-bold">{b.status}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-amber-500 font-bold text-sm">+{b.point_reward} pts</div>
                    <button 
                      onClick={() => handleDeleteBounty(b.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-error hover:bg-error/10 p-1.5 rounded-lg flex items-center justify-center"
                      title="Delete Bounty"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Fulfillment Queue */}
        <section className="bg-surface-container rounded-3xl p-8 border border-outline-variant/10 shadow-lg flex flex-col">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500">inbox</span>
            Fulfillment Queue
            {redemptions.length > 0 && <span className="bg-error text-white text-xs px-2 py-0.5 rounded-full ml-auto">{redemptions.length}</span>}
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {redemptions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60 pt-10">
                <span className="material-symbols-outlined text-4xl mb-2">done_all</span>
                <p className="text-sm font-bold uppercase tracking-widest">Queue is Empty</p>
              </div>
            ) : (
              redemptions.map(r => {
                const isUnread = !viewedIds.includes(r.id);
                return (
                  <div 
                    key={r.id} 
                    onClick={() => markViewed?.(r.id)}
                    className={`bg-surface p-4 rounded-xl border shadow-sm relative overflow-hidden transition-all cursor-pointer ${isUnread ? 'border-error/30 bg-error/5 ring-1 ring-error/10' : 'border-emerald-500/20'}`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isUnread ? 'bg-error' : 'bg-emerald-500'}`}></div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-sm flex items-center gap-1.5">
                          {isUnread && <span className="w-2 h-2 rounded-full bg-error inline-block animate-pulse shadow-sm shadow-error/50"></span>}
                          {r.profiles?.full_name || 'Unknown Staff'}
                        </h4>
                        <p className="text-xs text-on-surface-variant">requested <span className="text-emerald-500 font-bold">{r.rewards?.title}</span></p>
                      </div>
                      <span className="text-xs font-black bg-surface-container-high px-2 py-1 rounded-md">{r.rewards?.point_cost} pts</span>
                    </div>
                    <div className="text-[10px] text-on-surface-variant mb-4">{new Date(r.created_at).toLocaleString()}</div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); fulfillRedemption(r.id); }} 
                      className="w-full py-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold uppercase transition-colors"
                    >
                      Mark as Fulfilled
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Section 3: Reward Inventory */}
      <section className="bg-surface-container rounded-3xl p-8 border border-outline-variant/10 shadow-lg">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">storefront</span>
          Reward Inventory
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <form onSubmit={handleCreateReward} className="space-y-4 bg-surface p-5 rounded-2xl border border-outline-variant/10">
              <h3 className="text-sm font-bold uppercase mb-4">Add New Reward</h3>
              <div>
                <label className="text-xs font-bold uppercase text-on-surface-variant mb-1 block">Title</label>
                <input required value={newReward.title} onChange={e => setNewReward({...newReward, title: e.target.value})} className="w-full bg-surface-container py-2 px-3 rounded-lg text-sm border border-outline-variant/20 outline-none" placeholder="e.g. $50 Gift Card" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-on-surface-variant mb-1 block">Description</label>
                <input required value={newReward.description} onChange={e => setNewReward({...newReward, description: e.target.value})} className="w-full bg-surface-container py-2 px-3 rounded-lg text-sm border border-outline-variant/20 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant mb-1 block">Cost</label>
                  <input required type="number" value={newReward.points} onChange={e => setNewReward({...newReward, points: Number(e.target.value)})} className="w-full bg-surface-container py-2 px-3 rounded-lg text-sm border border-outline-variant/20 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant mb-1 block">Icon (Material)</label>
                  <input required value={newReward.icon} onChange={e => setNewReward({...newReward, icon: e.target.value})} className="w-full bg-surface-container py-2 px-3 rounded-lg text-sm border border-outline-variant/20 outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold uppercase tracking-widest text-[10px] mt-2">
                Add to Store
              </button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-xs uppercase tracking-widest text-on-surface-variant">
                    <th className="pb-3 font-bold">Reward</th>
                    <th className="pb-3 font-bold">Cost</th>
                    <th className="pb-3 font-bold">Status</th>
                    <th className="pb-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {rewards.map(r => (
                    <tr key={r.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">{r.icon_type}</span>
                        <div>
                          <div className="font-bold">{r.title}</div>
                          <div className="text-[10px] text-on-surface-variant truncate w-48">{r.description}</div>
                        </div>
                      </td>
                      <td className="py-3 font-bold">{r.point_cost} pts</td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase ${r.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {r.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => toggleRewardActive(r.id, r.is_active)} className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">
                          {r.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
