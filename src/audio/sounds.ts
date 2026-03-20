let audioCtx: AudioContext | null = null;
let soundEnabled = localStorage.getItem("emoji-mahjong-sound") !== "0";

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  localStorage.setItem("emoji-mahjong-sound", enabled ? "1" : "0");
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gainValue = 0.15,
): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playRamp(
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType = "sine",
  gainValue = 0.15,
): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Short 400Hz blip, 80ms */
export function playDiscard(): void {
  playTone(400, 0.08, "square", 0.1);
}

/** Rising tone 300-500Hz, 100ms */
export function playDraw(): void {
  playRamp(300, 500, 0.1);
}

/** Two-note fanfare 500Hz then 700Hz, 200ms total */
export function playPon(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const now = ctx.currentTime;

  for (const [freq, offset] of [
    [500, 0],
    [700, 0.1],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + offset);
    gain.gain.setValueAtTime(0.15, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.1);
  }
}

/** Descending tone 600-300Hz, 300ms */
export function playRiichi(): void {
  playRamp(600, 300, 0.3, "sawtooth", 0.1);
}

/** Three-note ascending arpeggio C5-E5-G5, 400ms total */
export function playWin(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  // C5=523.25, E5=659.25, G5=783.99
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((freq, i) => {
    const offset = i * 0.13;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + offset);
    gain.gain.setValueAtTime(0.15, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.14);
  });
}

/** Chord burst, 200ms */
export function playGameStart(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  // C4, E4, G4 chord
  const freqs = [261.63, 329.63, 392.0];

  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  });
}
