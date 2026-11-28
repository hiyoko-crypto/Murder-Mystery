/**
 * Sound effects synthesized with the Web Audio API, so no audio files are
 * needed. The palette is film noir: leather shoes on stone, typewriter keys,
 * dark inharmonic bells, low pads, and a touch of room reverb on everything.
 *
 * Browsers only start audio after a user gesture, which is always the case
 * here (every effect is triggered from a click or follows one). Add a new
 * effect by building nodes and connecting them to `out()`; muting, master
 * volume and reverb are handled in one place.
 */

const MUTE_KEY = 'poirot_sfx_muted'
const MASTER_VOLUME = 0.7
const REVERB_SEND = 0.3

let ctx: AudioContext | null = null
let bus: GainNode | null = null

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // storage unavailable: the setting just won't persist
  }
}

/** A short dark room: decaying noise as an impulse response. */
function roomImpulse(c: AudioContext, seconds = 1.8): AudioBuffer {
  const length = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, length, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
    }
  }
  return buf
}

/** The audio context, or null when muted or unavailable. */
function audio(): AudioContext | null {
  if (isMuted()) return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = MASTER_VOLUME
      master.connect(ctx.destination)

      bus = ctx.createGain()
      bus.connect(master)
      const send = ctx.createGain()
      send.gain.value = REVERB_SEND
      const room = ctx.createConvolver()
      room.buffer = roomImpulse(ctx)
      bus.connect(send)
      send.connect(room)
      room.connect(master)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function out(): AudioNode {
  return bus as GainNode
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** A pitched note with a fast attack and an exponential decay. */
function tone(c: AudioContext, opts: {
  freq: number
  at: number
  length: number
  volume: number
  type?: OscillatorType
  slideTo?: number
}): void {
  const osc = c.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.freq, opts.at)
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, opts.at + opts.length)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, opts.at)
  gain.gain.linearRampToValueAtTime(opts.volume, opts.at + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.001, opts.at + opts.length)
  osc.connect(gain).connect(out())
  osc.start(opts.at)
  osc.stop(opts.at + opts.length + 0.02)
}

/** A burst of filtered noise (taps, rustles, steps). */
function noise(c: AudioContext, opts: {
  at: number
  length: number
  volume: number
  freq: number
  q?: number
  attack?: number
  filter?: BiquadFilterType
}): void {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, opts.length + 0.05)
  const filter = c.createBiquadFilter()
  filter.type = opts.filter ?? 'bandpass'
  filter.frequency.value = opts.freq
  filter.Q.value = opts.q ?? 0.9
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, opts.at)
  gain.gain.linearRampToValueAtTime(opts.volume, opts.at + (opts.attack ?? 0.004))
  gain.gain.exponentialRampToValueAtTime(0.001, opts.at + opts.length)
  src.connect(filter).connect(gain).connect(out())
  src.start(opts.at)
}

/** A dark bell: inharmonic partials that ring out for a while. */
function bell(c: AudioContext, freq: number, at: number, length: number, volume: number): void {
  const partials: [number, number][] = [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]]
  for (const [ratio, amp] of partials) {
    tone(c, { freq: freq * ratio, at, length: length / Math.sqrt(ratio), volume: volume * amp })
  }
}

/** A slow, filtered string-like pad chord. */
function pad(c: AudioContext, freqs: number[], at: number, length: number, volume: number): void {
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 650
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(volume, at + 0.25)
  gain.gain.exponentialRampToValueAtTime(0.001, at + length)
  filter.connect(gain).connect(out())
  for (const freq of freqs) {
    for (const detune of [-6, 6]) {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(at)
      osc.stop(at + length + 0.05)
    }
  }
}

/** A quiet wooden tap. Only used for the sound on/off button. */
export function click(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  noise(c, { at: t, length: 0.04, volume: 0.1, freq: 1800, q: 1.2 })
  tone(c, { freq: 170, slideTo: 110, at: t, length: 0.06, volume: 0.1 })
}

/** One typewriter key (called every few characters of typed text). */
export function blip(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const v = 0.7 + Math.random() * 0.5
  noise(c, { at: t, length: 0.02, volume: 0.05 * v, freq: 3200, q: 0.7, filter: 'highpass' })
  tone(c, { freq: 150 + Math.random() * 30, slideTo: 90, at: t, length: 0.035, volume: 0.045 * v })
}

/** Paper being slid across a desk / a file opening. */
export function paper(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  noise(c, { at: t, length: 0.32, volume: 0.22, freq: 2400, q: 0.6, attack: 0.1 })
  noise(c, { at: t + 0.18, length: 0.26, volume: 0.15, freq: 3200, q: 0.7, attack: 0.08 })
}

/** A heavy stamp coming down (the accusation). */
export function stamp(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(c, { freq: 95, slideTo: 32, at: t, length: 0.5, volume: 0.6 })
  noise(c, { at: t, length: 0.14, volume: 0.4, freq: 420, q: 0.5, filter: 'lowpass' })
}

/** A low, dark bell: something new opened up. */
export function chime(): void {
  const c = audio()
  if (!c) return
  bell(c, 196, c.currentTime, 2.6, 0.13)
}

/** A soft minor-third figure: a clue was found. */
export function discover(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  bell(c, 261.6, t, 1.1, 0.07)
  bell(c, 311.1, t + 0.14, 1.4, 0.06)
}

/** A minor chord that resolves to major: the case is solved. */
export function solved(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  pad(c, [65.4, 130.8, 155.6, 196], t, 1.4, 0.05)
  pad(c, [65.4, 130.8, 164.8, 196], t + 1.0, 3.0, 0.055)
  bell(c, 392, t + 1.05, 2.8, 0.08)
}

/** One footstep: a leather shoe on stone, with the heel clicking first. */
function step(c: AudioContext, at: number, volume: number): void {
  noise(c, { at, length: 0.012, volume: volume * 0.5, freq: 3600, q: 0.6, filter: 'highpass' })
  noise(c, { at: at + 0.006, length: 0.1, volume: volume * 0.55, freq: 520 + Math.random() * 120, q: 1.4 })
  tone(c, { freq: 82, slideTo: 50, at: at + 0.004, length: 0.12, volume: volume * 0.5 })
}

/** Walking footsteps; returns how long they last in milliseconds. */
export function footsteps(count = 4, interval = 0.3): number {
  const c = audio()
  if (!c) return count * interval * 1000
  const start = c.currentTime + 0.05
  for (let i = 0; i < count; i++) {
    step(c, start + i * interval, i % 2 === 0 ? 0.55 : 0.42)
  }
  return count * interval * 1000
}
