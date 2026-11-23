import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Box, Layers } from 'lucide-react';
import { CycloneSyncState } from '../utils/cycloneModel';
import {
  ATM_HALF_W,
  createCumulonimbusGroup,
  createFlowArrowMesh,
  createGroundFrontSymbols,
  createLayeredStratusGroup,
  createRenderer,
  createTerrainAndBox,
  detectSoftwareWebGL,
  FrontalSurfaceRibbon,
  ParametricAirMass,
  RainSystem,
  setupStudioScene,
} from '../utils/threeAtmosphere';

interface CycloneCross3DViewportProps {
  syncState: CycloneSyncState;
  showLabels: boolean;
}

type CamMode = 'iso' | 'front';

interface AnchorSpec {
  id: string;
  text: string;
  tone: 'cold' | 'warm' | 'front' | 'cloud' | 'rain';
  pos: THREE.Vector3;
  visible: boolean;
}

const _proj = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _ctrlTarget = new THREE.Vector3();

const CAM_MODES: Record<CamMode, { pos: [number, number, number]; target: [number, number, number] }> = {
  iso: { pos: [6.4, 5.8, 13.4], target: [0, 1.7, 0] },
  front: { pos: [0, 2.2, 15.2], target: [0, 1.9, 0] },
};

export const CycloneCross3DViewport: React.FC<CycloneCross3DViewportProps> = ({
  syncState,
  showLabels,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [camMode, setCamMode] = useState<CamMode>('iso');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [activeAnchors, setActiveAnchors] = useState<
    { id: string; text: string; tone: AnchorSpec['tone'] }[]
  >([]);

  const syncRef = useRef(syncState);
  const camRef = useRef({ mode: camMode, transitioning: false });

  useEffect(() => {
    syncRef.current = syncState;
  }, [syncState]);

  useEffect(() => {
    setRevealedIds({});
  }, [showLabels]);

  const handleCamChange = (mode: CamMode) => {
    setCamMode(mode);
    camRef.current = { mode, transitioning: true };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createRenderer(container, isSoftwareGl);
    const scene = setupStudioScene(renderer);

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      100
    );
    camera.position.set(...CAM_MODES.iso.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 7;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(...CAM_MODES.iso.target);
    controls.update();

    const onControlStart = () => {
      camRef.current.transitioning = false;
    };
    controls.addEventListener('start', onControlStart);

    scene.add(createTerrainAndBox());

    const coldLeftMass = new ParametricAirMass(0x2563eb, 0.34, 0x1e40af);
    const coolRightMass = new ParametricAirMass(0x3b82f6, 0.28, 0x1d4ed8);
    const warmSectorMass = new ParametricAirMass(0xef4444, 0.29, 0xb91c1c);
    scene.add(coldLeftMass.group, coolRightMass.group, warmSectorMass.group);

    const coldRibbon = new FrontalSurfaceRibbon(0x38bdf8);
    const warmRibbon = new FrontalSurfaceRibbon(0xf87171);
    scene.add(coldRibbon.group, warmRibbon.group);

    const cbCloud = createCumulonimbusGroup();
    const stratusCloud = createLayeredStratusGroup();
    cbCloud.scale.set(0.75, 0.75, 0.85);
    stratusCloud.scale.set(0.82, 0.85, 0.9);
    scene.add(cbCloud, stratusCloud);

    const symCold = createGroundFrontSymbols('cold');
    const symWarm = createGroundFrontSymbols('warm');
    const symStat = createGroundFrontSymbols('stationary');
    const symOccl = createGroundFrontSymbols('occluded');
    scene.add(symCold, symWarm, symStat, symOccl);

    const coldArrow = createFlowArrowMesh(0x1d4ed8);
    const warmUpArrow = createFlowArrowMesh(0xdc2626);
    const warmGlideArrow = createFlowArrowMesh(0xdc2626);
    scene.add(coldArrow, warmUpArrow, warmGlideArrow);

    const rainCold = new RainSystem(95);
    const rainWarm = new RainSystem(110);
    scene.add(rainCold.instancedMesh, rainWarm.instancedMesh);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const anchors: AnchorSpec[] = [
      { id: 'cold_l', text: '찬 공기', tone: 'cold', pos: new THREE.Vector3(), visible: true },
      { id: 'warm_s', text: '따뜻한 공기', tone: 'warm', pos: new THREE.Vector3(), visible: true },
      { id: 'cold_r', text: '앞쪽 찬 공기', tone: 'cold', pos: new THREE.Vector3(), visible: true },
      { id: 'cb_c', text: '적란운', tone: 'cloud', pos: new THREE.Vector3(), visible: true },
      { id: 'st_c', text: '층운형 구름', tone: 'cloud', pos: new THREE.Vector3(), visible: true },
      { id: 'occ_c', text: '폐색전선', tone: 'front', pos: new THREE.Vector3(), visible: false },
    ];
    setActiveAnchors(anchors.map((a) => ({ id: a.id, text: a.text, tone: a.tone })));

    let lastSig = '';
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const mapToWorldX = (nx: number) =>
      Math.max(-ATM_HALF_W + 0.6, Math.min(ATM_HALF_W - 0.6, nx * (ATM_HALF_W * 0.92)));

    const updateCrossSection = (dt: number, elapsed: number) => {
      const s = syncRef.current;
      const xC = mapToWorldX(s.coldXNorm);
      const xW = mapToWorldX(s.warmXNorm);
      const xMeet = (xC + xW) * 0.5;

      symCold.visible = false;
      symWarm.visible = false;
      symStat.visible = false;
      symOccl.visible = false;

      if (s.progress < 0.14) {
        // Stage 1: Stationary / nascent wave
        const xMid = mapToWorldX(s.centerX);
        const hFn = (x: number) => Math.min(3.1, Math.max(0.02, 3.1 * Math.tanh((xMid - x) / 2.0)));
        coldLeftMass.update(-ATM_HALF_W, xMid, (x) => [0.01, hFn(x)], true);
        coolRightMass.update(0, 0, () => [0, 0], false);
        warmSectorMass.update(xMid - 2.0, ATM_HALF_W, (x) => [x < xMid ? hFn(x) : 0.01, 4.25], true);
        coldRibbon.update(xMid - 2.0, xMid, hFn, 0x818cf8, true);
        warmRibbon.update(0, 0, () => 0, 0xf87171, false);

        symStat.visible = true;
        symStat.position.x = xMid;

        cbCloud.visible = false;
        stratusCloud.visible = true;
        stratusCloud.position.set(xMid - 1.1, 0.3, 0);

        rainCold.update(dt, xMid - 0.9, xMid + 1.1, 1.5, 0.55, true);
        rainWarm.update(dt, 0, 0, 0, 0, false);

        coldArrow.visible = true;
        coldArrow.position.set(xMid - 2.1, 0.6, 1.0);
        coldArrow.rotation.set(0, 0, 0);
        warmUpArrow.visible = true;
        warmUpArrow.position.set(xMid + 2.0, 0.7, 1.0);
        warmUpArrow.rotation.set(0, 0, Math.PI);
        warmGlideArrow.visible = false;

        anchors[0].visible = true;
        anchors[0].pos.set(Math.max(-5.8, xMid - 2.5), 1.4, 0.6);
        anchors[0].text = '찬 기단';
        anchors[1].visible = true;
        anchors[1].pos.set(Math.min(5.6, xMid + 2.6), 1.5, 0.6);
        anchors[1].text = '따뜻한 기단';
        anchors[2].visible = false;
        anchors[3].visible = false;
        anchors[4].visible = true;
        anchors[4].pos.set(xMid, 3.0, 0);
        anchors[4].text = '정체전선 구름';
        anchors[5].visible = false;
      } else if (!s.isOccludedAtCut) {
        // Stage 2: Open Cold Front + Warm Sector + Warm Front
        const coldTop = (x: number) =>
          x > xC ? 0.01 : Math.min(3.35, Math.max(0.02, 3.35 * Math.tanh((xC - x) / 1.15)));
        const coolTop = (x: number) =>
          x < xW ? 0.01 : Math.min(3.2, Math.max(0.02, (x - xW) * 0.44));

        coldLeftMass.update(-ATM_HALF_W, xC, (x) => [0.01, coldTop(x)], true);
        coolRightMass.update(xW, ATM_HALF_W, (x) => [0.01, coolTop(x)], true);

        const warmStart = Math.max(-ATM_HALF_W, xC - 1.7);
        warmSectorMass.update(
          warmStart,
          ATM_HALF_W,
          (x) => [Math.max(coldTop(x), coolTop(x)), 4.3],
          true
        );

        coldRibbon.update(warmStart, xC, coldTop, 0x38bdf8, true);
        warmRibbon.update(xW, ATM_HALF_W, coolTop, 0xf87171, true);

        symCold.visible = true;
        symCold.position.x = xC;
        symWarm.visible = true;
        symWarm.position.x = xW;

        cbCloud.visible = true;
        cbCloud.position.set(xC - 0.65, 0.35, 0);
        stratusCloud.visible = true;
        stratusCloud.position.set(xW + 0.05, 0.18, 0);

        rainCold.update(dt, Math.max(-ATM_HALF_W + 0.2, xC - 1.4), xC - 0.08, 1.4, 0.9, true);
        rainWarm.update(dt, xW + 0.2, Math.min(ATM_HALF_W - 0.2, xW + 2.6), 1.5, 0.65, true);

        const pulse = (elapsed * 0.85) % 1;
        coldArrow.visible = true;
        coldArrow.position.set(xC - 1.9 + pulse * 0.9, 0.55, 1.1);
        coldArrow.rotation.set(0, 0, 0);

        warmUpArrow.visible = true;
        warmUpArrow.position.set(xC + 0.1 - pulse * 0.25, 0.9 + pulse * 1.1, 0.9);
        warmUpArrow.rotation.set(0, 0, 1.15);

        warmGlideArrow.visible = true;
        warmGlideArrow.position.set(xW - 0.2 + pulse * 1.6, 0.85 + pulse * 0.65, 0.9);
        warmGlideArrow.rotation.set(0, 0, 0.4);

        anchors[0].visible = true;
        anchors[0].pos.set(Math.max(-5.8, xC - 2.1), 1.3, 0.7);
        anchors[0].text = '찬 공기';
        anchors[1].visible = true;
        anchors[1].pos.set((xC + xW) * 0.5, 1.25, 0.7);
        anchors[1].text = '따뜻한 공기';
        anchors[2].visible = true;
        anchors[2].pos.set(Math.min(5.8, xW + 2.4), 0.75, 0.7);
        anchors[2].text = '찬 공기';
        anchors[3].visible = true;
        anchors[3].pos.set(xC - 0.55, 3.25, 0);
        anchors[3].text = '적란운';
        anchors[4].visible = true;
        anchors[4].pos.set(Math.min(5.4, xW + 2.0), 2.75, 0);
        anchors[4].text = '층운형 구름';
        anchors[5].visible = false;
      } else {
        // Stage 3 & 4: Occluded -> Dissipation (warm air lifted completely aloft!)
        const occ = s.occlusionAmount; // 0..1
        const diss = s.dissipationAmount; // 0..1
        const liftFloor = 0.25 + occ * 2.1 + diss * 0.9;

        const coldTop = (x: number) => {
          const base = Math.min(3.35, Math.max(0.02, 3.35 * Math.tanh((xMeet + 0.8 - x) / 1.6)));
          return Math.max(base, liftFloor * Math.exp(-Math.pow((x - xMeet) / 3.5, 2)));
        };
        const coolTop = (x: number) => {
          const base = Math.min(3.15, Math.max(0.02, (x - (xMeet - 0.8)) * 0.45));
          return Math.max(base, liftFloor * Math.exp(-Math.pow((x - xMeet) / 3.5, 2)));
        };

        // Cold air now blankets the surface
        coldLeftMass.update(-ATM_HALF_W, xMeet + 0.1, (x) => [0.01, coldTop(x)], true);
        coolRightMass.update(xMeet - 0.1, ATM_HALF_W, (x) => [0.01, coolTop(x)], true);

        // Warm air lifted aloft (disappears as dissipation -> 1)
        const warmBottomAt = (x: number) => Math.max(coldTop(x), coolTop(x));
        const warmTop = Math.max(3.6, 4.35 - diss * 0.4);
        warmSectorMass.update(
          Math.max(-ATM_HALF_W, xMeet - 3.5),
          ATM_HALF_W,
          (x) => [warmBottomAt(x), warmTop],
          diss < 0.92
        );

        coldRibbon.update(Math.max(-ATM_HALF_W, xMeet - 2.6), xMeet + 0.1, coldTop, 0xa855f7, diss < 0.85);
        warmRibbon.update(xMeet - 0.1, ATM_HALF_W, coolTop, 0xa855f7, diss < 0.85);

        symOccl.visible = diss < 0.82;
        symOccl.position.x = xMeet;

        const cloudOpacityScale = Math.max(0.2, 1 - diss * 0.8);
        cbCloud.visible = diss < 0.85;
        cbCloud.position.set(xMeet - 0.2, 0.65 + occ * 0.5, 0);
        cbCloud.scale.setScalar(0.75 * cloudOpacityScale);

        stratusCloud.visible = diss < 0.92;
        stratusCloud.position.set(xMeet + 0.3, 0.55 + occ * 0.4, 0);
        stratusCloud.scale.set(0.8 * cloudOpacityScale, 0.75 * cloudOpacityScale, 0.85);

        const rainPower = Math.max(0, 0.85 * (1 - diss * 1.15));
        rainCold.update(dt, xMeet - 1.3, xMeet + 1.5, 1.8, rainPower, rainPower > 0.05);
        rainWarm.update(dt, 0, 0, 0, 0, false);

        const pulse = (elapsed * 0.75) % 1;
        coldArrow.visible = true;
        coldArrow.position.set(xMeet - 1.8 + pulse * 0.9, 0.65, 1.0);
        coldArrow.rotation.set(0, 0, 0);

        warmUpArrow.visible = diss < 0.85;
        warmUpArrow.position.set(xMeet, Math.min(3.5, liftFloor + 0.3 + pulse * 0.7), 0.9);
        warmUpArrow.rotation.set(0, 0, Math.PI / 2);
        warmGlideArrow.visible = false;

        anchors[0].visible = true;
        anchors[0].pos.set(-3.8, 1.1, 0.7);
        anchors[0].text = diss >= 0.6 ? '찬 공기 (지표 덮음)' : '뒤쪽 찬 공기';
        anchors[1].visible = diss < 0.9;
        anchors[1].pos.set(xMeet + 0.1, Math.min(3.9, liftFloor + 1.15), 0.6);
        anchors[1].text = diss >= 0.6 ? '소멸 중인 온난 공기' : '상승한 따뜻한 공기';
        anchors[2].visible = true;
        anchors[2].pos.set(4.0, 0.9, 0.7);
        anchors[2].text = '앞쪽 찬 공기';
        anchors[3].visible = false;
        anchors[4].visible = false;
        anchors[5].visible = true;
        anchors[5].pos.set(xMeet, 0.22, 2.2);
        anchors[5].text = diss >= 0.65 ? '저기압 소멸' : '폐색전선';
      }

      const sig = anchors.map((a) => `${a.id}:${a.visible ? 1 : 0}:${a.text}`).join('|');
      if (sig !== lastSig) {
        lastSig = sig;
        setActiveAnchors(
          anchors.filter((a) => a.visible).map((a) => ({ id: a.id, text: a.text, tone: a.tone }))
        );
      }
    };

    const projectLabels = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const isCompact = w < 540;
      const placed: { x: number; y: number }[] = [];
      const minTop = 22;
      const maxBot = h - 24;

      for (const anchor of anchors) {
        const el = labelRefs.current[anchor.id];
        if (!el) continue;
        if (!anchor.visible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        _proj.copy(anchor.pos).project(camera);
        if (_proj.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        const padX = isCompact ? 38 : 48;
        const x = Math.max(padX, Math.min(w - padX, ((_proj.x + 1) / 2) * w));
        let y = Math.max(minTop, Math.min(maxBot, ((-_proj.y + 1) / 2) * h));

        const minDx = isCompact ? 72 : 92;
        const minDy = isCompact ? 24 : 28;
        for (let pass = 0; pass < 3; pass++) {
          for (const prev of placed) {
            if (Math.abs(x - prev.x) < minDx && Math.abs(y - prev.y) < minDy) {
              const push = y < prev.y ? -minDy : minDy;
              const nextY = y + push;
              y = nextY >= minTop && nextY <= maxBot ? nextY : Math.max(minTop, Math.min(maxBot, y - push));
            }
          }
        }
        placed.push({ x, y });

        el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      }
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.08, clock.getDelta());
      const elapsed = clock.elapsedTime;

      if (camRef.current.transitioning) {
        const preset = CAM_MODES[camRef.current.mode];
        _camTargetPos.set(...preset.pos);
        _ctrlTarget.set(...preset.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 7.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 7.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 7.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _ctrlTarget.x, 7.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _ctrlTarget.y, 7.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _ctrlTarget.z, 7.5, dt);
        if (camera.position.distanceTo(_camTargetPos) < 0.04) {
          camRef.current.transitioning = false;
        }
      }

      controls.update();
      updateCrossSection(dt, elapsed);
      renderer.render(scene, camera);
      projectLabels();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      coldLeftMass.dispose();
      coolRightMass.dispose();
      warmSectorMass.dispose();
      coldRibbon.dispose();
      warmRibbon.dispose();
      rainCold.dispose();
      rainWarm.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const toneBadgeStyles: Record<AnchorSpec['tone'], string> = {
    cold: 'bg-blue-700 text-white border-blue-900',
    warm: 'bg-red-600 text-white border-red-800',
    front: 'bg-slate-900 text-white border-slate-700',
    cloud: 'bg-white text-slate-900 border-slate-400',
    rain: 'bg-sky-600 text-white border-sky-800',
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-slate-900">② A–A' 절단면 입체 단면도</span>
          <span className="hidden sm:inline text-xs text-slate-500">· A(서) ↔ A'(동)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleCamChange('iso')}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded transition-colors whitespace-nowrap cursor-pointer ${
              camMode === 'iso' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            입체 3D
          </button>
          <button
            type="button"
            onClick={() => handleCamChange('front')}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded transition-colors whitespace-nowrap cursor-pointer ${
              camMode === 'front' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            정면 단면
          </button>
        </div>
      </div>

      <div ref={mountRef} className="relative flex-1 min-h-[320px] sm:min-h-[360px] lg:min-h-[420px] cursor-grab active:cursor-grabbing bg-[#eef4fb]">
        {/* Projected Korean Labels / Quiz Reveal */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {activeAnchors.map((anchor) => {
            const isVisible = showLabels || Boolean(revealedIds[anchor.id]);
            return (
              <button
                key={anchor.id}
                type="button"
                ref={(el) => {
                  labelRefs.current[anchor.id] = el;
                }}
                onClick={() => {
                  if (!showLabels) {
                    setRevealedIds((prev) => ({ ...prev, [anchor.id]: !prev[anchor.id] }));
                  }
                }}
                style={{ left: 0, top: 0 }}
                className={`absolute px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold border shadow-sm whitespace-nowrap transition-opacity duration-150 ${
                  isVisible
                    ? toneBadgeStyles[anchor.tone]
                    : 'bg-amber-400 text-slate-950 border-amber-600 hover:bg-amber-300 cursor-pointer'
                }`}
              >
                {isVisible ? anchor.text : '?'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
