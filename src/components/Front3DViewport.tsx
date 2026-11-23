import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Eye, EyeOff, Pause, Play, RotateCcw, Box, Layers, Compass } from 'lucide-react';
import { FrontType } from '../data/weatherData';
import {
  ATM_HALF_D,
  ATM_HALF_W,
  ATM_HEIGHT,
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

interface Front3DViewportProps {
  frontType: FrontType;
  progress: number;
  isPlaying: boolean;
  showLabels: boolean;
  onTogglePlay: () => void;
  onProgressChange: (val: number) => void;
  onReset: () => void;
  onToggleLabels: () => void;
}

type CameraPreset = 'iso' | 'cross' | 'top';

interface AnchorSpec {
  id: string;
  text: string;
  tone: 'cold' | 'warm' | 'front' | 'cloud' | 'rain';
  pos: THREE.Vector3;
  visible: boolean;
}

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
  iso: { pos: [8.8, 6.8, 12.6], target: [0, 1.8, 0], label: '입체 3D 뷰' },
  cross: { pos: [0, 2.2, 14.8], target: [0, 2.0, 0], label: '정면 단면도' },
  top: { pos: [0, 15.2, 0.8], target: [0, 0, 0], label: '상공 평면도 (일기도)' },
};

const _projVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetCtrl = new THREE.Vector3();

export const Front3DViewport: React.FC<Front3DViewportProps> = ({
  frontType,
  progress,
  isPlaying,
  showLabels,
  onTogglePlay,
  onProgressChange,
  onReset,
  onToggleLabels,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [activeAnchors, setActiveAnchors] = useState<
    { id: string; text: string; tone: AnchorSpec['tone'] }[]
  >([]);

  // Mutable refs for animation loop without recreating WebGL context
  const stateRef = useRef({
    frontType,
    progress,
    isPlaying,
    cameraPreset,
    transitioningCamera: false,
  });

  useEffect(() => {
    stateRef.current.frontType = frontType;
    setRevealedIds({});
  }, [frontType]);

  useEffect(() => {
    stateRef.current.progress = progress;
  }, [progress]);

  useEffect(() => {
    stateRef.current.isPlaying = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    setRevealedIds({});
  }, [showLabels]);

  const handleSelectCamera = (preset: CameraPreset) => {
    setCameraPreset(preset);
    stateRef.current.cameraPreset = preset;
    stateRef.current.transitioningCamera = true;
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
    camera.position.set(...CAMERA_PRESETS.iso.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 7;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(...CAMERA_PRESETS.iso.target);
    controls.update();

    const onControlStart = () => {
      stateRef.current.transitioningCamera = false;
    };
    controls.addEventListener('start', onControlStart);

    // Base terrain & glass atmospheric box
    const terrainAndBox = createTerrainAndBox();
    scene.add(terrainAndBox);

    // Air Mass 3D Volumes (balanced translucency so ground front symbols stay vivid)
    const coldMass = new ParametricAirMass(0x2563eb, 0.32, 0x1e40af);
    const warmMass = new ParametricAirMass(0xef4444, 0.27, 0xb91c1c);
    const coolAheadMass = new ParametricAirMass(0x3b82f6, 0.28, 0x1d4ed8);
    scene.add(coldMass.group, warmMass.group, coolAheadMass.group);

    // Frontal surface ribbons
    const primaryRibbon = new FrontalSurfaceRibbon(0x38bdf8);
    const secondaryRibbon = new FrontalSurfaceRibbon(0xfb7185);
    scene.add(primaryRibbon.group, secondaryRibbon.group);

    // Ground precipitation zone highlight plane (below raised ground front symbols)
    const rainZoneGeo = new THREE.PlaneGeometry(1, ATM_HALF_D * 1.9);
    rainZoneGeo.rotateX(-Math.PI / 2);
    const rainZoneMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const rainZonePatch = new THREE.Mesh(rainZoneGeo, rainZoneMat);
    rainZonePatch.position.y = 0.008;
    rainZonePatch.renderOrder = 1;
    scene.add(rainZonePatch);

    // Clouds
    const cbCloud = createCumulonimbusGroup();
    const stratusCloud = createLayeredStratusGroup();
    const mixedCloud = createCumulonimbusGroup();
    mixedCloud.scale.set(0.85, 0.78, 0.9);
    scene.add(cbCloud, stratusCloud, mixedCloud);

    // Ground Front Symbols
    const symCold = createGroundFrontSymbols('cold');
    const symWarm = createGroundFrontSymbols('warm');
    const symStat = createGroundFrontSymbols('stationary');
    const symOccl = createGroundFrontSymbols('occluded');
    scene.add(symCold, symWarm, symStat, symOccl);

    // Airflow Arrows
    const coldArrow1 = createFlowArrowMesh(0x1d4ed8);
    const coldArrow2 = createFlowArrowMesh(0x1d4ed8);
    const warmArrow1 = createFlowArrowMesh(0xdc2626);
    const warmArrow2 = createFlowArrowMesh(0xdc2626);
    scene.add(coldArrow1, coldArrow2, warmArrow1, warmArrow2);

    // Rain Particles
    const rainSystem = new RainSystem(180);
    scene.add(rainSystem.instancedMesh);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Anchors for 2D Korean Labels (concise 5-label set for high legibility)
    const anchors: AnchorSpec[] = [
      { id: 'cold_air', text: '찬 공기', tone: 'cold', pos: new THREE.Vector3(), visible: true },
      { id: 'warm_air', text: '따뜻한 공기', tone: 'warm', pos: new THREE.Vector3(), visible: true },
      { id: 'cool_ahead', text: '앞쪽 찬 공기', tone: 'cold', pos: new THREE.Vector3(), visible: false },
      { id: 'front_surface', text: '전선면', tone: 'front', pos: new THREE.Vector3(), visible: true },
      { id: 'front_line', text: '전선', tone: 'front', pos: new THREE.Vector3(), visible: true },
      { id: 'cloud', text: '적란운 · 소나기', tone: 'cloud', pos: new THREE.Vector3(), visible: true },
    ];
    setActiveAnchors(anchors.map((a) => ({ id: a.id, text: a.text, tone: a.tone })));

    let lastAnchorSignature = '';
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const updateSimulationScene = (dt: number, elapsed: number) => {
      const fType = stateRef.current.frontType;
      const t = stateRef.current.progress;

      // Reset visibility defaults
      symCold.visible = false;
      symWarm.visible = false;
      symStat.visible = false;
      symOccl.visible = false;
      cbCloud.visible = false;
      stratusCloud.visible = false;
      mixedCloud.visible = false;
      coolAheadMass.group.visible = false;
      secondaryRibbon.group.visible = false;
      coldArrow2.visible = false;

      let rainXMin = 0;
      let rainXMax = 0;
      let rainYTop = 2.0;
      let rainIntensity = 1.0;

      if (fType === 'cold') {
        const xF = -3.6 + t * 6.4;
        const slopeH = (x: number) => Math.min(3.5, Math.max(0.02, 3.5 * Math.tanh((xF - x) / 1.35)));

        coldMass.update(-ATM_HALF_W, xF, (x) => [0.01, slopeH(x)], true);
        warmMass.update(xF - 1.8, ATM_HALF_W, (x) => [x < xF ? slopeH(x) : 0.01, 4.35], true);
        primaryRibbon.update(xF - 2.4, xF, (x) => slopeH(x), 0x38bdf8, true);

        symCold.visible = true;
        symCold.position.x = xF;

        cbCloud.visible = true;
        const cloudScale = 0.72 + t * 0.35;
        cbCloud.scale.set(cloudScale, cloudScale, 1);
        cbCloud.position.set(xF - 0.85, 0.35, 0);

        rainXMin = Math.max(-ATM_HALF_W + 0.2, xF - 1.85);
        rainXMax = xF - 0.12;
        rainYTop = 1.5;
        rainIntensity = 0.95;

        // Cold air advancing under, warm air rising steeply
        const pulse = (elapsed * 0.9) % 1;
        coldArrow1.visible = true;
        coldArrow1.position.set(xF - 2.4 + pulse * 1.1, 0.65, 1.3);
        coldArrow1.rotation.set(0, 0, -0.08);

        warmArrow1.visible = true;
        warmArrow1.position.set(xF - 0.1 - pulse * 0.35, 1.05 + pulse * 1.35, 1.1);
        warmArrow1.rotation.set(0, 0, 1.12);

        warmArrow2.visible = true;
        warmArrow2.position.set(xF + 1.5 - pulse * 0.6, 0.85 + pulse * 0.9, -0.9);
        warmArrow2.rotation.set(0, 0, 0.92);

        anchors[0].pos.set(Math.max(-5.8, xF - 2.8), 1.35, 0.8);
        anchors[0].text = '찬 공기';
        anchors[1].pos.set(Math.min(5.6, xF + 2.9), 1.55, 0.6);
        anchors[1].text = '따뜻한 공기';
        anchors[2].visible = false;
        anchors[3].pos.set(xF - 0.9, 2.05, 2.4);
        anchors[3].text = '전선면';
        anchors[4].pos.set(xF + 0.1, 0.18, 2.35);
        anchors[4].text = '한랭전선';
        anchors[5].pos.set(xF - 0.75, 3.85, 0);
        anchors[5].text = '적란운 · 좁은 소나기';
      } else if (fType === 'warm') {
        const xF = -3.4 + t * 4.4;
        const slopeH = (x: number) => Math.min(3.35, Math.max(0.02, (x - xF) * 0.42));

        coldMass.update(xF, ATM_HALF_W, (x) => [0.01, slopeH(x)], true);
        warmMass.update(-ATM_HALF_W, ATM_HALF_W, (x) => [x > xF ? slopeH(x) : 0.01, 4.35], true);
        primaryRibbon.update(xF, ATM_HALF_W, (x) => slopeH(x), 0xf87171, true);

        symWarm.visible = true;
        symWarm.position.x = xF;

        stratusCloud.visible = true;
        stratusCloud.position.set(xF + 0.1, 0.15, 0);

        rainXMin = xF + 0.25;
        rainXMax = Math.min(ATM_HALF_W - 0.3, xF + 3.45);
        rainYTop = 1.6;
        rainIntensity = 0.65;

        const pulse = (elapsed * 0.65) % 1;
        warmArrow1.visible = true;
        warmArrow1.position.set(xF - 0.5 + pulse * 1.8, 0.85 + pulse * 0.75, 1.2);
        warmArrow1.rotation.set(0, 0, 0.4);

        warmArrow2.visible = true;
        warmArrow2.position.set(xF + 1.8 + pulse * 1.9, 1.7 + pulse * 0.8, -0.8);
        warmArrow2.rotation.set(0, 0, 0.38);

        coldArrow1.visible = true;
        coldArrow1.position.set(xF + 2.3 + pulse * 0.7, 0.45, 1.2);
        coldArrow1.rotation.set(0, 0, 0.0);

        anchors[0].pos.set(Math.min(5.6, xF + 3.6), 0.7, 1.0);
        anchors[0].text = '찬 공기';
        anchors[1].pos.set(Math.max(-5.5, xF - 2.5), 1.65, 0.8);
        anchors[1].text = '따뜻한 공기';
        anchors[2].visible = false;
        anchors[3].pos.set(xF + 2.3, 1.15, 2.45);
        anchors[3].text = '전선면';
        anchors[4].pos.set(xF, 0.18, 2.35);
        anchors[4].text = '온난전선';
        anchors[5].pos.set(xF + 2.5, 3.1, 0);
        anchors[5].text = '층운형 구름 · 넓은 비';
      } else if (fType === 'stationary') {
        // Gentle oscillation in place
        const xF = Math.sin(t * Math.PI * 4) * 0.45;
        const slopeH = (x: number) => Math.min(3.1, Math.max(0.02, 3.1 * Math.tanh((xF - x) / 2.2)));

        coldMass.update(-ATM_HALF_W, xF, (x) => [0.01, slopeH(x)], true);
        warmMass.update(xF - 2.6, ATM_HALF_W, (x) => [x < xF ? slopeH(x) : 0.01, 4.35], true);
        primaryRibbon.update(xF - 2.6, xF, (x) => slopeH(x), 0x818cf8, true);

        symStat.visible = true;
        symStat.position.x = xF;

        stratusCloud.visible = true;
        stratusCloud.scale.set(0.7, 0.9, 1);
        stratusCloud.position.set(xF - 1.3, 0.35, 0);

        rainXMin = xF - 1.1;
        rainXMax = xF + 1.5;
        rainYTop = 1.7;
        rainIntensity = 0.85;

        const pulse = (elapsed * 0.7) % 1;
        coldArrow1.visible = true;
        coldArrow1.position.set(xF - 2.5 + pulse * 0.8, 0.75, 1.1);
        coldArrow1.rotation.set(0, 0, 0);

        warmArrow1.visible = true;
        warmArrow1.position.set(xF + 2.5 - pulse * 0.8, 0.75, 1.1);
        warmArrow1.rotation.set(0, 0, Math.PI);

        warmArrow2.visible = true;
        warmArrow2.position.set(xF - 0.1 - pulse * 0.5, 1.45 + pulse * 0.7, -0.7);
        warmArrow2.rotation.set(0, 0, 2.35);

        anchors[0].pos.set(-3.9, 1.45, 0.8);
        anchors[0].text = '찬 기단';
        anchors[1].pos.set(3.9, 1.45, 0.8);
        anchors[1].text = '따뜻한 기단';
        anchors[2].visible = false;
        anchors[3].pos.set(xF - 1.1, 1.9, 2.45);
        anchors[3].text = '전선면';
        anchors[4].pos.set(xF, 0.18, 2.35);
        anchors[4].text = '정체전선';
        anchors[5].pos.set(xF + 0.1, 3.15, 0);
        anchors[5].text = '장마 구름 · 많은 비';
      } else {
        // Occluded Front: cold front catches up to warm front, lifting warm air aloft
        const xC = -3.8 + t * 6.4; // catches up faster
        const xW = -1.6 + t * 2.4; // moves slower
        const gap = xW - xC; // becomes <= 0 around t ~ 0.34
        const occluded = gap <= 0.15;
        const liftH = occluded ? Math.min(2.2, Math.max(0.25, (-gap + 0.15) * 1.5)) : 0;
        const xMeet = occluded ? xW : xC;

        const coldBehindTop = (x: number) => {
          if (x > xC + 0.6) return 0.01;
          return Math.min(3.5, Math.max(0.02, 3.5 * Math.tanh((xC + 0.5 - x) / 1.5)));
        };
        const coolAheadTop = (x: number) => {
          if (x < xW - 0.6) return 0.01;
          return Math.min(3.2, Math.max(0.02, (x - (xW - 0.5)) * 0.45));
        };

        // Cold air behind
        coldMass.update(-ATM_HALF_W, Math.min(ATM_HALF_W, xC + 0.5), (x) => [0.01, coldBehindTop(x)], true);
        // Cool air ahead
        coolAheadMass.update(Math.max(-ATM_HALF_W, xW - 0.5), ATM_HALF_W, (x) => [0.01, coolAheadTop(x)], true);

        // Warm air pocket: pinched from ground when cold catches up
        const warmStart = Math.max(-ATM_HALF_W, xC - 2.2);
        warmMass.update(
          warmStart,
          ATM_HALF_W,
          (x) => {
            const c1 = x <= xC + 0.5 ? coldBehindTop(x) : 0.01;
            const c2 = x >= xW - 0.5 ? coolAheadTop(x) : 0.01;
            const floor = Math.max(c1, c2, occluded && Math.abs(x - xMeet) < 1.3 ? liftH * (1 - Math.abs(x - xMeet) / 1.5) : 0.01);
            return [floor, 4.35];
          },
          true
        );

        primaryRibbon.update(Math.max(-ATM_HALF_W, xC - 2.0), xC + 0.2, (x) => coldBehindTop(x), occluded ? 0xa855f7 : 0x38bdf8, true);
        secondaryRibbon.update(xW - 0.2, ATM_HALF_W, (x) => coolAheadTop(x), occluded ? 0xa855f7 : 0xf87171, true);

        if (!occluded) {
          symCold.visible = true;
          symCold.position.x = xC;
          symWarm.visible = true;
          symWarm.position.x = xW;
        } else {
          symOccl.visible = true;
          symOccl.position.x = xMeet;
        }

        mixedCloud.visible = true;
        mixedCloud.position.set(xMeet + 0.3, 0.4 + liftH * 0.25, 0);

        rainXMin = Math.max(-ATM_HALF_W + 0.2, xMeet - 1.5);
        rainXMax = Math.min(ATM_HALF_W - 0.2, xMeet + 1.8);
        rainYTop = 1.65;
        rainIntensity = occluded ? 0.85 : 0.75;

        const pulse = (elapsed * 0.85) % 1;
        coldArrow1.visible = true;
        coldArrow1.position.set(xC - 1.9 + pulse * 1.1, 0.6, 1.1);
        coldArrow1.rotation.set(0, 0, 0);

        coldArrow2.visible = true;
        coldArrow2.position.set(xW + 2.2 + pulse * 0.4, 0.45, 1.1);
        coldArrow2.rotation.set(0, 0, 0);

        warmArrow1.visible = true;
        warmArrow1.position.set(xMeet, 1.0 + liftH * 0.75 + pulse * 0.9, 0.9);
        warmArrow1.rotation.set(0, 0, Math.PI / 2);

        warmArrow2.visible = false;

        anchors[0].pos.set(Math.max(-5.6, xC - 2.6), 1.35, 0.8);
        anchors[0].text = '뒤쪽 찬 공기';
        anchors[1].pos.set(xMeet + 0.1, occluded ? 2.5 + liftH * 0.35 : 1.1, 0.7);
        anchors[1].text = occluded ? '들려 오른 따뜻한 공기' : '따뜻한 공기';
        anchors[2].visible = true;
        anchors[2].pos.set(Math.min(5.6, xW + 2.8), 0.9, 0.8);
        anchors[2].text = '앞쪽 찬 공기';
        anchors[3].pos.set(xMeet - 0.3, 1.85, 2.45);
        anchors[3].text = '전선면';
        anchors[4].pos.set(xMeet, 0.18, 2.35);
        anchors[4].text = occluded ? '폐색전선' : '전선 추격 중';
        anchors[5].pos.set(xMeet + 0.3, 3.65, 0);
        anchors[5].text = '두꺼운 구름 · 비';
      }

      // Ground precipitation zone highlight
      const rainWidth = Math.max(0.01, rainXMax - rainXMin);
      rainZonePatch.scale.x = rainWidth;
      rainZonePatch.position.x = (rainXMin + rainXMax) / 2;
      rainZonePatch.visible = rainWidth > 0.15;

      rainSystem.update(dt, rainXMin, rainXMax, rainYTop, rainIntensity, true);

      // Update React anchor list only when label text or visibility changes
      const sig = anchors.map((a) => `${a.id}:${a.visible ? 1 : 0}:${a.text}`).join('|');
      if (sig !== lastAnchorSignature) {
        lastAnchorSignature = sig;
        setActiveAnchors(
          anchors.filter((a) => a.visible).map((a) => ({ id: a.id, text: a.text, tone: a.tone }))
        );
      }
    };

    const projectLabelsToDOM = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const isCompact = w < 640;
      const placed: { x: number; y: number }[] = [];
      const minTop = isCompact ? 54 : 56;
      const maxBot = h - (isCompact ? 72 : 76);

      for (const anchor of anchors) {
        const el = labelRefs.current[anchor.id];
        if (!el) continue;
        if (!anchor.visible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        _projVec.copy(anchor.pos).project(camera);
        if (_projVec.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        const rawX = ((_projVec.x + 1) / 2) * w;
        const rawY = ((-_projVec.y + 1) / 2) * h;
        const padX = isCompact ? 42 : 56;
        const x = Math.max(padX, Math.min(w - padX, rawX));
        let y = Math.max(minTop, Math.min(maxBot, rawY));

        // De-overlap vertically against already placed labels on small screens
        const minDx = isCompact ? 76 : 104;
        const minDy = isCompact ? 26 : 30;
        for (let pass = 0; pass < 3; pass++) {
          for (const prev of placed) {
            if (Math.abs(x - prev.x) < minDx && Math.abs(y - prev.y) < minDy) {
              const pushUp = y < prev.y ? -minDy : minDy;
              const nextY = y + pushUp;
              y = nextY >= minTop && nextY <= maxBot ? nextY : Math.max(minTop, Math.min(maxBot, y - pushUp));
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

      // Smooth damped camera preset transitions
      if (stateRef.current.transitioningCamera) {
        const preset = CAMERA_PRESETS[stateRef.current.cameraPreset];
        _targetCamPos.set(...preset.pos);
        _targetCtrl.set(...preset.target);
        const lambda = 7.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, lambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, lambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, lambda, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetCtrl.x, lambda, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetCtrl.y, lambda, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetCtrl.z, lambda, dt);
        if (camera.position.distanceTo(_targetCamPos) < 0.04) {
          stateRef.current.transitioningCamera = false;
        }
      }

      controls.update();
      updateSimulationScene(dt, elapsed);
      renderer.render(scene, camera);
      projectLabelsToDOM();

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
      coldMass.dispose();
      warmMass.dispose();
      coolAheadMass.dispose();
      primaryRibbon.dispose();
      secondaryRibbon.dispose();
      rainSystem.dispose();
      rainZoneGeo.dispose();
      rainZoneMat.dispose();
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
    <div className="relative w-full h-[430px] sm:h-[500px] lg:h-[540px] rounded-xl overflow-hidden border border-slate-200 bg-[#eef4fb]">
      {/* Isolated WebGL Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Camera Preset & Orbit Hint */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-0.5 sm:gap-1 bg-white/95 p-1 rounded-lg border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={() => handleSelectCamera('iso')}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cameraPreset === 'iso'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            입체 3D
          </button>
          <button
            type="button"
            onClick={() => handleSelectCamera('cross')}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cameraPreset === 'cross'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            정면
          </button>
          <button
            type="button"
            onClick={() => handleSelectCamera('top')}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cameraPreset === 'top'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            위
          </button>
        </div>
        <span className="hidden md:inline-block text-xs font-medium text-slate-600 bg-white/90 px-2.5 py-1.5 rounded-lg border border-slate-200">
          드래그로 3D 회전 · 스크롤 확대
        </span>
      </div>

      {/* Top-Right Quiz Label Toggle */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <button
          type="button"
          onClick={onToggleLabels}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-lg border shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            showLabels
              ? 'bg-white/95 text-slate-800 border-slate-300 hover:bg-slate-50'
              : 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
          }`}
        >
          {showLabels ? <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          <span className="hidden sm:inline">{showLabels ? '라벨 켜짐 (퀴즈 모드 끄기)' : '퀴즈 모드 (? 클릭)'}</span>
          <span className="sm:hidden">{showLabels ? '라벨 ON' : '퀴즈 (?)'}</span>
        </button>
      </div>

      {/* 3D Projected Crisp Korean Labels / Quiz Reveal Buttons */}
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
              title={!showLabels ? '클릭하여 용어 확인하기' : undefined}
              className={`absolute px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[11px] sm:text-xs font-bold border shadow-sm transition-opacity duration-150 whitespace-nowrap ${
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

      {/* Bottom Simulation Playback Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(680px,94%)] bg-white/95 border border-slate-200 rounded-xl px-4 py-2.5 shadow-md flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? '일시정지' : '재생'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          aria-label="처음으로 되돌리기"
          title="처음으로 되돌리기"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold text-slate-600 whitespace-nowrap shrink-0">시간 흐름</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={progress}
            onChange={(e) => onProgressChange(parseFloat(e.target.value))}
            className="sim-slider w-full"
            aria-label="전선 이동 시간 슬라이더"
          />
          <span className="font-mono-num text-xs font-bold text-slate-800 w-10 text-right shrink-0">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
