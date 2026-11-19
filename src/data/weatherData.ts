export type FrontType = 'cold' | 'warm' | 'stationary' | 'occluded';

export type CycloneStageId = 'cyclogenesis' | 'mature' | 'occluded' | 'dissipation';

export interface FrontSummaryCardData {
  id: FrontType;
  name: string;
  engName: string;
  accentColor: string;
  mechanism: string;
  slope: string;
  speed: string;
  cloudType: string;
  rainZone: string;
  afterPassage: string;
  koreaExample?: string;
}

export const FRONT_DATA: Record<FrontType, FrontSummaryCardData> = {
  cold: {
    id: 'cold',
    name: '한랭전선',
    engName: 'Cold Front',
    accentColor: '#1D4ED8',
    mechanism:
      '밀도가 크고 무거운 찬 공기가 따뜻한 공기 아래로 빠르게 파고들며 따뜻한 공기를 강하게 위로 밀어 올려 형성됩니다.',
    slope: '급함 (약 1 : 50 ~ 1 : 100)',
    speed: '빠름 (약 30 ~ 50 km/h)',
    cloudType: '적운형 구름 (적운, 적란운)',
    rainZone: '전선 뒤쪽 좁은 구역에 강한 소나기',
    afterPassage: '기온 하강 · 기압 상승 · 풍향 시계 방향 변화 (남서풍 → 북서풍)',
  },
  warm: {
    id: 'warm',
    name: '온난전선',
    engName: 'Warm Front',
    accentColor: '#DC2626',
    mechanism:
      '밀도가 작은 따뜻한 공기가 무거운 찬 공기 덩어리 위로 완만하게 타고 올라가며 넓은 구름대를 형성합니다.',
    slope: '완만함 (약 1 : 150 ~ 1 : 300)',
    speed: '느림 (약 20 ~ 30 km/h)',
    cloudType: '층운형 구름 (권운 → 고층운 → 난층운)',
    rainZone: '전선 앞쪽 넓은 구역에 지속적인 이슬비·비',
    afterPassage: '기온 상승 · 기압 하강 · 풍향 시계 방향 변화 (남동풍 → 남서풍)',
  },
  stationary: {
    id: 'stationary',
    name: '정체전선',
    engName: 'Stationary Front',
    accentColor: '#4F46E5',
    mechanism:
      '세력이 비슷한 찬 기단과 따뜻한 기단이 마주 보며 힘겨루기를 하여 한곳에 오래 머무르며 형성됩니다.',
    slope: '완만~중간 (대치 상태 유지)',
    speed: '거의 정체 (제자리에서 진동)',
    cloudType: '층운형 및 적운형 혼합 (난층운·적란운)',
    rainZone: '전선 부근 남북으로 좁고 동서로 긴 구역에 많은 비',
    afterPassage: '전선이 머무르는 동안 흐리고 장기간 비 · 한반도 여름철 장마전선',
    koreaExample: '우리나라 초여름 북태평양 기단(고온다습)과 오호츠크해 기단(한랭다습)이 만나 형성되는 장마전선이 대표적입니다.',
  },
  occluded: {
    id: 'occluded',
    name: '폐색전선',
    engName: 'Occluded Front',
    accentColor: '#7C3AED',
    mechanism:
      '이동 속도가 빠른 한랭전선이 앞선 온난전선을 따라잡아 겹쳐지면서, 지표면의 따뜻한 공기가 상층으로 완전히 들려 올라가 형성됩니다.',
    slope: '복합 경사 (따뜻한 공기가 상층으로 분리)',
    speed: '점차 느려지다 소멸 단계로 진입',
    cloudType: '층운형·적란운 혼합 (두꺼운 구름층)',
    rainZone: '전선 부근 넓은 구역에 비 (강수 후 점차 약화)',
    afterPassage: '지표면은 찬 공기로 덮이고 온대 저기압이 에너지원을 잃어 소멸',
  },
};

export interface CycloneStageInfo {
  id: CycloneStageId;
  stepNumber: number;
  title: string;
  range: [number, number];
  centralPressure: string;
  movement: string;
  structure: string;
  weatherSummary: string;
  energyNote: string;
}

export const CYCLONE_STAGES: CycloneStageInfo[] = [
  {
    id: 'cyclogenesis',
    stepNumber: 1,
    title: '1단계 · 발생기',
    range: [0, 0.25],
    centralPressure: '약 1008 hPa (미약한 저압부)',
    movement: '정체전선 상에서 반시계 방향 파동 발생',
    structure: '찬 기단과 따뜻한 기단이 대치하던 정체전선에 파동이 생기며 저기압 중심(L)이 형성됩니다.',
    weatherSummary: '저기압 중심 부근에 구름이 모이기 시작하며 찬 공기는 남하, 따뜻한 공기는 북상하기 시작합니다.',
    energyNote: '서쪽의 찬 공기와 동쪽/남쪽의 따뜻한 공기 사이에 위치 에너지 축적 시작',
  },
  {
    id: 'mature',
    stepNumber: 2,
    title: '2단계 · 성숙기 (발달기)',
    range: [0.25, 0.56],
    centralPressure: '약 996 hPa (가장 강하게 발달)',
    movement: '편서풍을 타고 서 → 동쪽으로 활발히 이동',
    structure: '뚜렷한 한랭전선(서)과 온난전선(동)이 발달하고, 그 사이에 따뜻한 공기 구역(온난역)이 넓게 자리잡습니다.',
    weatherSummary: '한랭전선 뒤(북서풍·소나기), 온난역(남서풍·맑고 온난), 온난전선 앞(남동풍·지속적 비)으로 날씨가 극명하게 나뉩니다.',
    energyNote: '찬 공기는 하강하고 따뜻한 공기는 상승하며 위치 에너지가 운동 에너지로 활발히 전환',
  },
  {
    id: 'occluded',
    stepNumber: 3,
    title: '3단계 · 폐색기',
    range: [0.56, 0.83],
    centralPressure: '약 1000 hPa (상승 전환 시작)',
    movement: '이동 속도 점차 둔화 (동쪽 이동 지속)',
    structure: '이동 속도가 빠른 한랭전선이 앞선 온난전선을 저기압 중심 부근부터 따라잡아 보라색 폐색전선을 형성합니다.',
    weatherSummary: '폐색전선 부근에 두꺼운 구름과 비가 집중되며, 지표면의 따뜻한 공기 구역이 점차 좁아지며 상층으로 들립니다.',
    energyNote: '찬 공기가 지표면을 파고들며 따뜻한 공기가 위로 밀려나 기압 경도가 약화되기 시작',
  },
  {
    id: 'dissipation',
    stepNumber: 4,
    title: '4단계 · 소멸기',
    range: [0.83, 1.0],
    centralPressure: '약 1008 hPa 이상 (저기압 소멸)',
    movement: '정체 후 소멸',
    structure: '찬 공기가 지표면 전체를 덮고 따뜻한 공기가 상층으로 완전히 올라가 전선 구조가 해소됩니다.',
    weatherSummary: '구름과 비가 점차 약해지며 흩어지고, 지표면 전체가 성질이 비슷한 찬 공기로 채워져 안정화됩니다.',
    energyNote: '기온 차이에 의한 위치 에너지원을 모두 소진하여 온대 저기압의 일생 종료',
  },
];

export function getStageFromProgress(progress: number): CycloneStageInfo {
  if (progress < 0.25) return CYCLONE_STAGES[0];
  if (progress < 0.56) return CYCLONE_STAGES[1];
  if (progress < 0.83) return CYCLONE_STAGES[2];
  return CYCLONE_STAGES[3];
}
