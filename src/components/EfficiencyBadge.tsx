import React from 'react';

interface EfficiencyBadgeProps {
  score?: number | null;
  isFlagged?: boolean;
}

const EfficiencyBadge: React.FC<EfficiencyBadgeProps> = ({ score, isFlagged }) => {
  if (score === undefined || score === null) return null;
  const numScore = Number(score);
  const color = isFlagged 
    ? 'text-error bg-error/10 border-error/20' 
    : numScore >= 0.9 
      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
      : 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all hover:scale-105 ${color}`}>
      <span className="material-symbols-outlined text-[12px]">{isFlagged ? 'speed' : 'bolt'}</span>
      {Math.round(numScore * 100)}% EFF
    </div>
  );
};

export default EfficiencyBadge;
