import React from 'react';

interface EnergyBarProps {
  label: string;
  current: number;
  max: number;
  type: 'energy' | 'xp';
}

export const EnergyBar: React.FC<EnergyBarProps> = ({ label, current, max, type }) => {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isLow = type === 'energy' && pct < 20;

  return (
    <div className="bar-container">
      <div className="bar-label">
        <span>{label}</span>
        <span>{Math.round(current)}/{max}</span>
      </div>
      <div className="bar-track">
        <div
          className={`bar-fill ${isLow ? 'low' : type}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
