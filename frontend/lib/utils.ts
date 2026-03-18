import { formatEther } from "viem";

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatETH(wei: bigint): string {
  return parseFloat(formatEther(wei)).toFixed(4);
}

export function getTimeRemaining(startTime: bigint): {
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
} {
  const endTime = Number(startTime) + 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;

  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  return {
    hours: Math.floor(diff / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    expired: false,
  };
}

export function getChoiceLabel(choice: number): string {
  switch (choice) {
    case 1:
      return "A";
    case 2:
      return "B";
    default:
      return "-";
  }
}

export function getStatusLabel(
  status: number,
  isTie: boolean
): string {
  if (status === 0) return "LIVE";
  if (isTie) return "DRAW";
  return "FINISHED";
}
