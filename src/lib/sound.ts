// UI sounds, synthesized with Web Audio: no audio files, nothing to license, ~0 KB to download.
// On by default (owner, 2026-11-15); one switch turns them off, remembered on this device.
// Nothing plays before the first tap (browser autoplay rules), and the phone's silent switch
// mutes Web Audio on iOS anyway.

const KEY = "tb_sound";
type Note = { f: number; at: number; dur: number; type?: OscillatorType; gain?: number; to?: number };

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // private mode: the choice lasts for this page only
  }
  listeners.forEach((l) => l());
}

export function subscribeSound(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function audio() {
  if (typeof window === "undefined" || !soundOn()) return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function play(notes: Note[], volume = 0.12) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + 0.005;
  const master = a.createGain();
  master.gain.value = volume;
  master.connect(a.destination);
  for (const n of notes) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = n.type ?? "sine";
    o.frequency.setValueAtTime(n.f, t0 + n.at);
    if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.dur);
    // soft attack, exponential tail: a "pluck" rather than a beep
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(n.gain ?? 1, t0 + n.at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    o.connect(g).connect(master);
    o.start(t0 + n.at);
    o.stop(t0 + n.at + n.dur + 0.02);
  }
}

// Notes of a major pentatonic around C6 — bright, never dissonant.
const C6 = 1046.5,
  D6 = 1174.7,
  E6 = 1318.5,
  G6 = 1568,
  A6 = 1760,
  C7 = 2093;

export const sound = {
  /** Any tap: a tiny soft tick. */
  tap: () => play([{ f: 1800, to: 1200, at: 0, dur: 0.035, type: "triangle", gain: 0.5 }], 0.06),
  /** Toggle, vote, check: a light pop. */
  pop: () => play([{ f: 520, to: 880, at: 0, dur: 0.09, type: "sine" }], 0.1),
  /** Message sent: a short upward swish. */
  send: () => play([{ f: 600, to: 1400, at: 0, dur: 0.12, type: "triangle", gain: 0.6 }], 0.08),
  /** Saved / done: two-note chime. */
  success: () =>
    play([
      { f: E6, at: 0, dur: 0.18 },
      { f: A6, at: 0.09, dur: 0.32 },
    ]),
  /** Something went wrong: low, short, not alarming. */
  error: () =>
    play(
      [
        { f: 330, at: 0, dur: 0.14, type: "triangle" },
        { f: 262, at: 0.1, dur: 0.22, type: "triangle" },
      ],
      0.1,
    ),
  /** Big moments (trip opened, joined a group): a little rising arpeggio. */
  celebrate: () =>
    play(
      [C6, D6, E6, G6, A6, C7].map((f, i) => ({
        f,
        at: i * 0.07,
        dur: 0.45 - i * 0.03,
        gain: 0.9 - i * 0.08,
      })),
      0.11,
    ),
};
