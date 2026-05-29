/**
 * Lightweight brand-coloured confetti. One persistent overlay canvas, particles
 * are appended on each `fireConfetti` and animated until they fade out.
 * Colours mirror the tokens in `globals.css` (--rose, --peach, --ink, --mauve).
 */

const COLORS = ["#FF6978", "#B1EDE8", "#340068", "#6D435A", "#ff9aa4"];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
};

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let rafId = 0;

function ensureCanvas(): HTMLCanvasElement {
  if (canvas) return canvas;
  const el = document.createElement("canvas");
  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.pointerEvents = "none";
  el.style.zIndex = "9999";
  document.body.appendChild(el);

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.floor(window.innerWidth * dpr);
    el.height = Math.floor(window.innerHeight * dpr);
    el.style.width = `${window.innerWidth}px`;
    el.style.height = `${window.innerHeight}px`;
  };
  resize();
  window.addEventListener("resize", resize);
  canvas = el;
  return el;
}

function tick() {
  const c = canvas;
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, c.width, c.height);

  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.vy += 0.22; // gravity
    p.vx *= 0.995; // mild drag
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vrot;
    p.life -= 1;

    const alpha = Math.min(1, p.life / (p.maxLife * 0.5));
    ctx.save();
    ctx.translate(p.x * dpr, p.y * dpr);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    // little confetti rectangles
    ctx.fillRect(
      -p.size * dpr,
      (-p.size / 2) * dpr,
      p.size * 2 * dpr,
      p.size * dpr,
    );
    ctx.restore();
  }

  if (particles.length > 0) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = 0;
  }
}

/**
 * Burst `count` particles outward from a screen position. Origin defaults to
 * the centre of the viewport when no coords are supplied.
 */
export function fireConfetti(originX?: number, originY?: number, count = 60) {
  if (typeof window === "undefined") return;
  ensureCanvas();

  const ox = originX ?? window.innerWidth / 2;
  const oy = originY ?? window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    // upward fan: angles between -135° and -45° (i.e. -3π/4 to -π/4)
    const angle = -Math.PI / 4 - (Math.random() * Math.PI) / 2;
    const speed = 4 + Math.random() * 7;
    const maxLife = 90 + Math.random() * 50;
    particles.push({
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.35,
      life: maxLife,
      maxLife,
    });
  }

  if (!rafId) rafId = requestAnimationFrame(tick);
}
