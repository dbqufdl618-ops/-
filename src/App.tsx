import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pause, Play, RotateCcw } from 'lucide-react';
import { FrontSymbolSvg } from './components/FrontSymbolSvg';
import { Front3DViewport } from './components/Front3DViewport';
import { CycloneMapCanvas } from './components/CycloneMapCanvas';
import { CycloneCross3DViewport } from './components/CycloneCross3DViewport';
import {
  CYCLONE_STAGES,
  FRONT_DATA,
  FrontType,
  getStageFromProgress,
} from './data/weatherData';
import { computeCycloneState } from './utils/cycloneModel';

type MainTab = 'fronts' | 'cyclone';

const FRONT_ORDER: FrontType[] = ['cold', 'warm', 'stationary', 'occluded'];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('fronts');
  const [showLabels, setShowLabels] = useState<boolean>(true);

  // Tab 1 state (4 Fronts)
  const [selectedFront, setSelectedFront] = useState<FrontType>('cold');
  const [frontProgress, setFrontProgress] = useState<number>(0.45);
  const [frontPlaying, setFrontPlaying] = useState<boolean>(true);

  // Tab 2 state (Cyclone Lifecycle)
  const [cycloneProgress, setCycloneProgress] = useState<number>(0.42);
  const [cyclonePlaying, setCyclonePlaying] = useState<boolean>(false);
  const [cutOffset, setCutOffset] = useState<number>(0.36);

  // Playback loop for Tab 1
  useEffect(() => {
    if (activeTab !== 'fronts' || !frontPlaying) return;
    let lastTime = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      setFrontProgress((prev) => {
        const speed = selectedFront === 'stationary' ? 0.14 : 0.11;
        const next = prev + dt * speed;
        return next > 1 ? 0 : next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [activeTab, frontPlaying, selectedFront]);

  // Playback loop for Tab 2
  useEffect(() => {
    if (activeTab !== 'cyclone' || !cyclonePlaying) return;
    let lastTime = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      setCycloneProgress((prev) => {
        const next = prev + dt * 0.065;
        return next > 1 ? 0 : next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [activeTab, cyclonePlaying]);

  const handleSelectFront = (type: FrontType) => {
    setSelectedFront(type);
    setFrontProgress(type === 'occluded' ? 0.48 : 0.35);
    setFrontPlaying(true);
  };

  const frontInfo = FRONT_DATA[selectedFront];
  const cycloneSync = useMemo(
    () => computeCycloneState(cycloneProgress, cutOffset),
    [cycloneProgress, cutOffset]
  );
  const currentStage = useMemo(
    () => getStageFromProgress(cycloneProgress),
    [cycloneProgress]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation Bar (3-zone contract) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Zone 1: Single-line Title */}
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            전선과 온대 저기압 3D 실험실
          </h1>

          {/* Zone 2: Main 2 Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200" aria-label="주 학습 메뉴">
            <button
              type="button"
              onClick={() => setActiveTab('fronts')}
              className={`px-3.5 py-2 text-sm font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'fronts'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
              }`}
            >
              1. 4가지 전선 입체 비교
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cyclone')}
              className={`px-3.5 py-2 text-sm font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'cyclone'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
              }`}
            >
              2. 온대 저기압의 일생
            </button>
          </nav>

          {/* Zone 3: Global Classroom Quiz Label Toggle */}
          <button
            type="button"
            onClick={() => setShowLabels((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showLabels
                ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                : 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
            }`}
          >
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showLabels ? '라벨 켜기/끄기' : '퀴즈 모드 (라벨 숨김)'}
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {activeTab === 'fronts' ? (
          <>
            {/* Sub-Buttons for 4 Front Types */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="전선 종류 선택">
              {FRONT_ORDER.map((type) => {
                const item = FRONT_DATA[type];
                const active = selectedFront === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectFront(type)}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-white border-slate-900 ring-2 ring-slate-900/15 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-base sm:text-lg font-extrabold text-slate-900 whitespace-nowrap">
                        {item.name}
                      </div>
                      <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {item.engName}
                      </div>
                    </div>
                    <FrontSymbolSvg type={type} width={74} height={24} className="shrink-0" />
                  </button>
                );
              })}
            </section>

            {/* Primary 3D Viewport */}
            <Front3DViewport
              frontType={selectedFront}
              progress={frontProgress}
              isPlaying={frontPlaying}
              showLabels={showLabels}
              onTogglePlay={() => setFrontPlaying((p) => !p)}
              onProgressChange={(val) => {
                setFrontPlaying(false);
                setFrontProgress(val);
              }}
              onReset={() => {
                setFrontPlaying(false);
                setFrontProgress(0);
              }}
              onToggleLabels={() => setShowLabels((prev) => !prev)}
            />

            {/* Bottom Summary Info Card for Selected Front */}
            <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold text-slate-900">{frontInfo.name} 핵심 정리</h2>
                    <FrontSymbolSvg type={selectedFront} width={84} height={22} />
                  </div>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {frontInfo.mechanism}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">전선면 기울기</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">{frontInfo.slope}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">이동 속도</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">{frontInfo.speed}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">구름 종류</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">{frontInfo.cloudType}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">강수 형태 및 구역</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">{frontInfo.rainZone}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">통과 후 변화</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">{frontInfo.afterPassage}</div>
                </div>
              </div>

              {frontInfo.koreaExample && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg px-4 py-3 text-sm sm:text-base text-indigo-950 font-medium">
                  한반도 사례 · {frontInfo.koreaExample}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {/* Tab 2: Stage Controls & Timeline Slider */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {CYCLONE_STAGES.map((stage) => {
                  const isCurrent = currentStage.id === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => {
                        setCyclonePlaying(false);
                        const mid = (stage.range[0] + stage.range[1]) / 2;
                        setCycloneProgress(stage.id === 'cyclogenesis' ? 0.12 : mid);
                      }}
                      className={`px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-extrabold whitespace-nowrap">{stage.title}</div>
                      <div className={`text-xs truncate ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                        {stage.centralPressure}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCyclonePlaying((p) => !p)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {cyclonePlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {cyclonePlaying ? '일시정지' : '일생 자동 재생'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCyclonePlaying(false);
                    setCycloneProgress(0.05);
                  }}
                  className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  aria-label="발생기 처음으로"
                  title="발생기 처음으로"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-[200px] flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap shrink-0">진행률</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.004}
                    value={cycloneProgress}
                    onChange={(e) => {
                      setCyclonePlaying(false);
                      setCycloneProgress(parseFloat(e.target.value));
                    }}
                    className="sim-slider w-full"
                    aria-label="온대 저기압 일생 시간 슬라이더"
                  />
                  <span className="font-mono-num text-sm font-bold text-slate-900 w-12 text-right shrink-0">
                    {Math.round(cycloneProgress * 100)}%
                  </span>
                </div>
              </div>
            </section>

            {/* Synchronized Dual Split View: Left Weather Map + Right 3D A-A' Cross-Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <CycloneMapCanvas
                syncState={cycloneSync}
                showLabels={showLabels}
                cutOffset={cutOffset}
                onCutOffsetChange={setCutOffset}
              />
              <CycloneCross3DViewport
                syncState={cycloneSync}
                showLabels={showLabels}
              />
            </section>

            {/* Stage Summary Card & Front Legend */}
            <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {currentStage.title} 핵심 정리
                  </h2>
                  <p className="text-sm sm:text-base text-slate-700 mt-1">
                    {currentStage.structure}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <FrontSymbolSvg type="cold" width={46} height={16} /> 한랭전선
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FrontSymbolSvg type="warm" width={46} height={16} /> 온난전선
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FrontSymbolSvg type="occluded" width={46} height={16} /> 폐색전선
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">중심 기압</div>
                  <div className="font-mono-num text-sm sm:text-base font-bold text-slate-900">
                    {cycloneSync.pressureHpa} hPa · {currentStage.centralPressure}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">이동 방향 및 속도</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">
                    {currentStage.movement}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">구역별 날씨 특징</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">
                    {currentStage.weatherSummary}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-500 mb-1">에너지 변화 원리</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900">
                    {currentStage.energyNote}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
