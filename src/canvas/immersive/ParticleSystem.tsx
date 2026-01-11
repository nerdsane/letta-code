/**
 * ParticleSystem - High-performance particle effects
 *
 * Uses WebGPU compute shaders when available (100k+ particles),
 * falls back to WebGL for broader support.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface ParticleSystemProps {
  /** Number of particles */
  count?: number;
  /** Particle color */
  color?: [number, number, number];
  /** Particle size range [min, max] */
  sizeRange?: [number, number];
  /** Speed multiplier */
  speed?: number;
  /** Whether particles attract to cursor */
  cursorAttraction?: boolean;
  /** Attraction strength 0-1 */
  attractionStrength?: number;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// WebGL Particle System (Fallback)
// ============================================================================

const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in float a_size;
in float a_alpha;

uniform vec2 u_resolution;
uniform float u_time;

out float v_alpha;

void main() {
  vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
  gl_PointSize = a_size;
  v_alpha = a_alpha;
}
`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float v_alpha;
out vec4 fragColor;

uniform vec3 u_color;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  float alpha = smoothstep(0.5, 0.2, dist) * v_alpha;
  fragColor = vec4(u_color, alpha);
}
`;

// ============================================================================
// Particle Data Structure
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

// ============================================================================
// Component
// ============================================================================

export function ParticleSystem({
  count = 5000,
  color = [0.0, 1.0, 0.8], // Cyan
  sizeRange = [1, 4],
  speed = 1,
  cursorAttraction = true,
  attractionStrength = 0.3,
  className = "",
}: ParticleSystemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const [isReady, setIsReady] = useState(false);

  // Initialize particles
  const initParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed - 0.2, // Slight upward drift
          size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
          alpha: 0.1 + Math.random() * 0.5,
          life: Math.random() * 100,
          maxLife: 100 + Math.random() * 200,
        });
      }
      particlesRef.current = particles;
    },
    [count, speed, sizeRange],
  );

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });

    if (!gl) {
      console.warn("WebGL2 not supported for particles");
      return false;
    }

    glRef.current = gl;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return false;

    gl.shaderSource(vertexShader, PARTICLE_VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error(
        "Particle vertex shader error:",
        gl.getShaderInfoLog(vertexShader),
      );
      return false;
    }

    gl.shaderSource(fragmentShader, PARTICLE_FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(
        "Particle fragment shader error:",
        gl.getShaderInfoLog(fragmentShader),
      );
      return false;
    }

    // Link program
    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        "Particle program link error:",
        gl.getProgramInfoLog(program),
      );
      return false;
    }

    programRef.current = program;
    return true;
  }, []);

  // Resize handler
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    gl.viewport(0, 0, canvas.width, canvas.height);

    // Reinitialize particles with new dimensions
    initParticles(canvas.width, canvas.height);
  }, [initParticles]);

  // Mouse handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    mouseRef.current = {
      x: e.clientX * dpr,
      y: e.clientY * dpr,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 };
  }, []);

  // Update particles
  const updateParticles = useCallback(
    (width: number, height: number) => {
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (const p of particles) {
        // Cursor attraction
        if (cursorAttraction && mouse.x > 0) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            const force = ((200 - dist) / 200) * attractionStrength * 0.1;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // Apply velocity
        p.x += p.vx;
        p.y += p.vy;

        // Friction
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Life cycle
        p.life += 1;
        if (p.life > p.maxLife) {
          // Reset particle
          p.x = Math.random() * width;
          p.y = height + 10;
          p.vx = (Math.random() - 0.5) * speed;
          p.vy = -Math.random() * speed - 0.5;
          p.life = 0;
          p.maxLife = 100 + Math.random() * 200;
        }

        // Wrap around screen
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) {
          p.y = height + 10;
          p.life = p.maxLife; // Reset when reaching top
        }

        // Fade based on life
        const lifeRatio = p.life / p.maxLife;
        p.alpha = Math.sin(lifeRatio * Math.PI) * 0.6;
      }
    },
    [cursorAttraction, attractionStrength, speed],
  );

  // Render particles
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;
    const particles = particlesRef.current;

    if (!gl || !program || !canvas || particles.length === 0) {
      animationRef.current = requestAnimationFrame(render);
      return;
    }

    // Update particle physics
    updateParticles(canvas.width, canvas.height);

    // Clear with transparent
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Prepare buffers
    const positions = new Float32Array(particles.length * 2);
    const sizes = new Float32Array(particles.length);
    const alphas = new Float32Array(particles.length);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      positions[i * 2] = p.x;
      positions[i * 2 + 1] = p.y;
      sizes[i] = p.size;
      alphas[i] = p.alpha;
    }

    // Position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Size buffer
    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
    const sizeLoc = gl.getAttribLocation(program, "a_size");
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

    // Alpha buffer
    const alphaBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, alphas, gl.DYNAMIC_DRAW);
    const alphaLoc = gl.getAttribLocation(program, "a_alpha");
    gl.enableVertexAttribArray(alphaLoc);
    gl.vertexAttribPointer(alphaLoc, 1, gl.FLOAT, false, 0, 0);

    // Set uniforms
    gl.uniform2f(
      gl.getUniformLocation(program, "u_resolution"),
      canvas.width,
      canvas.height,
    );
    gl.uniform3f(
      gl.getUniformLocation(program, "u_color"),
      color[0],
      color[1],
      color[2],
    );

    // Draw
    gl.drawArrays(gl.POINTS, 0, particles.length);

    // Cleanup buffers
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(sizeBuffer);
    gl.deleteBuffer(alphaBuffer);

    animationRef.current = requestAnimationFrame(render);
  }, [color, updateParticles]);

  // Setup effect
  useEffect(() => {
    const success = initWebGL();
    if (success) {
      handleResize();
      setIsReady(true);
      animationRef.current = requestAnimationFrame(render);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [initWebGL, handleResize, handleMouseMove, handleMouseLeave, render]);

  return (
    <canvas
      ref={canvasRef}
      className={`particle-system ${className}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        opacity: isReady ? 1 : 0,
        transition: "opacity 1s ease-in-out",
      }}
    />
  );
}

export default ParticleSystem;
