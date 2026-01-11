/**
 * Immersive Experience Components
 *
 * Export all immersive background, audio, and animation components.
 */

export type { AudioManagerContextType, SoundCategory } from "./AudioManager";
// Audio Components
export {
  AudioControls,
  AudioManagerProvider,
  useAudio,
} from "./AudioManager";
export type {
  ImmersiveBackgroundProps,
  ImmersiveTheme,
} from "./ImmersiveBackground";
export { ImmersiveBackground } from "./ImmersiveBackground";
export type { ParticleSystemProps } from "./ParticleSystem";
export { ParticleSystem } from "./ParticleSystem";
export type { ShaderCanvasProps } from "./ShaderCanvas";
// Background Components
export { ShaderCanvas } from "./ShaderCanvas";
export type {
  ParallaxConfig,
  RevealEffect,
  ScrollAnimationConfig,
} from "./useGsapAnimations";
// GSAP Animations
export {
  killAllScrollTriggers,
  refreshScrollTrigger,
  useFadeIn,
  useParallax,
  usePinSection,
  useRevealOnScroll,
  useScrollAnimation,
  useStaggeredReveal,
  useViewTransition,
} from "./useGsapAnimations";
