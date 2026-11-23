import { ref } from "vue";
import type { TurnView, WeaponType } from "../api/client";

const STORAGE_KEY = "guerra-naval:sound";

// Recorded sounds from soundza.com (free, no attribution required). A missing
// or broken file falls back to the synthesized sound.
const SAMPLES = {
  missileImpact: "/sounds/missile-impact.wav",
} as const;

type SampleName = keyof typeof SAMPLES;

// Fetched as soon as the page loads, decoded once there is an audio context.
const pending = new Map<SampleName, Promise<ArrayBuffer | null>>(
  (Object.keys(SAMPLES) as SampleName[]).map((name) => [
    name,
    fetch(SAMPLES[name])
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null),
  ]),
);

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "off";
  } catch {
    return false;
  }
}

// Sounds are synthesized with Web Audio, except the recorded samples above. The
// context is created on the first sound, which always follows a click, as
// browsers require.
export function createSoundboard() {
  const muted = ref(readMuted());
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  const samples = new Map<SampleName, AudioBuffer>();

  function decodeSamples(ctx: AudioContext) {
    for (const [name, data] of pending) {
      void data.then(async (bytes) => {
        if (!bytes) return;
        try {
          samples.set(name, await ctx.decodeAudioData(bytes));
        } catch {
          // Not a playable file: the synthesized sound stays.
        }
      });
    }
  }

  function audio(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
    if (muted.value || typeof AudioContext === "undefined") return null;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      decodeSamples(context);
    }
    if (context.state === "suspended") void context.resume();
    return { ctx: context, out: master!, noise: noise! };
  }

  function envelope(ctx: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return gain;
  }

  function noiseBurst(
    delay: number,
    { from, to, type, peak, attack, decay, q = 1 }: {
      from: number;
      to: number;
      type: BiquadFilterType;
      peak: number;
      attack: number;
      decay: number;
      q?: number;
    },
  ) {
    const a = audio();
    if (!a) return;
    const at = a.ctx.currentTime + delay;
    const source = a.ctx.createBufferSource();
    source.buffer = a.noise;
    const filter = a.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    const gain = envelope(a.ctx, at, peak, attack, decay);
    source.connect(filter).connect(gain).connect(a.out);
    source.start(at);
    source.stop(at + attack + decay + 0.05);
  }

  function tone(
    delay: number,
    { from, to, type, peak, attack, decay, pan }: {
      from: number;
      to: number;
      type: OscillatorType;
      peak: number;
      attack: number;
      decay: number;
      pan?: [number, number];
    },
  ) {
    const a = audio();
    if (!a) return;
    const at = a.ctx.currentTime + delay;
    const end = at + attack + decay;
    const osc = a.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, end);
    let node: AudioNode = osc.connect(envelope(a.ctx, at, peak, attack, decay));
    if (pan) {
      const panner = a.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan[0], at);
      panner.pan.linearRampToValueAtTime(pan[1], end);
      node = node.connect(panner);
    }
    node.connect(a.out);
    osc.start(at);
    osc.stop(end + 0.05);
  }

  const launch: Record<WeaponType, () => void> = {
    MISSILE: () => noiseBurst(0, { from: 3000, to: 400, type: "bandpass", peak: 0.5, attack: 0.05, decay: 0.32, q: 2 }),
    BOMB: () => tone(0, { from: 1400, to: 380, type: "sine", peak: 0.18, attack: 0.02, decay: 0.42 }),
    BOMBER: () => {
      tone(0, { from: 95, to: 80, type: "sawtooth", peak: 0.12, attack: 0.2, decay: 0.6, pan: [-0.9, 0.9] });
      noiseBurst(0, { from: 700, to: 500, type: "lowpass", peak: 0.25, attack: 0.25, decay: 0.55 });
    },
    TORPEDO: () => {
      tone(0, { from: 160, to: 90, type: "sine", peak: 0.35, attack: 0.04, decay: 0.45 });
      noiseBurst(0.05, { from: 900, to: 300, type: "bandpass", peak: 0.18, attack: 0.05, decay: 0.4, q: 4 });
    },
    RECON_PLANE: () => {
      tone(0, { from: 1180, to: 1160, type: "sine", peak: 0.3, attack: 0.01, decay: 0.9 });
      tone(0.35, { from: 1180, to: 1160, type: "sine", peak: 0.08, attack: 0.01, decay: 0.7 });
    },
    NUKE: () => {
      tone(0, { from: 220, to: 880, type: "sawtooth", peak: 0.08, attack: 0.3, decay: 0.25 });
      tone(0, { from: 1800, to: 300, type: "sine", peak: 0.16, attack: 0.02, decay: 0.5 });
    },
  };

  // Plays a recorded sample; false when it is not loaded, so the caller synthesizes.
  function sample(name: SampleName, delay: number, gain = 1): boolean {
    const a = audio();
    const buffer = samples.get(name);
    if (!a || !buffer) return false;
    const source = a.ctx.createBufferSource();
    source.buffer = buffer;
    const level = a.ctx.createGain();
    level.gain.value = gain;
    source.connect(level).connect(a.out);
    source.start(a.ctx.currentTime + delay);
    return true;
  }

  function explosion(delay: number, big: boolean) {
    noiseBurst(delay, { from: big ? 1600 : 1200, to: 80, type: "lowpass", peak: big ? 0.9 : 0.7, attack: 0.01, decay: big ? 1.1 : 0.7 });
    tone(delay, { from: big ? 90 : 120, to: 35, type: "sine", peak: big ? 0.8 : 0.6, attack: 0.01, decay: big ? 0.8 : 0.5 });
  }

  function splash(delay: number) {
    noiseBurst(delay, { from: 2500, to: 700, type: "bandpass", peak: 0.35, attack: 0.02, decay: 0.38, q: 0.8 });
  }

  function spotted(delay: number) {
    tone(delay, { from: 880, to: 880, type: "triangle", peak: 0.2, attack: 0.01, decay: 0.15 });
    tone(delay + 0.12, { from: 1320, to: 1320, type: "triangle", peak: 0.2, attack: 0.01, decay: 0.25 });
  }

  // A ship goes down: a deep rumble and metal groaning as it sinks.
  function sunk(delay: number) {
    noiseBurst(delay, { from: 500, to: 60, type: "lowpass", peak: 0.8, attack: 0.05, decay: 1.6 });
    tone(delay, { from: 70, to: 28, type: "sine", peak: 0.7, attack: 0.05, decay: 1.4 });
    tone(delay + 0.15, { from: 420, to: 140, type: "sawtooth", peak: 0.06, attack: 0.2, decay: 1.1 });
    noiseBurst(delay + 0.5, { from: 1200, to: 300, type: "bandpass", peak: 0.15, attack: 0.3, decay: 0.9, q: 3 });
  }

  // The launch now, the impact when the animation lands (impactMs) and, if the
  // turn sank a ship, the sinking right after.
  function turn(played: TurnView, impactMs: number, sank = false) {
    if (muted.value) return;
    launch[played.weapon]();
    const at = impactMs / 1000;
    if (played.weapon === "RECON_PLANE") {
      if (played.outcomes.some((o) => o.result === "SPOTTED")) spotted(at);
      return;
    }
    if (played.outcomes.some((o) => o.result === "HIT")) {
      const recorded = played.weapon === "MISSILE" && sample("missileImpact", at);
      if (!recorded) explosion(at, played.weapon === "BOMB" || played.weapon === "NUKE");
      if (played.weapon === "NUKE") sunk(at + 0.1);
    } else splash(at);
    if (sank) sunk(at + 0.35);
  }

  // CU-06: a rising fanfare for a victory, a falling one for a defeat.
  function finale(won: boolean, delayMs = 0) {
    if (muted.value) return;
    const at = delayMs / 1000;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.23, 311.13, 233.08];
    notes.forEach((frequency, i) =>
      tone(at + i * (won ? 0.14 : 0.26), {
        from: frequency,
        to: frequency,
        type: won ? "triangle" : "sine",
        peak: 0.25,
        attack: 0.02,
        decay: i === notes.length - 1 ? 1.1 : 0.35,
      }),
    );
  }

  function toggle() {
    muted.value = !muted.value;
    try {
      localStorage.setItem(STORAGE_KEY, muted.value ? "off" : "on");
    } catch {
      // Only this page remembers it.
    }
  }

  return { muted, turn, finale, toggle };
}
