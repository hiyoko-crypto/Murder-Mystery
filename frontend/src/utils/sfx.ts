/**
 * Sound effects synthesized with the Web Audio API, so no audio files are
 * needed. Browsers only start audio after a user gesture, which is always the
 * case here (every effect is triggered from a click).
 */

const MUTE_KEY = 'poirot_sfx_muted'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (isMuted()) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

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

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** One footstep on a hard floor: a short filtered noise tick plus a low thud. */
function step(c: AudioContext, at: number, volume: number): void {
  const out = c.createGain()
  out.gain.setValueAtTime(0, at)
  out.gain.linearRampToValueAtTime(volume, at + 0.008)
  out.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
  out.connect(c.destination)

  const tick = c.createBufferSource()
  tick.buffer = noiseBuffer(c, 0.18)
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 900 + Math.random() * 300
  band.Q.value = 0.9
  tick.connect(band).connect(out)
  tick.start(at)

  const thud = c.createOscillator()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(110, at)
  thud.frequency.exponentialRampToValueAtTime(55, at + 0.12)
  thud.connect(out)
  thud.start(at)
  thud.stop(at + 0.18)
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
