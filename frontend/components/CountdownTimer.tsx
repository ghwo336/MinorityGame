"use client";

import { useEffect, useState } from "react";
import { getTimeRemaining } from "@/lib/utils";

interface CountdownTimerProps {
  startTime: bigint;
  duration: bigint;
  compact?: boolean;
}

export default function CountdownTimer({ startTime, duration, compact }: CountdownTimerProps) {
  const [time, setTime] = useState(getTimeRemaining(startTime, duration));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(startTime, duration));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (time.expired) {
    return <span className="text-red-500 font-medium text-sm">Ended</span>;
  }

  const formatted = `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}:${String(time.seconds).padStart(2, "0")}`;

  if (compact) {
    return <span className="text-gray-500 dark:text-gray-400 font-mono text-sm tabular-nums">{formatted}</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-mono text-gray-600 dark:text-gray-400 tabular-nums">{formatted}</span>
    </div>
  );
}
