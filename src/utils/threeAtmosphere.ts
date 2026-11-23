import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const ATM_WIDTH = 14.4; // X: -7.2 .. +7.2
export const ATM_HALF_W = ATM_WIDTH / 2;
export const ATM_HEIGHT = 4.8; // Y: 0 .. 4.8
export const ATM_DEPTH = 5.6;  // Z: -2.8 .. +2.8
export const ATM_HALF_D = ATM_DEPTH / 2;

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createRenderer(container: HTMLElement, isSoftwareGl: boolean): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  return renderer;
}

export function setupStudioScene(renderer: THREE.WebGLRenderer): THREE.Scene {
  const scene = new THREE.Scene();
  const bgColor = new THREE.Color('#eef4fb');
  scene.background = bgColor;
  scene.fog = new THREE.Fog(bgColor, 26, 60);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  // Warm Key Light + Cool Hemisphere Fill + Crisp Rim Light
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x94a3b8, 0.85);
  hemiLight.position.set(0, 14, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
  keyLight.position.set(8, 13, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 36;
  const d = 10;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.55);
  rimLight.position.set(-9, 6, -8);
  scene.add(rimLight);

  return scene;
}

/**
 * 지형(지표면 + 지층 단면) 및 대기 공간 유리 상자 프레임 생성
 */
export function createTerrainAndBox(): THREE.Group {
  const group = new THREE.Group();

  // Contact shadow grounding plane
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  const contactPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(ATM_WIDTH + 4, ATM_DEPTH + 4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  contactPlane.rotation.x = -Math.PI / 2;
  contactPlane.position.y = -0.82;
  group.add(contactPlane);

  // Soil strata base slab (depth cutaway)
  const soilGeo = new THREE.BoxGeometry(ATM_WIDTH, 0.72, ATM_DEPTH);
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x785b43,
    roughness: 0.92,
    metalness: 0.02,
  });
  const soilMesh = new THREE.Mesh(soilGeo, soilMat);
  soilMesh.position.y = -0.44;
  soilMesh.receiveShadow = true;
  group.add(soilMesh);

  // Top surface texture with subtle coordinate grid & E/W orientation
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 1024;
  groundCanvas.height = 512;
  const gctx = groundCanvas.getContext('2d')!;
  gctx.fillStyle = '#dce8d5';
  gctx.fillRect(0, 0, 1024, 512);

  // Subtle terrain bands
  gctx.fillStyle = '#d1e0c8';
  for (let i = 0; i < 8; i += 2) {
    gctx.fillRect(i * 128, 0, 128, 512);
  }

  // Crisp grid lines
  gctx.strokeStyle = 'rgba(51, 65, 85, 0.14)';
  gctx.lineWidth = 2;
  for (let x = 0; x <= 1024; x += 128) {
    gctx.beginPath();
    gctx.moveTo(x, 0);
    gctx.lineTo(x, 512);
    gctx.stroke();
  }
  for (let y = 0; y <= 512; y += 128) {
    gctx.beginPath();
    gctx.moveTo(0, y);
    gctx.lineTo(1024, y);
    gctx.stroke();
  }

  // 서(W) / 동(E) markers on ground edge
  gctx.fillStyle = '#334155';
  gctx.font = 'bold 28px "Noto Sans KR", sans-serif';
  gctx.textBaseline = 'bottom';
  gctx.fillText('서 (W)', 22, 492);
  gctx.textAlign = 'right';
  gctx.fillText('동 (E)', 1002, 492);

  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 4;

  const topSlabGeo = new THREE.BoxGeometry(ATM_WIDTH, 0.08, ATM_DEPTH);
  const topSlabMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.85,
    metalness: 0.0,
  });
  const topSlab = new THREE.Mesh(topSlabGeo, topSlabMat);
  topSlab.position.y = -0.04;
  topSlab.receiveShadow = true;
  group.add(topSlab);

  // Atmospheric bounding box edges (sleek subtle glass frame)
  const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(ATM_WIDTH, ATM_HEIGHT, ATM_DEPTH));
  const boxLines = new THREE.LineSegments(
    boxEdges,
    new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.38 })
  );
  boxLines.position.y = ATM_HEIGHT / 2;
  group.add(boxLines);

  // Back altitude ticks (1km ~ 10km visual reference lines)
  const tickPoints: THREE.Vector3[] = [];
  for (let h = 1.2; h < ATM_HEIGHT; h += 1.2) {
    tickPoints.push(new THREE.Vector3(-ATM_HALF_W, h, -ATM_HALF_D));
    tickPoints.push(new THREE.Vector3(ATM_HALF_W, h, -ATM_HALF_D));
  }
  const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPoints);
  const tickLines = new THREE.LineSegments(
    tickGeo,
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25 })
  );
  group.add(tickLines);

  return group;
}

/**
 * 실시간으로 X-Y 단면 형태가 변형되는 3D 기단(Air Mass) 프리즘 메시
 * 고정 토폴로지로 매 프레임 메모리 할당 없이 부드러운 형태 변형 가능
 */
export class ParametricAirMass {
  public readonly group = new THREE.Group();
  private readonly segments: number;
  private readonly geometry: THREE.BufferGeometry;
  private readonly frontLineGeo: THREE.BufferGeometry;
  private readonly mesh: THREE.Mesh;
  private readonly frontLine: THREE.LineLoop;
  private readonly positions: Float32Array;
  private readonly frontLinePos: Float32Array;
  private readonly halfD: number;

  constructor(
    colorHex: number,
    opacity: number,
    outlineColorHex: number,
    segments = 56,
    halfD = ATM_HALF_D - 0.06
  ) {
    this.segments = segments;
    this.halfD = halfD;

    // 4 vertices per X-slice:
    // 0: (x, yBot, +halfD)  front-bottom
    // 1: (x, yTop, +halfD)  front-top
    // 2: (x, yTop, -halfD)  back-top
    // 3: (x, yBot, -halfD)  back-bottom
    const numSlices = segments + 1;
    this.positions = new Float32Array(numSlices * 4 * 3);
    const indices: number[] = [];

    for (let i = 0; i < segments; i++) {
      const a = i * 4;
      const b = (i + 1) * 4;
      // Front face (+Z)
      indices.push(a + 0, b + 0, b + 1, a + 0, b + 1, a + 1);
      // Top face (+Y)
      indices.push(a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
      // Back face (-Z)
      indices.push(a + 2, b + 2, b + 3, a + 2, b + 3, a + 3);
      // Bottom face (-Y)
      indices.push(a + 3, b + 3, b + 0, a + 3, b + 0, a + 0);
    }
    // Left cap (i = 0)
    indices.push(0, 1, 2, 0, 2, 3);
    // Right cap (i = segments)
    const last = segments * 4;
    indices.push(last + 0, last + 3, last + 2, last + 0, last + 2, last + 1);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setIndex(indices);

    const mat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      transparent: true,
      opacity,
      roughness: 0.35,
      metalness: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.mesh.renderOrder = 2;
    this.group.add(this.mesh);

    // Crisp outline loop on the front cutaway plane (+halfD)
    const loopCount = numSlices * 2;
    this.frontLinePos = new Float32Array(loopCount * 3);
    this.frontLineGeo = new THREE.BufferGeometry();
    this.frontLineGeo.setAttribute('position', new THREE.BufferAttribute(this.frontLinePos, 3));
    this.frontLine = new THREE.LineLoop(
      this.frontLineGeo,
      new THREE.LineBasicMaterial({ color: outlineColorHex, transparent: true, opacity: 0.85 })
    );
    this.frontLine.renderOrder = 3;
    this.group.add(this.frontLine);
  }

  /**
   * xRange: [xStart, xEnd]
   * getProfile(x) => [yBottom, yTop]
   */
  public update(
    xStart: number,
    xEnd: number,
    getProfile: (x: number) => [number, number],
    visible = true
  ): void {
    this.group.visible = visible && xEnd - xStart > 0.05;
    if (!this.group.visible) return;

    const n = this.segments;
    const zF = this.halfD;
    const zB = -this.halfD;

    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = xStart + (xEnd - xStart) * u;
      const [ybRaw, ytRaw] = getProfile(x);
      const yb = Math.max(0.01, Math.min(ATM_HEIGHT, ybRaw));
      const yt = Math.max(yb + 0.01, Math.min(ATM_HEIGHT, ytRaw));

      const base = i * 12;
      // 0: front-bot
      this.positions[base + 0] = x;
      this.positions[base + 1] = yb;
      this.positions[base + 2] = zF;
      // 1: front-top
      this.positions[base + 3] = x;
      this.positions[base + 4] = yt;
      this.positions[base + 5] = zF;
      // 2: back-top
      this.positions[base + 6] = x;
      this.positions[base + 7] = yt;
      this.positions[base + 8] = zB;
      // 3: back-bot
      this.positions[base + 9] = x;
      this.positions[base + 10] = yb;
      this.positions[base + 11] = zB;

      // Top edge of front outline: forward
      const topIdx = i * 3;
      this.frontLinePos[topIdx + 0] = x;
      this.frontLinePos[topIdx + 1] = yt;
      this.frontLinePos[topIdx + 2] = zF + 0.015;

      // Bottom edge of front outline: backward (indices 2*n+1 down to n+1)
      const botIdx = (n * 2 + 1 - i) * 3;
      this.frontLinePos[botIdx + 0] = x;
      this.frontLinePos[botIdx + 1] = yb;
      this.frontLinePos[botIdx + 2] = zF + 0.015;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();

    (this.frontLineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.frontLineGeo.computeBoundingSphere();
  }

  public dispose(): void {
    this.geometry.dispose();
    this.frontLineGeo.dispose();
    (this.mesh.material as THREE.Material).dispose();
    (this.frontLine.material as THREE.Material).dispose();
  }
}

/**
 * 3D 전선면(Frontal Surface) 리본 — 찬 공기와 따뜻한 공기 경계면을 선명하게 강조
 */
export class FrontalSurfaceRibbon {
  public readonly group = new THREE.Group();
  public readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly edgeLineGeo: THREE.BufferGeometry;
  private readonly edgeLine: THREE.Line;
  private readonly positions: Float32Array;
  private readonly edgePositions: Float32Array;
  private readonly segments: number;

  constructor(colorHex = 0x38bdf8, segments = 48) {
    this.segments = segments;
    const numSlices = segments + 1;
    this.positions = new Float32Array(numSlices * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = (i + 1) * 2;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setIndex(indices);

    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.65,
      roughness: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.mesh.renderOrder = 6;
    this.group.add(this.mesh);

    // Crisp bright edge along the +Z front cutaway face
    this.edgePositions = new Float32Array(numSlices * 3);
    this.edgeLineGeo = new THREE.BufferGeometry();
    this.edgeLineGeo.setAttribute('position', new THREE.BufferAttribute(this.edgePositions, 3));
    this.edgeLine = new THREE.Line(
      this.edgeLineGeo,
      new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.98 })
    );
    this.edgeLine.renderOrder = 7;
    this.group.add(this.edgeLine);
  }

  public update(
    xStart: number,
    xEnd: number,
    getY: (x: number) => number,
    colorHex?: number,
    visible = true
  ): void {
    this.group.visible = visible && xEnd - xStart > 0.05;
    if (!this.group.visible) return;
    if (colorHex !== undefined) {
      const mat = this.mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(colorHex);
      mat.emissive.setHex(colorHex);
      (this.edgeLine.material as THREE.LineBasicMaterial).color.setHex(colorHex);
    }

    const halfD = ATM_HALF_D - 0.04;
    for (let i = 0; i <= this.segments; i++) {
      const x = xStart + ((xEnd - xStart) * i) / this.segments;
      const y = Math.max(0.03, Math.min(ATM_HEIGHT - 0.05, getY(x)));
      const base = i * 6;
      this.positions[base + 0] = x;
      this.positions[base + 1] = y;
      this.positions[base + 2] = halfD;
      this.positions[base + 3] = x;
      this.positions[base + 4] = y;
      this.positions[base + 5] = -halfD;

      const eBase = i * 3;
      this.edgePositions[eBase + 0] = x;
      this.edgePositions[eBase + 1] = y;
      this.edgePositions[eBase + 2] = halfD + 0.03;
    }
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();

    (this.edgeLineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.edgeLineGeo.computeBoundingSphere();
  }

  public dispose(): void {
    this.geometry.dispose();
    this.edgeLineGeo.dispose();
    (this.mesh.material as THREE.Material).dispose();
    (this.edgeLine.material as THREE.Material).dispose();
  }
}

/**
 * 3D 복합 구름 덩어리 생성기 (적란운 / 층운형 / 혼합형)
 */
export function createCumulonimbusGroup(): THREE.Group {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.92,
    metalness: 0.0,
  });
  const darkBaseMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.95,
    metalness: 0.0,
  });

  // Dark storm base puffs
  const baseOffsets: [number, number, number, number][] = [
    [-0.55, 0.95, 0, 0.55],
    [0.0, 1.0, 0.35, 0.62],
    [0.45, 0.98, -0.35, 0.58],
    [-0.25, 1.05, -0.5, 0.52],
    [0.2, 1.02, 0.65, 0.5],
  ];
  for (const [x, y, z, r] of baseOffsets) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 14), darkBaseMat);
    m.scale.set(1.25, 0.72, 1.45);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
  }

  // Towering convective middle & upper white lobes
  const towerOffsets: [number, number, number, number][] = [
    [-0.2, 1.75, 0.1, 0.66],
    [0.25, 1.9, -0.25, 0.6],
    [-0.1, 2.45, -0.1, 0.68],
    [0.15, 2.95, 0.2, 0.62],
    [-0.15, 3.35, -0.15, 0.58],
    // Anvil top (모루구름 상단)
    [0.35, 3.72, 0, 0.64],
    [0.95, 3.78, 0.15, 0.52],
    [-0.45, 3.68, -0.1, 0.48],
  ];
  for (const [x, y, z, r] of towerOffsets) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 14), cloudMat);
    m.scale.set(1.15, 0.85, 1.3);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
  }

  return group;
}

export function createLayeredStratusGroup(): THREE.Group {
  const group = new THREE.Group();
  const rainCloudMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.95,
    metalness: 0.0,
  });
  const midCloudMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.9,
    metalness: 0.0,
  });
  const highCloudMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.85,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
  });

  // Low Nimbostratus (난층운)
  for (let i = 0; i < 6; i++) {
    const x = 0.4 + i * 0.48;
    const z = (i % 2 === 0 ? 0.35 : -0.35);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), rainCloudMat);
    m.scale.set(1.45, 0.48, 2.1);
    m.position.set(x, 1.35 + i * 0.12, z);
    m.castShadow = true;
    group.add(m);
  }

  // Mid Altostratus (고층운)
  for (let i = 0; i < 5; i++) {
    const x = 2.1 + i * 0.52;
    const z = (i % 2 === 0 ? -0.3 : 0.3);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 12), midCloudMat);
    m.scale.set(1.5, 0.36, 2.0);
    m.position.set(x, 2.45 + i * 0.18, z);
    group.add(m);
  }

  // High Cirrus (권운)
  for (let i = 0; i < 4; i++) {
    const x = 3.8 + i * 0.55;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), highCloudMat);
    m.scale.set(1.8, 0.22, 1.9);
    m.position.set(x, 3.55 + i * 0.14, (i % 2 - 0.5) * 0.5);
    group.add(m);
  }

  return group;
}

/**
 * 지표면 전선(교선) 위 국제 표준 3D 전선 기호 빌더
 * 진행 방향: +X (정체전선의 경우 파란 삼각형은 +X, 빨간 반원은 -X)
 */
export function createGroundFrontSymbols(
  mode: 'cold' | 'warm' | 'stationary' | 'occluded'
): THREE.Group {
  const group = new THREE.Group();

  const colorMap = {
    cold: 0x1d4ed8,
    warm: 0xdc2626,
    stationary: 0x1d4ed8,
    occluded: 0x7c3aed,
  };

  // High-contrast white backing strip so symbols never blend into blue/red air masses or rain zones
  const backingStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.045, ATM_DEPTH - 0.14),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  backingStrip.position.y = 0.035;
  backingStrip.renderOrder = 10;
  group.add(backingStrip);

  const makeSymbolMat = (hex: number) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });

  const blueMat = makeSymbolMat(0x1d4ed8);
  const redMat = makeSymbolMat(0xdc2626);
  const purpleMat = makeSymbolMat(0x7c3aed);
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

  // Main front ground line(s)
  if (mode === 'stationary') {
    const segLen = (ATM_DEPTH - 0.2) / 6;
    for (let i = 0; i < 6; i++) {
      const zCenter = -(ATM_DEPTH - 0.2) / 2 + segLen * (i + 0.5);
      const segMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.075, segLen + 0.01),
        i % 2 === 0 ? blueMat : redMat
      );
      segMesh.position.set(0, 0.072, zCenter);
      segMesh.renderOrder = 11;
      group.add(segMesh);
    }
  } else {
    const lineMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.075, ATM_DEPTH - 0.18),
      makeSymbolMat(colorMap[mode])
    );
    lineMesh.position.y = 0.072;
    lineMesh.renderOrder = 11;
    group.add(lineMesh);
  }

  // Front cutaway edge marker sphere at z = +ATM_HALF_D so front view clearly shows intersection point
  const edgeMarkerMat =
    mode === 'cold' ? blueMat : mode === 'warm' ? redMat : mode === 'occluded' ? purpleMat : makeSymbolMat(0x4f46e5);
  const frontMarker = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), edgeMarkerMat);
  frontMarker.position.set(0, 0.11, ATM_HALF_D - 0.04);
  frontMarker.renderOrder = 13;
  group.add(frontMarker);

  // Larger, thicker Triangle shape pointing +X in XZ plane
  const triShape = new THREE.Shape();
  triShape.moveTo(0, -0.35);
  triShape.lineTo(0.58, 0);
  triShape.lineTo(0, 0.35);
  triShape.closePath();
  const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.085, bevelEnabled: false });
  triGeo.rotateX(-Math.PI / 2);

  // Crisp white outline backing behind triangle
  const triHaloShape = new THREE.Shape();
  triHaloShape.moveTo(-0.04, -0.43);
  triHaloShape.lineTo(0.68, 0);
  triHaloShape.lineTo(-0.04, 0.43);
  triHaloShape.closePath();
  const triHaloGeo = new THREE.ExtrudeGeometry(triHaloShape, { depth: 0.045, bevelEnabled: false });
  triHaloGeo.rotateX(-Math.PI / 2);

  // Larger, thicker Semicircle shape bulging +X in XZ plane
  const semiShape = new THREE.Shape();
  semiShape.absarc(0, 0, 0.37, -Math.PI / 2, Math.PI / 2, false);
  semiShape.closePath();
  const semiGeo = new THREE.ExtrudeGeometry(semiShape, { depth: 0.085, bevelEnabled: false });
  semiGeo.rotateX(-Math.PI / 2);

  const semiHaloShape = new THREE.Shape();
  semiHaloShape.absarc(0, 0, 0.45, -Math.PI / 2, Math.PI / 2, false);
  semiHaloShape.closePath();
  const semiHaloGeo = new THREE.ExtrudeGeometry(semiHaloShape, { depth: 0.045, bevelEnabled: false });
  semiHaloGeo.rotateX(-Math.PI / 2);

  const zPositions = [-2.15, -1.28, -0.42, 0.44, 1.30, 2.16];

  const addSymbol = (geo: THREE.BufferGeometry, haloGeo: THREE.BufferGeometry, mat: THREE.Material, x: number, z: number, rotY = 0) => {
    const halo = new THREE.Mesh(haloGeo, whiteMat);
    halo.rotation.y = rotY;
    halo.position.set(x, 0.028, z);
    halo.renderOrder = 11;
    group.add(halo);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = rotY;
    mesh.position.set(x, 0.048, z);
    mesh.renderOrder = 12;
    group.add(mesh);
  };

  zPositions.forEach((z, idx) => {
    if (mode === 'cold') {
      addSymbol(triGeo, triHaloGeo, blueMat, 0.06, z);
    } else if (mode === 'warm') {
      addSymbol(semiGeo, semiHaloGeo, redMat, 0.06, z);
    } else if (mode === 'stationary') {
      if (idx % 2 === 0) {
        addSymbol(triGeo, triHaloGeo, blueMat, 0.06, z, 0);
      } else {
        addSymbol(semiGeo, semiHaloGeo, redMat, -0.06, z, Math.PI);
      }
    } else {
      // occluded: purple triangle + semicircle alternating on SAME (+X) side
      if (idx % 2 === 0) {
        addSymbol(triGeo, triHaloGeo, purpleMat, 0.06, z);
      } else {
        addSymbol(semiGeo, semiHaloGeo, purpleMat, 0.06, z);
      }
    }
  });

  return group;
}

/**
 * InstancedMesh 빗방울 파티클 시스템
 */
export class RainSystem {
  public readonly instancedMesh: THREE.InstancedMesh;
  private readonly count: number;
  private readonly drops: { xOffset: number; y: number; z: number; speed: number }[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor(count = 160) {
    this.count = count;
    const geo = new THREE.CylinderGeometry(0.014, 0.014, 0.28, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.72,
    });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, count);
    this.instancedMesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      this.drops.push({
        xOffset: Math.random(), // 0..1 normalized within rain band
        y: Math.random() * 2.4,
        z: (Math.random() - 0.5) * (ATM_DEPTH - 0.6),
        speed: 3.2 + Math.random() * 2.0,
      });
    }
  }

  public update(
    dt: number,
    xMin: number,
    xMax: number,
    yTop: number,
    intensity = 1.0,
    visible = true
  ): void {
    this.instancedMesh.visible = visible && xMax - xMin > 0.1 && intensity > 0.05;
    if (!this.instancedMesh.visible) return;

    const activeCount = Math.floor(this.count * Math.min(1, intensity));
    for (let i = 0; i < this.count; i++) {
      if (i >= activeCount) {
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      const d = this.drops[i];
      d.y -= d.speed * dt;
      if (d.y < 0.05) {
        d.y = yTop * (0.75 + Math.random() * 0.25);
        d.xOffset = Math.random();
      }
      const x = xMin + (xMax - xMin) * d.xOffset;
      this.dummy.position.set(x, d.y, d.z);
      this.dummy.rotation.z = -0.1;
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }
}

/**
 * 3D 기류(공기 이동) 화살표 생성 헬퍼
 */
export function createFlowArrowMesh(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.22,
    roughness: 0.35,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10), mat);
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.x = -0.36;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 12), mat);
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.12;
  g.add(shaft, head);
  return g;
}
