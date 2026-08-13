"use client";

interface TimerRingProps {
  timeLeft: number;
  total?: number;
  size?: number;
}

export function TimerRing({ timeLeft, total = 30, size = 56 }: TimerRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / total;
  const dashOffset = circumference * (1 - progress);
  const isLongTimer = total > 120;
  const displayTime = isLongTimer ? `${Math.ceil(timeLeft / 60)}m` : timeLeft;

  const color = isLongTimer
    ? timeLeft > 10 * 60 ? "#1E3A8A" : timeLeft > 5 * 60 ? "#D97706" : "#DC2626"
    : timeLeft > 10 ? "#1E3A8A" : timeLeft > 5 ? "#D97706" : "#DC2626";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-[family-name:var(--font-dm-mono)] font-bold text-sm leading-none"
          style={{ color }}
        >
          {displayTime}
        </span>
      </div>
    </div>
  );
}
