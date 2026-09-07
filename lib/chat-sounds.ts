// Sound effects for AI chat interactions
// Using Web Audio API for better performance

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

// Simple beep sound generator
function playBeep(frequency: number, duration: number, volume: number = 0.3) {
  try {
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch (error) {
    console.error('Audio playback failed:', error)
  }
}

export const ChatSounds = {
  messageSent: () => {
    playBeep(800, 0.1, 0.2)
  },

  messageReceived: () => {
    playBeep(600, 0.15, 0.2)
    setTimeout(() => playBeep(700, 0.1, 0.15), 100)
  },

  error: () => {
    playBeep(300, 0.3, 0.3)
  },

  success: () => {
    playBeep(600, 0.1, 0.2)
    setTimeout(() => playBeep(800, 0.1, 0.2), 100)
    setTimeout(() => playBeep(1000, 0.15, 0.2), 200)
  },

  typing: () => {
    playBeep(400, 0.05, 0.1)
  },

  notification: () => {
    playBeep(900, 0.1, 0.2)
    setTimeout(() => playBeep(900, 0.1, 0.2), 150)
  }
}

// Preload audio context on user interaction
export function initializeChatSounds() {
  if (typeof window !== 'undefined') {
    document.addEventListener('click', () => {
      try {
        getAudioContext().resume()
      } catch (e) {
        // Silent fail
      }
    }, { once: true })
  }
}

