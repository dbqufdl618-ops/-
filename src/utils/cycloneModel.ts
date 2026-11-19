export interface CycloneSyncState {
  progress: number;
  stageIndex: 0 | 1 | 2 | 3;
  // Normalized map coordinates in [-1, 1] space
  centerX: number;
  centerY: number;
  pressureHpa: number;
  // Cut line Y in normalized [-1, 1] space (positive = south of center)
  cutY: number;
  // Front positions along the A-A' cut line in normalized [-1, 1] X space (relative to cut view)
  // Plus local cutaway coordinates in [-7.2, +7.2] Three.js X space
  coldXNorm: number;
  warmXNorm: number;
  isOccludedAtCut: boolean;
  occlusionZipY: number; // Y coordinate down to which occlusion has zipped from centerY
  occlusionAmount: number; // 0 = separate, 0..1 = lifting aloft
  dissipationAmount: number; // 0 = active, 0..1 = dissipating
  waveAmplitude: number; // 0..1 wave growth in cyclogenesis
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * 온대 저기압의 일생(0..1)에 따른 일기도 및 A-A' 단면도 동기화 상태 계산
 * cutOffset: 0.24 (중심 부근) ~ 0.42 (남쪽 통과, 기본값 0.36)
 */
export function computeCycloneState(progress: number, cutOffset = 0.36): CycloneSyncState {
  const p = clamp(progress, 0, 1);

  let stageIndex: 0 | 1 | 2 | 3 = 0;
  if (p >= 0.83) stageIndex = 3;
  else if (p >= 0.56) stageIndex = 2;
  else if (p >= 0.25) stageIndex = 1;

  // Low pressure center moves steadily West -> East via Westerlies (편서풍)
  const centerX = -0.34 + p * 0.64;
  const centerY = -0.14 - Math.sin(p * Math.PI) * 0.04;

  // Central pressure evolution (1008 -> 996 -> 1009 hPa)
  let pressureHpa = 1008;
  if (p < 0.52) {
    pressureHpa = 1008 - 12 * smoothstep(0.0, 0.5, p);
  } else {
    pressureHpa = 996 + 13 * smoothstep(0.55, 1.0, p);
  }

  const cutY = centerY + cutOffset;
  const waveAmplitude = smoothstep(0.0, 0.28, p);

  // Occlusion zipper starts at L (p = 0.52) and moves southward past cutY by p ~ 0.72
  const occZipProgress = smoothstep(0.52, 0.84, p);
  const maxArmLen = 0.56;
  const occlusionZipY = centerY + occZipProgress * maxArmLen;

  // Warm front slope dx/dy from center (gentle E/SE tilt)
  // Cold front slope dx/dy from center (sweeps faster eastward!)
  const warmTilt = 0.62 - 0.12 * smoothstep(0.25, 0.7, p);
  const coldTilt = -0.78 + 1.28 * smoothstep(0.15, 0.76, p); // sweeps from -0.78 toward +0.50!

  const dy = cutY - centerY;
  // Raw X positions on the A-A' line
  const rawWarmX = centerX + 0.05 + dy * warmTilt;
  const rawColdX = centerX - 0.05 + dy * coldTilt;

  const isOccludedAtCut = rawColdX >= rawWarmX - 0.015 || occlusionZipY >= cutY;
  const coldXNorm = Math.min(rawColdX, rawWarmX);
  const warmXNorm = Math.max(rawWarmX, rawColdX);

  const occlusionAmount = isOccludedAtCut
    ? smoothstep(0.56, 0.86, p)
    : 0;

  const dissipationAmount = smoothstep(0.80, 1.0, p);

  return {
    progress: p,
    stageIndex,
    centerX,
    centerY,
    pressureHpa: Math.round(pressureHpa),
    cutY,
    coldXNorm,
    warmXNorm,
    isOccludedAtCut,
    occlusionZipY,
    occlusionAmount,
    dissipationAmount,
    waveAmplitude,
  };
}
