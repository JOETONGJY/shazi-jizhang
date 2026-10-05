import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

export interface RingSpec {
  /** 0~1，超出按1截断 */
  pct: number;
  color: string;
  /** 底环色，一般给 22% 透明度 */
  bg: string;
}

/** Apple Fitness 风格同心活动圆环（外→内依次传入） */
export function ActivityRings({ rings, size = 112 }: { rings: RingSpec[]; size?: number }) {
  const stroke = Math.round(size * 0.095);
  return (
    <Svg width={size} height={size}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * stroke * 1.5;
        const c = 2 * Math.PI * radius;
        const p = Math.min(Math.max(r.pct, 0.03), 1);
        return (
          <G key={i}>
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={r.bg} strokeWidth={stroke} fill="none" />
            <G rotation="-90" originX={size / 2} originY={size / 2}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={r.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${c * p} ${c * (1 - p)}`}
                strokeLinecap="round"
              />
            </G>
          </G>
        );
      })}
    </Svg>
  );
}
