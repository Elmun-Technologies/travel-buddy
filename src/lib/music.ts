// A short tune (~4 s) when a country is picked or opened. Composed here, not recorded: a plucked
// string (Karplus–Strong) playing a motif in the region's own mode over a soft drone. Original work,
// so nothing to license (owner wanted music without legal risk). Same mute switch as UI sounds.
// To use a real recording for a country later, drop /public/music/<CODE>.mp3 and list it in RECORDED.

import { soundOn } from "./sound";

// Semitone steps from the tonic.
const MODES = {
  caucasus: [0, 2, 3, 5, 7, 9, 10], // dorian, Georgian/Armenian polyphony colour
  hijaz: [0, 1, 4, 5, 7, 8, 10], // Turkey, Arab world
  centralAsia: [0, 2, 4, 5, 7, 9, 11], // major with dotar drone
  slavic: [0, 2, 3, 5, 7, 8, 10], // natural minor
  pentatonic: [0, 2, 4, 7, 9], // China, Korea, Vietnam
  in: [0, 1, 5, 7, 8], // Japan
  pelog: [0, 1, 3, 7, 8], // Indonesia, Malaysia, Thailand
  raga: [0, 1, 4, 5, 7, 8, 11], // India, Sri Lanka, Maldives (bhairav)
  phrygian: [0, 1, 3, 5, 7, 8, 10], // Spain, Greece
  major: [0, 2, 4, 5, 7, 9, 11], // Western Europe, US
} as const;
type Mode = keyof typeof MODES;

const REGION: Record<string, { mode: Mode; tonic: number; tempo: number }> = {
  GE: { mode: "caucasus", tonic: 57, tempo: 0.2 },
  AM: { mode: "caucasus", tonic: 55, tempo: 0.22 },
  AZ: { mode: "hijaz", tonic: 57, tempo: 0.18 },
  TR: { mode: "hijaz", tonic: 60, tempo: 0.17 },
  AE: { mode: "hijaz", tonic: 59, tempo: 0.2 },
  SA: { mode: "hijaz", tonic: 57, tempo: 0.22 },
  QA: { mode: "hijaz", tonic: 58, tempo: 0.2 },
  EG: { mode: "hijaz", tonic: 55, tempo: 0.19 },
  UZ: { mode: "centralAsia", tonic: 57, tempo: 0.16 },
  KZ: { mode: "centralAsia", tonic: 55, tempo: 0.18 },
  KG: { mode: "centralAsia", tonic: 60, tempo: 0.17 },
  TJ: { mode: "centralAsia", tonic: 58, tempo: 0.19 },
  RU: { mode: "slavic", tonic: 57, tempo: 0.22 },
  CZ: { mode: "slavic", tonic: 60, tempo: 0.18 },
  CN: { mode: "pentatonic", tonic: 62, tempo: 0.18 },
  KR: { mode: "pentatonic", tonic: 60, tempo: 0.2 },
  VN: { mode: "pentatonic", tonic: 64, tempo: 0.16 },
  JP: { mode: "in", tonic: 62, tempo: 0.24 },
  ID: { mode: "pelog", tonic: 60, tempo: 0.16 },
  MY: { mode: "pelog", tonic: 62, tempo: 0.17 },
  TH: { mode: "pelog", tonic: 64, tempo: 0.17 },
  IN: { mode: "raga", tonic: 57, tempo: 0.19 },
  LK: { mode: "raga", tonic: 59, tempo: 0.2 },
  MV: { mode: "raga", tonic: 62, tempo: 0.18 },
  ES: { mode: "phrygian", tonic: 57, tempo: 0.15 },
  GR: { mode: "phrygian", tonic: 62, tempo: 0.18 },
  IT: { mode: "major", tonic: 62, tempo: 0.17 },
  FR: { mode: "major", tonic: 60, tempo: 0.2 },
  DE: { mode: "major", tonic: 57, tempo: 0.2 },
  GB: { mode: "major", tonic: 59, tempo: 0.19 },
  US: { mode: "major", tonic: 60, tempo: 0.16 },
};

const RECORDED = new Set<string>(); // countries with a licensed file in /public/music

/** A little melody per country: the same country always plays the same tune. */
export function motif(country: string) {
  const r = REGION[country] ?? REGION.UZ;
  const scale = MODES[r.mode];
  let seed = [...country].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const notes: { midi: number; at: number; dur: number }[] = [];
  let degree = 0;
  let t = 0;
  for (let i = 0; i < 10; i++) {
    // mostly stepwise, sometimes a leap; ends back on the tonic
    degree =
      i === 9
        ? 0
        : Math.max(-2, Math.min(scale.length + 2, degree + [-1, 1, 1, 2, -2, 0][Math.floor(rnd() * 6)]));
    const octave = Math.floor(degree / scale.length);
    const step = scale[((degree % scale.length) + scale.length) % scale.length];
    const long = i === 9 || rnd() < 0.2;
    notes.push({ midi: r.tonic + 12 + octave * 12 + step, at: t, dur: long ? r.tempo * 3 : r.tempo * 1.5 });
    t += long ? r.tempo * 2 : r.tempo;
  }
  return { notes, tonic: r.tonic, length: t + 1.2 };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Karplus–Strong plucked string, rendered once into a buffer. */
function pluck(a: AudioContext, f: number, dur: number) {
  const len = Math.floor(a.sampleRate * (dur + 0.6));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(a.sampleRate / f));
  const ring = new Float32Array(period).map(() => Math.random() * 2 - 1);
  for (let i = 0, p = 0; i < len; i++) {
    const next = (p + 1) % period;
    const v = 0.996 * 0.5 * (ring[p] + ring[next]);
    out[i] = ring[p];
    ring[p] = v;
    p = next;
  }
  return buf;
}

let ctx: AudioContext | null = null;
let playing: { stop: () => void } | null = null;

export function playCountry(country: string) {
  if (typeof window === "undefined" || !soundOn()) return;
  playing?.stop();
  if (RECORDED.has(country)) {
    const el = new Audio(`/music/${country}.mp3`);
    el.volume = 0.5;
    void el.play().catch(() => {});
    playing = { stop: () => el.pause() };
    return;
  }
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  const a = ctx;
  if (a.state === "suspended") void a.resume();
  const m = motif(country);
  const t0 = a.currentTime + 0.05;
  const master = a.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.35, t0 + 0.08);
  master.gain.setValueAtTime(0.35, t0 + m.length - 0.8);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + m.length);
  master.connect(a.destination);
  const sources: AudioScheduledSourceNode[] = [];

  // soft drone: tonic and fifth, two octaves below the melody
  for (const midi of [m.tonic - 12, m.tonic - 5]) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "triangle";
    o.frequency.value = hz(midi);
    g.gain.value = 0.06;
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + m.length);
    sources.push(o);
  }
  for (const n of m.notes) {
    const s = a.createBufferSource();
    s.buffer = pluck(a, hz(n.midi), n.dur);
    const g = a.createGain();
    g.gain.value = 0.5;
    s.connect(g).connect(master);
    s.start(t0 + n.at);
    sources.push(s);
  }
  playing = {
    stop: () => {
      const now = a.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0.0001, now, 0.08);
      sources.forEach((s) => s.stop(now + 0.3));
    },
  };
}

export function stopMusic() {
  playing?.stop();
  playing = null;
}
