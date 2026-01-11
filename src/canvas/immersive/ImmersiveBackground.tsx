/**
 * ImmersiveBackground - Combines shader background + particles
 *
 * A unified component that renders the full immersive background effect
 * with configurable themes for different views.
 */

import { useMemo } from "react";
import { ParticleSystem } from "./ParticleSystem";
import { ShaderCanvas } from "./ShaderCanvas";

// ============================================================================
// Theme Presets
// ============================================================================

export type ImmersiveTheme =
  | "default"
  | "cosmic"
  | "nebula"
  | "void"
  | "energy"
  | "custom";

interface ThemeConfig {
  shader: {
    colorPrimary: [number, number, number];
    colorSecondary: [number, number, number];
    intensity: number;
  };
  particles: {
    color: [number, number, number];
    count: number;
    speed: number;
  };
}

const THEMES: Record<Exclude<ImmersiveTheme, "custom">, ThemeConfig> = {
  default: {
    shader: {
      colorPrimary: [0.0, 0.8, 0.7], // Cyan
      colorSecondary: [0.5, 0.2, 0.8], // Purple
      intensity: 0.8,
    },
    particles: {
      color: [0.0, 1.0, 0.8],
      count: 3000,
      speed: 0.5,
    },
  },
  cosmic: {
    shader: {
      colorPrimary: [0.1, 0.3, 0.9], // Deep blue
      colorSecondary: [0.8, 0.2, 0.5], // Magenta
      intensity: 1.0,
    },
    particles: {
      color: [0.8, 0.9, 1.0], // White-ish
      count: 5000,
      speed: 0.3,
    },
  },
  nebula: {
    shader: {
      colorPrimary: [0.8, 0.3, 0.2], // Red-orange
      colorSecondary: [0.2, 0.1, 0.5], // Deep purple
      intensity: 1.2,
    },
    particles: {
      color: [1.0, 0.6, 0.3],
      count: 4000,
      speed: 0.4,
    },
  },
  void: {
    shader: {
      colorPrimary: [0.1, 0.1, 0.2], // Almost black
      colorSecondary: [0.2, 0.0, 0.3], // Dark purple
      intensity: 0.4,
    },
    particles: {
      color: [0.4, 0.4, 0.5],
      count: 2000,
      speed: 0.2,
    },
  },
  energy: {
    shader: {
      colorPrimary: [0.0, 1.0, 0.8], // Bright cyan
      colorSecondary: [0.2, 0.8, 0.3], // Green
      intensity: 1.5,
    },
    particles: {
      color: [0.0, 1.0, 0.6],
      count: 6000,
      speed: 0.8,
    },
  },
};

// ============================================================================
// Props
// ============================================================================

export interface ImmersiveBackgroundProps {
  /** Preset theme */
  theme?: ImmersiveTheme;
  /** Custom shader colors (only used with theme="custom") */
  shaderColorPrimary?: [number, number, number];
  shaderColorSecondary?: [number, number, number];
  /** Custom shader intensity */
  shaderIntensity?: number;
  /** Custom particle color */
  particleColor?: [number, number, number];
  /** Custom particle count */
  particleCount?: number;
  /** Whether particles are enabled */
  enableParticles?: boolean;
  /** Whether shader background is enabled */
  enableShader?: boolean;
  /** Whether particles attract to cursor */
  cursorAttraction?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ImmersiveBackground({
  theme = "default",
  shaderColorPrimary,
  shaderColorSecondary,
  shaderIntensity,
  particleColor,
  particleCount,
  enableParticles = true,
  enableShader = true,
  cursorAttraction = true,
}: ImmersiveBackgroundProps) {
  // Resolve theme config
  const config = useMemo<ThemeConfig>(() => {
    if (theme === "custom") {
      return {
        shader: {
          colorPrimary: shaderColorPrimary ?? [0.0, 0.8, 0.7],
          colorSecondary: shaderColorSecondary ?? [0.5, 0.2, 0.8],
          intensity: shaderIntensity ?? 1.0,
        },
        particles: {
          color: particleColor ?? [0.0, 1.0, 0.8],
          count: particleCount ?? 3000,
          speed: 0.5,
        },
      };
    }

    const baseConfig = THEMES[theme];

    // Allow overrides even with preset themes
    return {
      shader: {
        colorPrimary: shaderColorPrimary ?? baseConfig.shader.colorPrimary,
        colorSecondary:
          shaderColorSecondary ?? baseConfig.shader.colorSecondary,
        intensity: shaderIntensity ?? baseConfig.shader.intensity,
      },
      particles: {
        color: particleColor ?? baseConfig.particles.color,
        count: particleCount ?? baseConfig.particles.count,
        speed: baseConfig.particles.speed,
      },
    };
  }, [
    theme,
    shaderColorPrimary,
    shaderColorSecondary,
    shaderIntensity,
    particleColor,
    particleCount,
  ]);

  return (
    <>
      {enableShader && (
        <ShaderCanvas
          colorPrimary={config.shader.colorPrimary}
          colorSecondary={config.shader.colorSecondary}
          intensity={config.shader.intensity}
          mouseInteraction={true}
        />
      )}
      {enableParticles && (
        <ParticleSystem
          color={config.particles.color}
          count={config.particles.count}
          speed={config.particles.speed}
          cursorAttraction={cursorAttraction}
          attractionStrength={0.3}
        />
      )}
    </>
  );
}

export default ImmersiveBackground;
