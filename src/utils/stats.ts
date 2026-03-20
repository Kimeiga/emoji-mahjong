const STORAGE_KEY = "emoji-mahjong-stats";

interface GameStats {
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
}

function defaultStats(): GameStats {
  return { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 };
}

export function getStats(): GameStats {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultStats();
  try {
    const parsed = JSON.parse(raw);
    return {
      wins: typeof parsed.wins === "number" ? parsed.wins : 0,
      losses: typeof parsed.losses === "number" ? parsed.losses : 0,
      draws: typeof parsed.draws === "number" ? parsed.draws : 0,
      gamesPlayed:
        typeof parsed.gamesPlayed === "number" ? parsed.gamesPlayed : 0,
    };
  } catch {
    return defaultStats();
  }
}

export function recordResult(result: "win" | "loss" | "draw"): void {
  const stats = getStats();
  stats.gamesPlayed += 1;
  if (result === "win") stats.wins += 1;
  else if (result === "loss") stats.losses += 1;
  else stats.draws += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}
