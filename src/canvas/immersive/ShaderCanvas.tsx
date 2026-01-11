/**
 * ShaderCanvas - WebGL-powered procedural space background
 *
 * Creates an animated nebula with stars using GLSL fragment shaders.
 * Responds to mouse position and can shift colors based on theme.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Shader Source Code
// ============================================================================

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec3 u_colorPrimary;
uniform vec3 u_colorSecondary;
uniform float u_intensity;

// ============================================================================
// Noise Functions (Simplex-like)
// ============================================================================

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

// ============================================================================
// Star Field
// ============================================================================

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float stars(vec2 uv, float density, float brightness) {
  vec2 gv = fract(uv * density) - 0.5;
  vec2 id = floor(uv * density);

  float star = 0.0;
  float h = hash(id);

  if (h > 0.97) {
    float size = (h - 0.97) * 33.0;
    float d = length(gv);
    float twinkle = sin(u_time * (2.0 + h * 5.0) + h * 6.28) * 0.5 + 0.5;
    star = (1.0 - smoothstep(0.0, 0.02 + size * 0.01, d)) * brightness * (0.5 + twinkle * 0.5);
  }

  return star;
}

// ============================================================================
// Nebula
// ============================================================================

vec3 nebula(vec2 uv, float time) {
  // Warp coordinates with noise for organic feel
  vec2 warp = vec2(
    fbm(uv * 2.0 + time * 0.05, 4),
    fbm(uv * 2.0 + vec2(5.0) + time * 0.05, 4)
  );

  vec2 warpedUv = uv + warp * 0.3;

  // Multiple layers of noise
  float n1 = fbm(warpedUv * 3.0 + time * 0.02, 5);
  float n2 = fbm(warpedUv * 5.0 - time * 0.03, 4);
  float n3 = fbm(warpedUv * 8.0 + time * 0.01, 3);

  // Combine layers
  float nebulaDensity = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  nebulaDensity = smoothstep(-0.2, 0.8, nebulaDensity);

  // Color gradient between primary and secondary
  float colorMix = n2 * 0.5 + 0.5;
  vec3 nebulaColor = mix(u_colorPrimary, u_colorSecondary, colorMix);

  // Add some brightness variation
  float brightness = 0.3 + n3 * 0.4;

  return nebulaColor * nebulaDensity * brightness * u_intensity;
}

// ============================================================================
// Main
// ============================================================================

void main() {
  vec2 uv = v_uv;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  uv = (uv - 0.5) * aspect + 0.5;

  // Mouse parallax (subtle)
  vec2 mouseOffset = (u_mouse - 0.5) * 0.02;
  uv += mouseOffset;

  float time = u_time;

  // Base dark space
  vec3 color = vec3(0.02, 0.02, 0.03);

  // Add nebula
  vec3 nebulaColor = nebula(uv, time);
  color += nebulaColor;

  // Add stars at multiple densities
  float starField = 0.0;
  starField += stars(uv + mouseOffset * 2.0, 50.0, 1.0);
  starField += stars(uv + mouseOffset * 1.5, 100.0, 0.7);
  starField += stars(uv + mouseOffset, 200.0, 0.4);

  color += vec3(starField);

  // Vignette
  float vignette = 1.0 - length((v_uv - 0.5) * 1.2);
  vignette = smoothstep(0.0, 0.7, vignette);
  color *= vignette;

  // Gamma correction
  color = pow(color, vec3(0.9));

  fragColor = vec4(color, 1.0);
}
`;

// ============================================================================
// Types
// ============================================================================

export interface ShaderCanvasProps {
  /** Primary nebula color (default: cyan) */
  colorPrimary?: [number, number, number];
  /** Secondary nebula color (default: purple) */
  colorSecondary?: [number, number, number];
  /** Effect intensity 0-1 (default: 1) */
  intensity?: number;
  /** Whether to respond to mouse */
  mouseInteraction?: boolean;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ShaderCanvas({
  colorPrimary = [0.0, 0.8, 0.7], // Cyan
  colorSecondary = [0.5, 0.2, 0.8], // Purple
  intensity = 1.0,
  mouseInteraction = true,
  className = "",
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const startTimeRef = useRef(Date.now());
  const [isReady, setIsReady] = useState(false);

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      console.warn("WebGL2 not supported");
      return false;
    }

    glRef.current = gl;

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return false;

    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
      return false;
    }

    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(
        "Fragment shader error:",
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
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return false;
    }

    programRef.current = program;
    gl.useProgram(program);

    // Create fullscreen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

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
  }, []);

  // Mouse handler
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!mouseInteraction) return;
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: 1.0 - e.clientY / window.innerHeight,
      };
    },
    [mouseInteraction],
  );

  // Render loop
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;

    if (!gl || !program || !canvas) {
      animationRef.current = requestAnimationFrame(render);
      return;
    }

    const time = (Date.now() - startTimeRef.current) / 1000;

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(program, "u_time"), time);
    gl.uniform2f(
      gl.getUniformLocation(program, "u_resolution"),
      canvas.width,
      canvas.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "u_mouse"),
      mouseRef.current.x,
      mouseRef.current.y,
    );
    gl.uniform3f(
      gl.getUniformLocation(program, "u_colorPrimary"),
      colorPrimary[0],
      colorPrimary[1],
      colorPrimary[2],
    );
    gl.uniform3f(
      gl.getUniformLocation(program, "u_colorSecondary"),
      colorSecondary[0],
      colorSecondary[1],
      colorSecondary[2],
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_intensity"), intensity);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animationRef.current = requestAnimationFrame(render);
  }, [colorPrimary, colorSecondary, intensity]);

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

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [initWebGL, handleResize, handleMouseMove, render]);

  return (
    <canvas
      ref={canvasRef}
      className={`shader-canvas ${className}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
        opacity: isReady ? 1 : 0,
        transition: "opacity 1s ease-in-out",
      }}
    />
  );
}

export default ShaderCanvas;
