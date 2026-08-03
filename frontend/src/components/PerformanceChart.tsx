"use client";

// 轻量绩效图表（纯 SVG，无第三方依赖）
// 仿 Centrifuge PoolPerformanceChart：折线 + 面积渐变 + 极值标注

interface Point {
  label: string;
  value: number;
}

interface Props {
  data: Point[];
  height?: number;
  color?: string;
  unit?: string;
}

export default function PerformanceChart({ data, height = 220, color = "#1677ff", unit = "%" }: Props) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 13 }}>
        暂无足够数据（至少需要 2 个时间点）
      </div>
    );
  }

  const W = 640;
  const H = height;
  const PAD = { top: 24, right: 24, bottom: 32, left: 48 };

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (data.length - 1);
  const y = (v: number) => PAD.top + ((max - v) / range) * (H - PAD.top - PAD.bottom);

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;

  const lastIdx = data.length - 1;
  const last = data[lastIdx];

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#999" }}>历史表现</span>
        <span style={{ fontSize: 14, fontWeight: 600, color }}>
          最新 {last.value}
          {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* 网格线 */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + f * (H - PAD.top - PAD.bottom)} y2={PAD.top + f * (H - PAD.top - PAD.bottom)} stroke="#f0f0f0" strokeDasharray="4 4" />
        ))}
        {/* 面积 + 折线 */}
        <path d={areaPath} fill="url(#perfFill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {/* 数据点 */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={i === lastIdx ? 4 : 2.5} fill={color} />
        ))}
        {/* X 轴标签 */}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 5) === 0 || i === lastIdx ? (
            <text key={i} x={x(i)} y={H - 8} fontSize={10} fill="#999" textAnchor="middle">
              {d.label}
            </text>
          ) : null
        )}
        {/* Y 轴极值 */}
        <text x={PAD.left - 6} y={y(max) + 4} fontSize={10} fill="#999" textAnchor="end">
          {max}
          {unit}
        </text>
        <text x={PAD.left - 6} y={y(min) + 4} fontSize={10} fill="#999" textAnchor="end">
          {min}
          {unit}
        </text>
      </svg>
    </div>
  );
}
