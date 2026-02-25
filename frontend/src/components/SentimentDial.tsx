import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface SentimentDialProps {
  score: number; // 0-100
  confidence?: number; // 0: low, 1: medium, 2: high
  size?: 'sm' | 'md' | 'lg'; // 200px, 300px, 400px
  animated?: boolean;
  locked?: boolean; // If true, dial is static
  isLive?: boolean; // Show "LIVE" badge when true
  className?: string;
}

const CONFIDENCE_LABELS = {
  0: 'Low Confidence',
  1: 'Medium Confidence',
  2: 'High Confidence',
} as const;

export function SentimentDial({
  score,
  confidence = 1,
  size = 'md',
  animated = true,
  locked = false,
  isLive = false,
  className = '',
}: SentimentDialProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const normalizedScore = Math.max(0, Math.min(100, score));

  // Dial sizing
  const sizes = {
    sm: 200,
    md: 300,
    lg: 400,
  };

  const dialSize = sizes[size];
  const radius = dialSize / 2;
  const innerRadius = radius * 0.75;
  const needleLength = radius * 0.65;

  // Animation: animate score from 0 to final value
  useEffect(() => {
    if (!animated) {
      setDisplayScore(normalizedScore);
      return;
    }

    const duration = 1.5; // seconds
    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: cubic-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(normalizedScore * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [normalizedScore, animated]);

  // Calculate needle rotation
  // Needle rotates from -90 degrees (0%) to 90 degrees (100%)
  const needleRotation = -90 + (displayScore / 100) * 180;

  // Color based on score
  const getColor = (value: number) => {
    if (value < 30) return '#ef4444'; // Red
    if (value < 70) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  const dialColor = getColor(displayScore);

  // Confidence color
  const confidenceColor =
    confidence === 2 ? '#10b981' : confidence === 1 ? '#f59e0b' : '#ef4444';

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* SVG Dial */}
      <div className="relative" style={{ width: dialSize, height: dialSize }}>
        <svg
          width={dialSize}
          height={dialSize}
          viewBox={`0 0 ${dialSize} ${dialSize}`}
          className="drop-shadow-lg"
        >
          <defs>
            {/* Background gradient */}
            <linearGradient id="dialBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>

            {/* Red zone gradient */}
            <linearGradient id="redZone" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.5" />
            </linearGradient>

            {/* Yellow zone gradient */}
            <linearGradient id="yellowZone" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#eab308" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ca8a04" stopOpacity="0.5" />
            </linearGradient>

            {/* Green zone gradient */}
            <linearGradient id="greenZone" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#16a34a" stopOpacity="0.5" />
            </linearGradient>

            {/* Needle glow */}
            <filter id="needleGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background circle */}
          <circle
            cx={radius}
            cy={radius}
            r={radius - 10}
            fill="url(#dialBg)"
            stroke="#374151"
            strokeWidth="1"
          />

          {/* Sentiment zones (background arcs) */}
          {/* Red zone (0-30) */}
          <circle
            cx={radius}
            cy={radius}
            r={radius - 20}
            fill="none"
            stroke="url(#redZone)"
            strokeWidth="8"
            strokeDasharray={`${(30 / 100) * 2 * Math.PI * (radius - 20)} 10000`}
            strokeDashoffset="-90"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Yellow zone (30-70) */}
          <circle
            cx={radius}
            cy={radius}
            r={radius - 20}
            fill="none"
            stroke="url(#yellowZone)"
            strokeWidth="8"
            strokeDasharray={`${(40 / 100) * 2 * Math.PI * (radius - 20)} 10000`}
            strokeDashoffset={`-${90 + (30 / 100) * 180}`}
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Green zone (70-100) */}
          <circle
            cx={radius}
            cy={radius}
            r={radius - 20}
            fill="none"
            stroke="url(#greenZone)"
            strokeWidth="8"
            strokeDasharray={`${(30 / 100) * 2 * Math.PI * (radius - 20)} 10000`}
            strokeDashoffset={`-${90 + 180}`}
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Tick marks and labels */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = -90 + (tick / 100) * 180;
            const rad = (angle * Math.PI) / 180;
            const x1 = radius + (radius - 30) * Math.cos(rad);
            const y1 = radius + (radius - 30) * Math.sin(rad);
            const x2 = radius + (radius - 10) * Math.cos(rad);
            const y2 = radius + (radius - 10) * Math.sin(rad);

            return (
              <g key={`tick-${tick}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#9ca3af"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Center circle */}
          <circle
            cx={radius}
            cy={radius}
            r={15}
            fill={dialColor}
            stroke="white"
            strokeWidth="3"
            filter="url(#needleGlow)"
          />

          {/* Needle */}
          <g
            transform={`rotate(${needleRotation} ${radius} ${radius})`}
            style={{
              transformOrigin: `${radius}px ${radius}px`,
            }}
          >
            {/* Needle shadow */}
            <line
              x1={radius}
              y1={radius}
              x2={radius}
              y2={radius - needleLength}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.5"
            />

            {/* Needle */}
            <line
              x1={radius}
              y1={radius}
              x2={radius}
              y2={radius - needleLength}
              stroke={dialColor}
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#needleGlow)"
            />

            {/* Needle cap */}
            <circle
              cx={radius}
              cy={radius - needleLength}
              r="6"
              fill={dialColor}
              stroke="white"
              strokeWidth="2"
            />
          </g>

          {/* Inner circle (decoration) */}
          <circle
            cx={radius}
            cy={radius}
            r={innerRadius}
            fill="rgba(0,0,0,0.1)"
            stroke="none"
          />
        </svg>

        {/* Score overlay text (centered on dial) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center">
            <div
              className="text-5xl font-bold transition-colors duration-300"
              style={{ color: dialColor }}
            >
              {Math.round(displayScore)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Sentiment</div>
          </div>
        </div>
      </div>

      {/* Confidence indicator + LIVE badge */}
      <div className="flex items-center gap-4">
        {confidence !== undefined && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: confidenceColor }}
            />
            <span className="text-sm text-gray-300">
              {CONFIDENCE_LABELS[confidence as keyof typeof CONFIDENCE_LABELS]}
            </span>
          </div>
        )}
        {isLive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-400">LIVE</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-xs text-gray-400 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span>Disagree (0-30)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span>Neutral (30-70)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Agree (70-100)</span>
        </div>
      </div>
    </div>
  );
}
