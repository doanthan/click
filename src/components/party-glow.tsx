"use client";

import { useEffect, useRef } from "react";

/* The party in the room - a WebGL wash behind the Trending band. Slow aurora
   drift in the DS deep-band palette (aubergine ink -> deep purple -> a whisper
   of lavender) plus sparse cream twinkles, like camera flashes going off across
   a dark venue. Colours are the deep tokens baked in as vec3 (shaders can't
   read CSS vars); if any change, update both here and globals.css.

   Degrades all the way down: no WebGL -> the section's solid --surface-deep
   background stands alone; prefers-reduced-motion -> one static frame; the
   loop only runs while the canvas is on screen. */

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;

float blob(vec2 p, vec2 c, float r) {
  float d = length(p - c);
  return exp(-d * d / (r * r));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  vec3 base   = vec3(0.125, 0.102, 0.227); /* --surface-deep #201A3A */
  vec3 purple = vec3(0.231, 0.184, 0.506); /* --purple #3B2F81 */
  vec3 violet = vec3(0.341, 0.275, 0.651); /* --purple-500 #5746A6 */
  vec3 lav    = vec3(0.784, 0.722, 0.973); /* --lavender #C8B8F8 */
  vec3 cream  = vec3(0.976, 0.965, 0.941); /* --champagne #F9F6F0 */

  float t = u_t * 0.12;
  float aspect = u_res.x / u_res.y;

  vec3 col = base;
  col = mix(col, purple, 0.95 * blob(p, vec2(aspect * (0.22 + 0.10 * sin(t * 0.7)), 0.38 + 0.16 * cos(t * 0.5)), 0.70));
  col = mix(col, violet, 0.70 * blob(p, vec2(aspect * (0.80 + 0.12 * cos(t * 0.6 + 2.0)), 0.62 + 0.18 * sin(t * 0.8)), 0.60));
  col = mix(col, purple, 0.70 * blob(p, vec2(aspect * (0.52 + 0.16 * sin(t * 0.4 + 4.0)), 0.04 + 0.10 * cos(t * 0.9)), 0.72));
  col = mix(col, lav,    0.20 * blob(p, vec2(aspect * (0.45 + 0.22 * cos(t * 0.35)), 0.90 + 0.08 * sin(t * 0.6 + 1.0)), 0.36));

  /* Vignette back to the base ink so edges stay deep and cards pop. */
  float v = smoothstep(1.25, 0.45, distance(uv, vec2(0.5)));
  col = mix(base, col, v);

  /* Rare cream twinkles - camera flashes going off across the room, not a
     starfield: few cells qualify, and each spends most of its cycle dark. */
  vec2 cell = floor(gl_FragCoord.xy / 5.0);
  float h = hash(cell);
  float tw = step(0.9994, h) * pow(0.5 + 0.5 * sin(u_t * (0.8 + h * 2.0) + h * 40.0), 14.0);
  col = mix(col, cream, tw * 0.9 * v);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function PartyGlow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}");
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uT = gl.getUniformLocation(prog, "u_t");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = false;
    const t0 = performance.now();

    const draw = (now: number) => {
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uT, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (!visible) return;
      if (reduced) draw(performance.now());
      else raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      if (visible && reduced) draw(performance.now());
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
