/**
 * Sound effects synthesized with the Web Audio API, so no audio files are
 * needed. Browsers only start audio after a user gesture, which is always the
 * case here (every effect is triggered from a click or follows one).
 *
 * Add a new effect by writing a function that builds its nodes and connects
 * them to `out()`; muting and the master volume are handled in one place.
 */

const MUTE_KEY = 'poirot_sfx_muted'
const MASTER_VOLUME = 0.7

let ctx: AudioContext | null = null
let master: GainNode | null = null

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

/** The audio context, or null when muted or unavailable. */
function audio(): AudioContext | null {
  if (isMuted()) return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = MASTER_VOLUME
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function out(): AudioNode {
  return master as GainNode
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
  gain.gain.linearRampToValueAtTime(opts.volume, opts.at + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, opts.at + opts.length)
  osc.connect(gain).connect(out())
  osc.start(opts.at)
  osc.stop(opts.at + opts.length + 0.02)
}

/** A burst of band-passed noise (rustles, taps). */
function noise(c: AudioContext, opts: {
  at: number
  length: number
  volume: number
  freq: number
  q?: number
  attack?: number
}): void {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, opts.length + 0.05)
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = opts.freq
  band.Q.value = opts.q ?? 0.9
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, opts.at)
  gain.gain.linearRampToValueAtTime(opts.volume, opts.at + (opts.attack ?? 0.008))
  gain.gain.exponentialRampToValueAtTime(0.001, opts.at + opts.length)
  src.connect(band).connect(gain).connect(out())
  src.start(opts.at)
}

/** Button / card press. */
export function click(): void {
  const c = audio()
  if (!c) return
  tone(c, { freq: 1500, slideTo: 900, at: c.currentTime, length: 0.05, volume: 0.1, type: 'triangle' })
}

/** One tick of typed text (called every other character). */
export function blip(): void {
  const c = audio()
  if (!c) return
  tone(c, { freq: 480 + Math.random() * 90, at: c.currentTime, length: 0.03, volume: 0.035, type: 'triangle' })
}

/** Paper being slid across a desk / a file opening. */
export function paper(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  noise(c, { at: t, length: 0.28, volume: 0.22, freq: 2600, q: 0.6, attack: 0.09 })
  noise(c, { at: t + 0.16, length: 0.22, volume: 0.15, freq: 3400, q: 0.7, attack: 0.07 })
}

/** A heavy stamp coming down (the accusation). */
export function stamp(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(c, { freq: 120, slideTo: 40, at: t, length: 0.35, volume: 0.5 })
  noise(c, { at: t, length: 0.08, volume: 0.35, freq: 700, q: 0.5 })
}

/** A short two-note chime: something new opened up. */
export function chime(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(c, { freq: 880, at: t, length: 0.9, volume: 0.16 })
  tone(c, { freq: 1318.5, at: t + 0.11, length: 1.0, volume: 0.13 })
}

/** A quick rising sparkle: a clue was found. */
export function discover(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  ;[660, 880, 1109].forEach((freq, i) => tone(c, { freq, at: t + i * 0.07, length: 0.35, volume: 0.1, type: 'triangle' }))
}

/** Low resolving chord when the case is solved. */
export function solved(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  ;[130.8, 196, 261.6, 329.6].forEach((freq, i) => tone(c, { freq, at: t + i * 0.04, length: 2.2, volume: 0.13 }))
  tone(c, { freq: 523.3, at: t + 0.35, length: 1.8, volume: 0.1 })
}

/** One footstep on a hard floor: a short filtered noise tick plus a low thud. */
function step(c: AudioContext, at: number, volume: number): void {
  noise(c, { at, length: 0.16, volume, freq: 900 + Math.random() * 300 })
  tone(c, { freq: 110, slideTo: 55, at, length: 0.15, volume: volume * 0.8 })
}

/** Walking footsteps; returns how long they last in milliseconds. */
export function footsteps(count = 4, interval = 0.3): number {
  const c = audio()
  if (!c) return count * interval * 1000
  const start = c.currentTime + 0.05
  for (let i = 0; i < count; i++) {
    step(c, start + i * interval, i % 2 === 0 ? 0.5 : 0.4)
  }
  return count * interval * 1000
}
