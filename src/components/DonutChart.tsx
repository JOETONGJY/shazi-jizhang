import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useApp } from '../state/AppStore';

export interface Slice {
  value: number;
  color: string;
  label: string;
}

/** 环形图：外圈分片 + 中心文字 */
export function DonutChart({ slices, centerLabel, centerValue, centerLabelColor, centerValueColor, size = 168, stroke = 26 }: {
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
  centerLabelColor?: string;
  centerValueColor?: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  let acc = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation="-90" originX={size / 2} originY={size / 2}>
          {total > 0 && slices.map((s, i) => {
            const frac = s.value / total;
            const dash = c * frac;
            const el = (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(dash - 2, 0.5)} ${c - Math.max(dash - 2, 0.5)}`}
                strokeDashoffset={-c * acc}
                fill="none"
                strokeLinecap="butt"
              />
            );
            acc += frac;
            return el;
          })}
          {total === 0 && (
            <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
          )}
        </G>
      </Svg>
      <View style={st.center} pointerEvents="none">
        <Text style={[st.centerLabel, { color: centerLabelColor ?? '#8A93A0' }]}>{centerLabel}</Text>
        <Text style={[st.centerValue, { color: centerValueColor ?? '#1F2937' }]}>{centerValue}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerLabel: { fontSize: 11, color: '#8A93A0' },
  centerValue: { fontSize: 21, fontWeight: '800', color: '#1F2937', marginTop: 2 },
});
