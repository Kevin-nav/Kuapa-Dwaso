import { useEffect, useRef, memo, useId, type HTMLAttributes } from "react";
import { palette } from "@agriculture/design-tokens";

const TWO_PI = Math.PI * 2;

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Dot {
  ax: number;
  ay: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface DotFieldProps extends HTMLAttributes<HTMLDivElement> {
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  cursorForce?: number;
  bulgeOnly?: boolean;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
}

export const DotField = memo(
  ({
    dotRadius = 1.5,
    dotSpacing = 14,
    cursorRadius = 500,
    cursorForce = 0.1,
    bulgeOnly = true,
    bulgeStrength = 67,
    glowRadius = 160,
    sparkle = false,
    waveAmplitude = 0,
    gradientFrom = hexToRgba(palette.field, 0.8), // Forest green with opacity
    gradientTo = hexToRgba(palette.sky, 0.7),     // Sky teal with opacity
    glowColor = hexToRgba(palette.field, 0.25),    // Ambient glow with opacity
    className,
    style,
    ...rest
  }: DotFieldProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const glowRef = useRef<SVGCircleElement>(null);
    const dotsRef = useRef<Dot[]>([]);
    const mouseRef = useRef({
      x: -9999,
      y: -9999,
      prevX: -9999,
      prevY: -9999,
      speed: 0,
    });
    const rafRef = useRef<number | null>(null);
    const sizeRef = useRef({ w: 0, h: 0 });
    const glowOpacity = useRef(0);
    const engagement = useRef(0);
    const propsRef = useRef<Record<string, unknown>>({});
    propsRef.current = {
      dotRadius,
      dotSpacing,
      cursorRadius,
      cursorForce,
      bulgeOnly,
      bulgeStrength,
      sparkle,
      waveAmplitude,
      gradientFrom,
      gradientTo,
    };
    const uniqueId = useId();
    const rebuildRef = useRef<(() => void) | null>(null);
    const glowIdRef = useRef(
      `dot-field-glow-${uniqueId.replace(/:/g, "")}`,
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      const glowEl = glowRef.current;
      if (!canvas) return;
      const canvasEl = canvas;
      const ctx = canvasEl.getContext("2d", { alpha: true });
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let resizeTimer: ReturnType<typeof setTimeout>;

      function resize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(doResize, 100);
      }

      function doResize() {
        if (!canvas || !canvas.parentElement) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

        sizeRef.current = {
          w,
          h,
        };

        buildDots(w, h);
      }

      function buildDots(w: number, h: number) {
        const p = propsRef.current;
        const step = (p.dotRadius as number) + (p.dotSpacing as number);
        const cols = Math.floor(w / step);
        const rows = Math.floor(h / step);
        const padX = (w % step) / 2;
        const padY = (h % step) / 2;
        const dots: Dot[] = new Array(rows * cols);
        let idx = 0;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const ax = padX + col * step + step / 2;
            const ay = padY + row * step + step / 2;
            dots[idx++] = {
              ax,
              ay,
              sx: ax,
              sy: ay,
              vx: 0,
              vy: 0,
              x: ax,
              y: ay,
            };
          }
        }
        dotsRef.current = dots;
      }

      function updatePointerPosition(clientX: number, clientY: number) {
        const rect = (canvasEl.parentElement ?? canvasEl).getBoundingClientRect();
        mouseRef.current.x = clientX - rect.left;
        mouseRef.current.y = clientY - rect.top;
      }

      function onMouseMove(e: MouseEvent) {
        updatePointerPosition(e.clientX, e.clientY);
      }

      let lastTouchTime = 0;
      function onTouchMove(e: TouchEvent) {
        const now = performance.now();
        if (now - lastTouchTime < 16) return;
        lastTouchTime = now;
        const touch = e.touches[0];
        if (!touch) return;
        updatePointerPosition(touch.clientX, touch.clientY);
      }

      function onTouchStart(e: TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return;
        updatePointerPosition(touch.clientX, touch.clientY);
      }

      function onTouchEnd() {
        mouseRef.current.x = -9999;
        mouseRef.current.y = -9999;
      }

      function updateMouseSpeed() {
        const m = mouseRef.current;
        const dx = m.prevX - m.x;
        const dy = m.prevY - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        m.speed += (dist - m.speed) * 0.5;
        if (m.speed < 0.001) m.speed = 0;
        m.prevX = m.x;
        m.prevY = m.y;
      }

      const speedInterval = setInterval(updateMouseSpeed, 20);

      let frameCount = 0;

      function tick() {
        frameCount++;
        const dots = dotsRef.current;
        const m = mouseRef.current;
        const { w, h } = sizeRef.current;
        const p = propsRef.current;
        const len = dots.length;
        const t = frameCount * 0.02;

        const targetEngagement = Math.min(m.speed / 5, 1);
        engagement.current += (targetEngagement - engagement.current) * 0.06;
        if (engagement.current < 0.001) engagement.current = 0;
        const eng = engagement.current;

        // Idle ambient wave - gentle breathing when no interaction
        const isIdle = eng < 0.01;
        const idleWave = isIdle ? Math.sin(t * 0.5) * 0.3 + 0.7 : 1.0;

        const targetGlow = Math.max(eng, 0.12);
        glowOpacity.current += (targetGlow - glowOpacity.current) * 0.08;

        if (glowEl) {
          glowEl.setAttribute("cx", String(m.x));
          glowEl.setAttribute("cy", String(m.y));
          glowEl.style.opacity = String(glowOpacity.current);
        }

        ctx!.clearRect(0, 0, w, h);

        const grad = ctx!.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, p.gradientFrom as string);
        grad.addColorStop(1, p.gradientTo as string);
        ctx!.fillStyle = grad;

        const cr = p.cursorRadius as number;
        const crSq = cr * cr;
        const rad = p.dotRadius as number;
        const isBulge = p.bulgeOnly as boolean;

        ctx!.beginPath();

        for (let i = 0; i < len; i++) {
          const d = dots[i];
          if (!d) continue;
          const dx = m.x - d.ax;
          const dy = m.y - d.ay;
          const distSq = dx * dx + dy * dy;

          if (distSq < crSq && eng > 0.01) {
            const dist = Math.sqrt(distSq);
            if (isBulge) {
              const t = 1 - dist / cr;
              const push = t * t * (p.bulgeStrength as number) * eng;
              const angle = Math.atan2(dy, dx);
              d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
              d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
            } else {
              const angle = Math.atan2(dy, dx);
              const move = (500 / dist) * (m.speed * (p.cursorForce as number));
              d.vx += Math.cos(angle) * -move;
              d.vy += Math.sin(angle) * -move;
            }
          } else if (isBulge) {
            d.sx += (d.ax - d.sx) * 0.1;
            d.sy += (d.ay - d.sy) * 0.1;
          }

          if (!isBulge) {
            d.vx *= 0.9;
            d.vy *= 0.9;
            d.x = d.ax + d.vx;
            d.y = d.ay + d.vy;
            d.sx += (d.x - d.sx) * 0.1;
            d.sy += (d.y - d.sy) * 0.1;
          }

          let drawX = d.sx;
          let drawY = d.sy;
          if ((p.waveAmplitude as number) > 0) {
            drawY += Math.sin(d.ax * 0.03 + t) * (p.waveAmplitude as number);
            drawX +=
              Math.cos(d.ay * 0.03 + t * 0.7) *
              (p.waveAmplitude as number) *
              0.5;
          }

          if (p.sparkle) {
            const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
            if (hash % 100 < 3) {
              const sparkleRad = rad * 1.8 * idleWave;
              ctx!.moveTo(drawX + sparkleRad, drawY);
              ctx!.arc(drawX, drawY, sparkleRad, 0, TWO_PI);
            } else {
              const drawRad = rad * idleWave;
              ctx!.moveTo(drawX + drawRad, drawY);
              ctx!.arc(drawX, drawY, drawRad, 0, TWO_PI);
            }
          } else {
            const drawRad = rad * idleWave;
            ctx!.moveTo(drawX + drawRad, drawY);
            ctx!.arc(drawX, drawY, drawRad, 0, TWO_PI);
          }
        }

        ctx!.fill();

        rafRef.current = requestAnimationFrame(tick);
      }

      const resizeObserver = new ResizeObserver(() => {
        doResize();
      });
      if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
      }
      doResize();

      window.addEventListener("resize", resize);
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      rafRef.current = requestAnimationFrame(tick);

      rebuildRef.current = () => {
        const { w, h } = sizeRef.current;
        if (w > 0 && h > 0) buildDots(w, h);
      };

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        clearInterval(speedInterval);
        clearTimeout(resizeTimer);
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchend", onTouchEnd);
        resizeObserver.disconnect();
      };
    }, []);

    useEffect(() => {
      rebuildRef.current?.();
    }, [dotRadius, dotSpacing]);

    return (
      <div
        {...rest}
        className={className}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          ...style,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            willChange: "transform",
          }}
        />
        <svg
          ref={svgRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <defs>
            <radialGradient id={glowIdRef.current}>
              <stop offset="0%" stopColor={glowColor} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle
            ref={glowRef}
            cx="-9999"
            cy="-9999"
            r={glowRadius}
            fill={`url(#${glowIdRef.current})`}
            style={{ opacity: 0, willChange: "opacity" }}
          />
        </svg>
      </div>
    );
  },
);

DotField.displayName = "DotField";
