/**
 * AudioManager - Immersive audio system using Howler.js
 *
 * Manages ambient soundscapes, UI sounds, and spatial audio effects.
 */

import { Howl, Howler } from "howler";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Types
// ============================================================================

export type SoundCategory = "ambient" | "ui" | "atmosphere" | "spatial";

export interface SoundConfig {
  src: string | string[];
  volume?: number;
  loop?: boolean;
  category?: SoundCategory;
  fadeIn?: number;
  fadeOut?: number;
  spatial?: boolean;
}

export interface AudioManagerContextType {
  /** Master volume 0-1 */
  masterVolume: number;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Whether audio is initialized (user interaction required) */
  isInitialized: boolean;
  /** Set master volume */
  setMasterVolume: (volume: number) => void;
  /** Toggle mute */
  toggleMute: () => void;
  /** Play a sound by ID */
  play: (id: string, config?: Partial<SoundConfig>) => number | null;
  /** Stop a sound by ID */
  stop: (id: string) => void;
  /** Fade a sound */
  fade: (id: string, from: number, to: number, duration: number) => void;
  /** Set the ambient soundscape */
  setAmbient: (src: string | null) => void;
  /** Crossfade to new ambient */
  crossfadeAmbient: (src: string, duration?: number) => void;
  /** Initialize audio (must be called after user interaction) */
  initialize: () => void;
  /** Play UI sound */
  playUI: (
    type: "hover" | "click" | "success" | "error" | "transition",
  ) => void;
}

// ============================================================================
// Default Sounds (Generated/Synthesized)
// ============================================================================

// We'll use Howler's Web Audio API to create procedural sounds
// For production, replace with actual audio files

const UI_SOUNDS = {
  hover: {
    src: [], // Will use procedural
    volume: 0.1,
  },
  click: {
    src: [],
    volume: 0.15,
  },
  success: {
    src: [],
    volume: 0.2,
  },
  error: {
    src: [],
    volume: 0.2,
  },
  transition: {
    src: [],
    volume: 0.15,
  },
};

// ============================================================================
// Context
// ============================================================================

const AudioManagerContext = createContext<AudioManagerContextType | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface AudioManagerProviderProps {
  children: React.ReactNode;
  /** Default master volume */
  defaultVolume?: number;
  /** Default ambient sound URL */
  defaultAmbient?: string;
}

export function AudioManagerProvider({
  children,
  defaultVolume = 0.5,
  defaultAmbient,
}: AudioManagerProviderProps) {
  const [masterVolume, setMasterVolumeState] = useState(defaultVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const soundsRef = useRef<Map<string, Howl>>(new Map());
  const ambientRef = useRef<Howl | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize Web Audio API context
  const initialize = useCallback(() => {
    if (isInitialized) return;

    // Resume Howler's audio context
    Howler.ctx?.resume();

    // Create our own audio context for procedural sounds
    audioContextRef.current = new AudioContext();

    setIsInitialized(true);
    console.log("[AudioManager] Initialized");

    // Start default ambient if provided
    if (defaultAmbient) {
      setAmbient(defaultAmbient);
    }
  }, [isInitialized, defaultAmbient]);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setMasterVolumeState(clamped);
    Howler.volume(clamped);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      Howler.mute(!prev);
      return !prev;
    });
  }, []);

  // Play a sound
  const play = useCallback(
    (id: string, config?: Partial<SoundConfig>): number | null => {
      if (!isInitialized) {
        console.warn(
          "[AudioManager] Not initialized. Call initialize() first.",
        );
        return null;
      }

      let sound = soundsRef.current.get(id);

      if (!sound && config?.src) {
        // Create new sound
        sound = new Howl({
          src: Array.isArray(config.src) ? config.src : [config.src],
          volume: config.volume ?? 0.5,
          loop: config.loop ?? false,
          html5: false, // Use Web Audio for better performance
        });
        soundsRef.current.set(id, sound);
      }

      if (!sound) {
        console.warn(`[AudioManager] Sound not found: ${id}`);
        return null;
      }

      const playId = sound.play();

      if (config?.fadeIn) {
        sound.fade(0, config.volume ?? sound.volume(), config.fadeIn, playId);
      }

      return playId;
    },
    [isInitialized],
  );

  // Stop a sound
  const stop = useCallback((id: string) => {
    const sound = soundsRef.current.get(id);
    if (sound) {
      sound.stop();
    }
  }, []);

  // Fade a sound
  const fade = useCallback(
    (id: string, from: number, to: number, duration: number) => {
      const sound = soundsRef.current.get(id);
      if (sound) {
        sound.fade(from, to, duration);
      }
    },
    [],
  );

  // Set ambient soundscape
  const setAmbient = useCallback(
    (src: string | null) => {
      if (!isInitialized) return;

      // Stop current ambient
      if (ambientRef.current) {
        ambientRef.current.fade(ambientRef.current.volume(), 0, 1000);
        setTimeout(() => {
          ambientRef.current?.unload();
          ambientRef.current = null;
        }, 1000);
      }

      if (!src) return;

      // Create new ambient
      ambientRef.current = new Howl({
        src: [src],
        volume: 0,
        loop: true,
        html5: true, // Use HTML5 for long audio (streaming)
      });

      ambientRef.current.play();
      ambientRef.current.fade(0, 0.3, 2000);
    },
    [isInitialized],
  );

  // Crossfade to new ambient
  const crossfadeAmbient = useCallback(
    (src: string, duration = 2000) => {
      if (!isInitialized) return;

      const oldAmbient = ambientRef.current;

      // Create new ambient
      const newAmbient = new Howl({
        src: [src],
        volume: 0,
        loop: true,
        html5: true,
      });

      newAmbient.play();
      newAmbient.fade(0, 0.3, duration);

      // Fade out old
      if (oldAmbient) {
        oldAmbient.fade(oldAmbient.volume(), 0, duration);
        setTimeout(() => {
          oldAmbient.unload();
        }, duration);
      }

      ambientRef.current = newAmbient;
    },
    [isInitialized],
  );

  // Play UI sound (procedural using Web Audio)
  const playUI = useCallback(
    (type: "hover" | "click" | "success" | "error" | "transition") => {
      if (!isInitialized || !audioContextRef.current) return;

      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      // Create oscillator for procedural sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      switch (type) {
        case "hover":
          // Soft high-pitched blip
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(800, now);
          oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
          gainNode.gain.setValueAtTime(0.05 * masterVolume, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;

        case "click":
          // Sharp click
          oscillator.type = "square";
          oscillator.frequency.setValueAtTime(300, now);
          oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.05);
          gainNode.gain.setValueAtTime(0.1 * masterVolume, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          oscillator.start(now);
          oscillator.stop(now + 0.08);
          break;

        case "success":
          // Ascending tone
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(400, now);
          oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.15);
          gainNode.gain.setValueAtTime(0.1 * masterVolume, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;

        case "error":
          // Descending buzz
          oscillator.type = "sawtooth";
          oscillator.frequency.setValueAtTime(400, now);
          oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.15);
          gainNode.gain.setValueAtTime(0.08 * masterVolume, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;

        case "transition": {
          // Whoosh (noise burst)
          const bufferSize = ctx.sampleRate * 0.3;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          const noiseGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(2000, now);
          filter.frequency.exponentialRampToValueAtTime(500, now + 0.3);
          filter.Q.value = 1;
          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noiseGain.gain.setValueAtTime(0.05 * masterVolume, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          noise.start(now);
          noise.stop(now + 0.3);
          return; // Don't use oscillator for this one
        }
      }
    },
    [isInitialized, masterVolume],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundsRef.current.forEach((sound) => sound.unload());
      soundsRef.current.clear();
      ambientRef.current?.unload();
      audioContextRef.current?.close();
    };
  }, []);

  const value = useMemo<AudioManagerContextType>(
    () => ({
      masterVolume,
      isMuted,
      isInitialized,
      setMasterVolume,
      toggleMute,
      play,
      stop,
      fade,
      setAmbient,
      crossfadeAmbient,
      initialize,
      playUI,
    }),
    [
      masterVolume,
      isMuted,
      isInitialized,
      setMasterVolume,
      toggleMute,
      play,
      stop,
      fade,
      setAmbient,
      crossfadeAmbient,
      initialize,
      playUI,
    ],
  );

  return (
    <AudioManagerContext.Provider value={value}>
      {children}
    </AudioManagerContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAudio() {
  const context = useContext(AudioManagerContext);
  if (!context) {
    throw new Error("useAudio must be used within AudioManagerProvider");
  }
  return context;
}

// ============================================================================
// Audio Controls Component
// ============================================================================

export function AudioControls() {
  const {
    masterVolume,
    isMuted,
    isInitialized,
    setMasterVolume,
    toggleMute,
    initialize,
  } = useAudio();

  if (!isInitialized) {
    return (
      <button
        type="button"
        onClick={initialize}
        className="audio-controls__init"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          padding: "8px 16px",
          background: "rgba(0, 255, 204, 0.1)",
          border: "1px solid rgba(0, 255, 204, 0.3)",
          borderRadius: "4px",
          color: "#00ffcc",
          cursor: "pointer",
          fontSize: "12px",
          zIndex: 1000,
        }}
      >
        🔊 Enable Audio
      </button>
    );
  }

  return (
    <div
      className="audio-controls"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(10px)",
        borderRadius: "20px",
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        onClick={toggleMute}
        style={{
          background: "none",
          border: "none",
          color: isMuted ? "#666" : "#00ffcc",
          cursor: "pointer",
          fontSize: "16px",
          padding: "4px",
        }}
      >
        {isMuted ? "🔇" : masterVolume > 0.5 ? "🔊" : "🔉"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={isMuted ? 0 : masterVolume}
        onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
        style={{
          width: "60px",
          height: "4px",
          appearance: "none",
          background: `linear-gradient(to right, #00ffcc ${masterVolume * 100}%, #333 ${masterVolume * 100}%)`,
          borderRadius: "2px",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

export default AudioManagerProvider;
