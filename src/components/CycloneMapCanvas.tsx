import React, { useEffect, useRef, useState } from 'react';
import { CycloneSyncState } from '../utils/cycloneModel';

interface CycloneMapCanvasProps {
  syncState: CycloneSyncState;
  showLabels: boolean;
  cutOffset: number;
  onCutOffsetChange: (offset: number) => void;
}

export const CycloneMapCanvas: React.FC<CycloneMapCanvasProps> = ({
  syncState,
  showLabels,
  cutOffset,
  onCutOffsetChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealedQuiz, setRevealedQuiz] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRevealedQuiz({});
  }, [showLabels]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Map [-1, 1] -> pixel coords
      const pad = 22;
      const mapW = w - pad * 2;
      const mapH = h - pad * 2;
      const toPx = (nx: number) => pad + ((nx + 1) / 2) * mapW;
      const toPy = (ny: number) => pad + ((ny + 1) / 2) * mapH;

      // 1. Clean map background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Latitude / longitude grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      for (let gx = -0.8; gx <= 0.85; gx += 0.2) {
        const px = toPx(gx);
        ctx.beginPath();
        ctx.moveTo(px, pad);
        ctx.lineTo(px, h - pad);
        ctx.stroke();
      }
      for (let gy = -0.8; gy <= 0.85; gy += 0.2) {
        const py = toPy(gy);
        ctx.beginPath();
        ctx.moveTo(pad, py);
        ctx.lineTo(w - pad, py);
        ctx.stroke();
      }

      // Outer map border
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad, pad, mapW, mapH);

      const {
        progress,
        centerX,
        centerY,
        pressureHpa,
        cutY,
        coldXNorm,
        warmXNorm,
        occlusionZipY,
        dissipationAmount,
        waveAmplitude,
      } = syncState;

      const cx = toPx(centerX);
      const cy = toPy(centerY);

      // Helper to compute front curve points from yStart to yEnd
      const maxArmY = centerY + 0.56;
      const dyCut = Math.max(0.05, cutY - centerY);

      // Slope parameters matched cleanly so curves pass through (coldXNorm, cutY) & (warmXNorm, cutY)
      const coldSlope = (coldXNorm - centerX) / dyCut;
      const warmSlope = (warmXNorm - centerX) / dyCut;

      const getColdX = (y: number) => {
        const dy = Math.max(0, y - centerY);
        return centerX + coldSlope * dy - 0.03 * Math.sin((dy / 0.56) * Math.PI);
      };
      const getWarmX = (y: number) => {
        const dy = Math.max(0, y - centerY);
        return centerX + warmSlope * dy + 0.025 * Math.sin((dy / 0.56) * Math.PI);
      };

      const zipY = Math.min(maxArmY, Math.max(centerY, occlusionZipY));
      const getTripleX = (y: number) => (getColdX(y) + getWarmX(y)) * 0.5;

      // 2. Subtle air-mass shading on the map
      const activeAlpha = Math.max(0.08, 1 - dissipationAmount * 0.85);
      ctx.save();
      // Cold air background tint
      ctx.fillStyle = `rgba(219, 234, 254, ${0.42})`;
      ctx.fillRect(pad + 1, pad + 1, mapW - 2, mapH - 2);

      // Warm sector polygon (between cold arm and warm arm)
      if (zipY < maxArmY - 0.01 && waveAmplitude > 0.08) {
        ctx.beginPath();
        const steps = 16;
        for (let i = 0; i <= steps; i++) {
          const y = zipY + ((maxArmY - zipY) * i) / steps;
          const x = getColdX(y);
          if (i === 0) ctx.moveTo(toPx(x), toPy(y));
          else ctx.lineTo(toPx(x), toPy(y));
        }
        for (let i = steps; i >= 0; i--) {
          const y = zipY + ((maxArmY - zipY) * i) / steps;
          const x = getWarmX(y);
          ctx.lineTo(toPx(x), toPy(y));
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(254, 202, 202, ${0.58 * activeAlpha})`;
        ctx.fill();
      }
      ctx.restore();

      // 3. Precipitation zones (green translucent bands)
      ctx.save();
      const drawRainBand = (xFn: (y: number) => number, y0: number, y1: number, offsetX: number, bandWidthPx: number) => {
        if (y1 - y0 < 0.02) return;
        ctx.beginPath();
        const steps = 14;
        for (let i = 0; i <= steps; i++) {
          const y = y0 + ((y1 - y0) * i) / steps;
          const px = toPx(xFn(y)) + offsetX;
          const py = toPy(y);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.28 * activeAlpha})`;
        ctx.lineWidth = bandWidthPx;
        ctx.stroke();
      };

      if (progress < 0.16) {
        // Stationary front rain band
        drawRainBand(() => centerX, centerY - 0.04, centerY + 0.04, 0, 42);
      } else {
        // Occluded front rain
        if (zipY > centerY + 0.02) {
          drawRainBand(getTripleX, centerY, zipY, 0, 32);
        }
        // Cold front narrow rain behind
        drawRainBand(getColdX, zipY, maxArmY, -14, 22);
        // Warm front wide rain ahead
        drawRainBand(getWarmX, zipY, maxArmY, +24, 42);
      }
      ctx.restore();

      // 4. Isobars (등압선) around Low Center
      const isobarCount = dissipationAmount > 0.6 ? 2 : 4;
      const baseRadii = [0.16, 0.29, 0.43, 0.58];
      ctx.save();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.42)';
      ctx.lineWidth = 1.4;
      for (let idx = 0; idx < isobarCount; idx++) {
        const r = baseRadii[idx] * (1 + dissipationAmount * 0.25);
        const hpa = pressureHpa + (idx + 1) * 4;
        ctx.beginPath();
        const pts = 48;
        for (let k = 0; k <= pts; k++) {
          const ang = (k / pts) * Math.PI * 2;
          // Slight trough pinch along fronts
          const sinA = Math.sin(ang);
          const pinch = sinA > 0.2 && waveAmplitude > 0.2 ? 1.12 : 1.0;
          const nx = centerX + Math.cos(ang) * r * 1.18 * pinch;
          const ny = centerY + Math.sin(ang) * r * 0.92 * pinch;
          const px = toPx(nx);
          const py = toPy(ny);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Isobar hPa label at top of contour
        ctx.fillStyle = '#475569';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${hpa}`, cx, toPy(centerY - r * 0.92) - 3);
      }
      ctx.restore();

      // 5. Front lines & meteorological symbols
      const drawSymbolsAlongCurve = (
        points: [number, number][],
        color: string,
        type: 'cold' | 'warm' | 'stationary' | 'occluded',
        alpha = 1
      ) => {
        if (points.length < 2) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        points.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Compute arc length & place symbols every ~28px
        let distAcc = 12;
        let symIdx = 0;
        for (let i = 1; i < points.length; i++) {
          const [x0, y0] = points[i - 1];
          const [x1, y1] = points[i];
          const dx = x1 - x0;
          const dy = y1 - y0;
          const segLen = Math.hypot(dx, dy);
          if (segLen < 0.001) continue;
          const ux = dx / segLen;
          const uy = dy / segLen;
          // Normal pointing generally East/Right relative to top-to-bottom curve
          let nx = uy;
          let ny = -ux;
          if (nx < 0 && type !== 'stationary') {
            nx = -nx;
            ny = -ny;
          }

          let cursor = 0;
          while (distAcc + (segLen - cursor) >= 26) {
            const need = 26 - distAcc;
            cursor += need;
            distAcc = 0;
            const sx = x0 + ux * cursor;
            const sy = y0 + uy * cursor;
            const ang = Math.atan2(ny, nx);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(ang);

            if (type === 'cold') {
              ctx.fillStyle = '#1D4ED8';
              ctx.beginPath();
              ctx.moveTo(0, -6);
              ctx.lineTo(10, 0);
              ctx.lineTo(0, 6);
              ctx.closePath();
              ctx.fill();
            } else if (type === 'warm') {
              ctx.fillStyle = '#DC2626';
              ctx.beginPath();
              ctx.arc(0, 0, 6.5, -Math.PI / 2, Math.PI / 2, false);
              ctx.closePath();
              ctx.fill();
            } else if (type === 'occluded') {
              ctx.fillStyle = '#7C3AED';
              if (symIdx % 2 === 0) {
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.lineTo(10, 0);
                ctx.lineTo(0, 6);
                ctx.closePath();
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(0, 0, 6.5, -Math.PI / 2, Math.PI / 2, false);
                ctx.closePath();
                ctx.fill();
              }
            } else {
              // stationary: alternating sides
              if (symIdx % 2 === 0) {
                ctx.fillStyle = '#1D4ED8';
                ctx.beginPath();
                ctx.moveTo(0, -5.5);
                ctx.lineTo(9, 0);
                ctx.lineTo(0, 5.5);
                ctx.closePath();
                ctx.fill();
              } else {
                ctx.fillStyle = '#DC2626';
                ctx.beginPath();
                ctx.arc(0, 0, 6, Math.PI / 2, (Math.PI * 3) / 2, false);
                ctx.closePath();
                ctx.fill();
              }
            }
            ctx.restore();
            symIdx++;
          }
          distAcc += segLen - cursor;
        }
        ctx.restore();
      };

      const frontAlpha = Math.max(0.25, 1 - dissipationAmount * 0.7);

      if (progress < 0.14) {
        // Stage 1 early: Stationary front with gentle wave
        const leftPts: [number, number][] = [];
        const rightPts: [number, number][] = [];
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const x = centerX - 0.55 + t * 0.55;
          const y = centerY + Math.sin(t * Math.PI) * 0.04 * waveAmplitude;
          leftPts.push([toPx(x), toPy(y)]);
        }
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const x = centerX + t * 0.55;
          const y = centerY - Math.sin(t * Math.PI) * 0.04 * waveAmplitude;
          rightPts.push([toPx(x), toPy(y)]);
        }
        drawSymbolsAlongCurve(leftPts, '#1D4ED8', 'stationary', frontAlpha);
        drawSymbolsAlongCurve(rightPts, '#DC2626', 'stationary', frontAlpha);
      } else {
        // Occluded stem (if formed)
        if (zipY > centerY + 0.015) {
          const occPts: [number, number][] = [];
          for (let i = 0; i <= 16; i++) {
            const y = centerY + ((zipY - centerY) * i) / 16;
            occPts.push([toPx(getTripleX(y)), toPy(y)]);
          }
          drawSymbolsAlongCurve(occPts, '#7C3AED', 'occluded', frontAlpha);
        }
        // Remaining Cold Front arm & Warm Front arm below zipY
        if (zipY < maxArmY - 0.015) {
          const coldPts: [number, number][] = [];
          const warmPts: [number, number][] = [];
          for (let i = 0; i <= 18; i++) {
            const y = zipY + ((maxArmY - zipY) * i) / 18;
            coldPts.push([toPx(getColdX(y)), toPy(y)]);
            warmPts.push([toPx(getWarmX(y)), toPy(y)]);
          }
          drawSymbolsAlongCurve(coldPts, '#1D4ED8', 'cold', frontAlpha);
          drawSymbolsAlongCurve(warmPts, '#DC2626', 'warm', frontAlpha);
        }
      }

      // 6. Westerly wind / cyclone track arrow at top
      ctx.save();
      ctx.strokeStyle = '#64748b';
      ctx.fillStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      const trackY = toPy(-0.76);
      ctx.beginPath();
      ctx.moveTo(toPx(-0.68), trackY);
      ctx.lineTo(toPx(0.68), trackY);
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(toPx(0.72), trackY);
      ctx.lineTo(toPx(0.65), trackY - 5);
      ctx.lineTo(toPx(0.65), trackY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.font = '700 11px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('편서풍 (서 → 동 이동)', toPx(0), trackY - 8);
      ctx.restore();

      // 7. Surface Wind Vectors around Low (반시계 방향 수렴)
      const drawWindArrow = (nx: number, ny: number, angleDeg: number, color: string) => {
        const px = toPx(nx);
        const py = toPy(ny);
        const rad = (angleDeg * Math.PI) / 180;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rad);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(6, -4.5);
        ctx.lineTo(6, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      if (progress >= 0.14 && dissipationAmount < 0.85) {
        // NW wind behind cold front (pointing SE = +40 deg)
        drawWindArrow(coldXNorm - 0.2, cutY - 0.14, 42, '#1D4ED8');
        // SW wind in warm sector (pointing NE = -48 deg)
        if (!syncState.isOccludedAtCut) {
          drawWindArrow((coldXNorm + warmXNorm) / 2, cutY - 0.08, -48, '#DC2626');
        }
        // SE wind ahead of warm front (pointing NW = -135 deg)
        drawWindArrow(warmXNorm + 0.22, cutY - 0.14, -135, '#0F766E');
      }

      // 8. Low Center Badge "L (저)"
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fillStyle = dissipationAmount > 0.7 ? '#64748b' : '#dc2626';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('L', cx, cy + 0.5);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(`${pressureHpa} hPa`, cx, cy - 24);
      ctx.restore();

      // 9. Cross-Section Cut Line A — A'
      const pyCut = toPy(cutY);
      ctx.save();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.moveTo(pad + 14, pyCut);
      ctx.lineTo(w - pad - 14, pyCut);
      ctx.stroke();
      ctx.setLineDash([]);

      // A and A' endpoints
      const drawEndpoint = (x: number, y: number, label: string) => {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 0.5);
      };
      drawEndpoint(pad + 18, pyCut, 'A');
      drawEndpoint(w - pad - 18, pyCut, "A'");

      // Intersection dots where A-A' meets fronts
      if (progress >= 0.14) {
        if (syncState.isOccludedAtCut) {
          ctx.fillStyle = '#7C3AED';
          ctx.beginPath();
          ctx.arc(toPx((coldXNorm + warmXNorm) / 2), pyCut, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#1D4ED8';
          ctx.beginPath();
          ctx.arc(toPx(coldXNorm), pyCut, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          ctx.arc(toPx(warmXNorm), pyCut, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Compass W / E
      ctx.fillStyle = '#475569';
      ctx.font = '700 12px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('서 (W)', pad + 10, h - pad - 10);
      ctx.textAlign = 'right';
      ctx.fillText('동 (E)', w - pad - 10, h - pad - 10);

      ctx.restore();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [syncState]);

  // Quiz-toggleable semantic DOM overlays on the weather map
  const { centerX, centerY, coldXNorm, warmXNorm, cutY, isOccludedAtCut, progress, dissipationAmount } = syncState;
  const toPctX = (nx: number) => `${Math.max(12, Math.min(88, ((nx + 1) / 2) * 100))}%`;
  const toPctY = (ny: number) => `${Math.max(12, Math.min(88, ((ny + 1) / 2) * 100))}%`;

  const mapLabels: { id: string; text: string; x: string; y: string; tone: string; show: boolean }[] = [
    {
      id: 'nw_wind',
      text: '북서풍 · 소나기 (찬 공기)',
      x: toPctX(coldXNorm - 0.24),
      y: toPctY(cutY - 0.25),
      tone: 'bg-blue-700 text-white border-blue-900',
      show: progress >= 0.2 && dissipationAmount < 0.8,
    },
    {
      id: 'sw_wind',
      text: '남서풍 · 맑음 (따뜻한 공기)',
      x: toPctX((coldXNorm + warmXNorm) / 2),
      y: toPctY(cutY + 0.14),
      tone: 'bg-red-600 text-white border-red-800',
      show: progress >= 0.2 && !isOccludedAtCut && dissipationAmount < 0.7,
    },
    {
      id: 'se_wind',
      text: '남동풍 · 지속적 비 (찬 공기)',
      x: toPctX(warmXNorm + 0.25),
      y: toPctY(cutY - 0.25),
      tone: 'bg-teal-700 text-white border-teal-900',
      show: progress >= 0.2 && dissipationAmount < 0.8,
    },
    {
      id: 'occ_label',
      text: '폐색전선 형성',
      x: toPctX(centerX + 0.05),
      y: toPctY(centerY + 0.2),
      tone: 'bg-violet-700 text-white border-violet-900',
      show: progress >= 0.56,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-slate-900">① 위에서 내려다본 지상 일기도</span>
          <span className="text-xs text-slate-500">· A–A' 절단선 연동</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-600">단면 위치:</span>
          <button
            type="button"
            onClick={() => onCutOffsetChange(0.36)}
            className={`px-2 py-1 text-xs font-bold rounded transition-colors whitespace-nowrap cursor-pointer ${
              cutOffset >= 0.3 ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            저기압 남쪽
          </button>
          <button
            type="button"
            onClick={() => onCutOffsetChange(0.22)}
            className={`px-2 py-1 text-xs font-bold rounded transition-colors whitespace-nowrap cursor-pointer ${
              cutOffset < 0.3 ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            중심 부근
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-[340px] lg:min-h-[420px]">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {/* Overlay Labels / Quiz Click-to-Reveal */}
        <div className="pointer-events-none absolute inset-0">
          {mapLabels
            .filter((item) => item.show)
            .map((item) => {
              const revealed = showLabels || Boolean(revealedQuiz[item.id]);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!showLabels) {
                      setRevealedQuiz((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                    }
                  }}
                  style={{ left: item.x, top: item.y }}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-xs font-bold border shadow-sm whitespace-nowrap transition-colors ${
                    revealed
                      ? item.tone
                      : 'bg-amber-400 text-slate-950 border-amber-600 hover:bg-amber-300 cursor-pointer'
                  }`}
                >
                  {revealed ? item.text : '?'}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};
