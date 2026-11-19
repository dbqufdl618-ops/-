import React from 'react';
import { FrontType } from '../data/weatherData';

interface FrontSymbolSvgProps {
  type: FrontType;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * 국제 표준 지상 일기도 전선 기호 SVG 렌더러
 * - 진행 방향이 오른쪽(또는 위쪽)일 때의 정확한 기하 배치
 */
export const FrontSymbolSvg: React.FC<FrontSymbolSvgProps> = ({
  type,
  width = 88,
  height = 24,
  className = '',
}) => {
  const cy = height / 2;

  if (type === 'cold') {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-label="한랭전선 기호">
        <line x1="2" y1={cy + 3} x2={width - 2} y2={cy + 3} stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" />
        {[14, 42, 70].map((cx) => (
          <polygon
            key={cx}
            points={`${cx - 7},${cy + 3} ${cx + 7},${cy + 3} ${cx},${cy - 8}`}
            fill="#1D4ED8"
          />
        ))}
      </svg>
    );
  }

  if (type === 'warm') {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-label="온난전선 기호">
        <line x1="2" y1={cy + 3} x2={width - 2} y2={cy + 3} stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
        {[16, 44, 72].map((cx) => (
          <path
            key={cx}
            d={`M ${cx - 7},${cy + 3} A 7,7 0 0,1 ${cx + 7},${cy + 3} Z`}
            fill="#DC2626"
          />
        ))}
      </svg>
    );
  }

  if (type === 'stationary') {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-label="정체전선 기호">
        <line x1="2" y1={cy} x2={width / 2} y2={cy} stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" />
        <line x1={width / 2} y1={cy} x2={width - 2} y2={cy} stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
        {/* 파란 삼각형 위쪽(따뜻한 공기 방향) */}
        {[16, 60].map((cx) => (
          <polygon
            key={`t-${cx}`}
            points={`${cx - 6.5},${cy} ${cx + 6.5},${cy} ${cx},${cy - 9}`}
            fill="#1D4ED8"
          />
        ))}
        {/* 빨간 반원 아래쪽(찬 공기 방향) */}
        {[38, 76].map((cx) => (
          <path
            key={`s-${cx}`}
            d={`M ${cx - 6.5},${cy} A 6.5,6.5 0 0,0 ${cx + 6.5},${cy} Z`}
            fill="#DC2626"
          />
        ))}
      </svg>
    );
  }

  // occluded
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-label="폐색전선 기호">
      <line x1="2" y1={cy + 3} x2={width - 2} y2={cy + 3} stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" />
      <polygon points={`10,${cy + 3} 23,${cy + 3} 16.5,${cy - 8}`} fill="#7C3AED" />
      <path d={`M 30,${cy + 3} A 6.5,6.5 0 0,1 43,${cy + 3} Z`} fill="#7C3AED" />
      <polygon points={`50,${cy + 3} 63,${cy + 3} 56.5,${cy - 8}`} fill="#7C3AED" />
      <path d={`M 70,${cy + 3} A 6.5,6.5 0 0,1 83,${cy + 3} Z`} fill="#7C3AED" />
    </svg>
  );
};
