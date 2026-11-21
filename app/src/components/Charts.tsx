import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Line, Polyline, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { T } from '../theme';

const PAD = { l: 34, r: 8, t: 10, b: 22 };

function useWidth() {
  const [w, setW] = useState(300);
  return { w, onLayout: (e: LayoutChangeEvent) => setW(Math.max(120, Math.round(e.nativeEvent.layout.width))) };
}

type Props = { values: number[]; labels: string[]; height?: number; color?: string; unit?: string; labelEvery?: number; floorZero?: boolean };

function scale(values: number[], floorZero?: boolean) {
  const lo = floorZero ? 0 : Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1) hi = lo + 1;
  return { lo, hi };
}

/** A small, dependency-free line chart. Accessible via a text summary on the wrapper. */
export function LineChart({ values, labels, height = 160, color = T.accent, unit = '', labelEvery = 6 }: Props) {
  const { w, onLayout } = useWidth();
  if (values.length < 2) return null;
  const { lo, hi } = scale(values);
  const iw = w - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / (values.length - 1)) * iw;
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const maxI = values.indexOf(Math.max(...values));
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`Chart from ${Math.round(lo)} to ${Math.round(hi)}${unit}`}>
      <Svg width={w} height={height}>
        {[0, 0.5, 1].map((f) => (
          <Line key={f} x1={PAD.l} x2={w - PAD.r} y1={PAD.t + ih * f} y2={PAD.t + ih * f} stroke={T.border} strokeWidth={1} />
        ))}
        <SvgText x={PAD.l - 6} y={PAD.t + 4} fontSize={10} fill={T.muted} textAnchor="end">{Math.round(hi)}{unit}</SvgText>
        <SvgText x={PAD.l - 6} y={PAD.t + ih + 4} fontSize={10} fill={T.muted} textAnchor="end">{Math.round(lo)}{unit}</SvgText>
        <Polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={x(maxI)} cy={y(values[maxI])} r={4} fill={color} />
        {labels.map((l, i) => (i % labelEvery === 0 ? <SvgText key={i} x={x(i)} y={height - 6} fontSize={10} fill={T.muted} textAnchor="middle">{l}</SvgText> : null))}
      </Svg>
    </View>
  );
}

export function BarChart({ values, labels, height = 160, color = T.primary, unit = '', labelEvery = 6, floorZero = true }: Props) {
  const { w, onLayout } = useWidth();
  if (!values.length) return null;
  const { hi } = scale(values, floorZero);
  const iw = w - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const bw = iw / values.length;
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`Bar chart, peak ${Math.round(hi * 10) / 10}${unit}`}>
      <Svg width={w} height={height}>
        <Line x1={PAD.l} x2={w - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke={T.border} strokeWidth={1} />
        <SvgText x={PAD.l - 6} y={PAD.t + 4} fontSize={10} fill={T.muted} textAnchor="end">{Math.round(hi * 10) / 10}{unit}</SvgText>
        <SvgText x={PAD.l - 6} y={PAD.t + ih + 4} fontSize={10} fill={T.muted} textAnchor="end">0</SvgText>
        {values.map((v, i) => {
          const h = (v / hi) * ih;
          return <Rect key={i} x={PAD.l + i * bw + 1} y={PAD.t + ih - h} width={Math.max(1, bw - 2)} height={Math.max(v > 0 ? 2 : 0, h)} rx={2} fill={color} />;
        })}
        {labels.map((l, i) => (i % labelEvery === 0 ? <SvgText key={i} x={PAD.l + i * bw + bw / 2} y={height - 6} fontSize={10} fill={T.muted} textAnchor="middle">{l}</SvgText> : null))}
      </Svg>
    </View>
  );
}
