const STORAGE_KEY = "emoji-mahjong-session";

interface Session {
  roomCode: string;
  playerName: string;
  myPlayerId: number;
}

export function saveSession(s: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.roomCode === "string" &&
      typeof parsed.playerName === "string" &&
      typeof parsed.myPlayerId === "number"
    ) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
