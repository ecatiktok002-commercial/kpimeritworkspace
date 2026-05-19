import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Reward } from '@/lib/types';
import confetti from 'canvas-confetti';

interface RewardsStorePageProps {
  currentUserId: string;
  totalPoints: number;
  onPointsDeducted: (deducted: number) => void;
}

export default function RewardsStorePage({ currentUserId, totalPoints, onPointsDeducted }: RewardsStorePageProps) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('point_cost', { ascending: true });

    if (!error && data) {
      setRewards(data as Reward[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRewards();

    const channel = supabase.channel('rewards-store-sync');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, () => { fetchRewards(); });
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRewards]);

  const handleRedeem = async (reward: Reward) => {
    if (totalPoints < reward.point_cost) return;

    if (!window.confirm(`Are you sure you want to spend ${reward.point_cost} points on "${reward.title}"?`)) {
      return;
    }

    setRedeeming(reward.id);
    
    // Call our secure RPC function
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_user_id: currentUserId,
      p_reward_id: reward.id
    });

    setRedeeming(null);

    if (error) {
      alert(`Redemption failed: ${error.message}`);
      return;
    }

    // Success! Update local points
    onPointsDeducted(reward.point_cost);

    // Celebratory confetti
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#fbbf24']
    });

    alert(`🎉 Reward claimed! Management has been notified and will fulfill this shortly.`);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="mb-8 sm:mb-12 relative overflow-hidden bg-slate-900 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-emerald-500/20 shadow-2xl flex flex-col items-center justify-center text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900/20 to-transparent"></div>
        <div className="relative z-10">
          <p className="text-emerald-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-2 sm:mb-4 text-[10px] sm:text-sm">Available Balance</p>
          <div className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 to-emerald-600 font-headline drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            {totalPoints.toLocaleString()}
          </div>
          <p className="text-slate-400 mt-4 max-w-md mx-auto text-xs sm:text-sm leading-relaxed">Spend your hard-earned merit points on exclusive rewards. Once claimed, management will approve and fulfill your request.</p>
        </div>
      </div>


      {loading ? (
        <div className="text-center text-emerald-500 font-bold uppercase tracking-widest">Loading Marketplace...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {rewards.map(reward => {
            const canAfford = totalPoints >= reward.point_cost;
            const isRedeeming = redeeming === reward.id;

            return (
              <div key={reward.id} className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 border border-slate-700 flex flex-col justify-between hover:bg-slate-800 transition-colors shadow-lg">
                <div>
                  <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                    <span className="material-symbols-outlined text-3xl text-emerald-400">{reward.icon_type}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{reward.title}</h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">{reward.description}</p>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Cost</span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-sm font-black font-headline">
                      {reward.point_cost} pts
                    </span>
                  </div>

                  <button
                    disabled={!canAfford || isRedeeming}
                    onClick={() => handleRedeem(reward)}
                    className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                      canAfford
                        ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isRedeeming ? 'Processing...' : canAfford ? 'Redeem Reward' : `Need ${reward.point_cost - totalPoints} more`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
