"use client";

// 资产价格历史曲线（echarts：面积渐变 + tooltip + 缩放）
// 参考 Centrifuge PoolPerformanceChart / RealT 净值曲线
import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Empty } from "antd";

export interface PricePoint {
  date: string;
  price: number;
}

interface Props {
  data: PricePoint[];
  height?: number;
  color?: string;
}

export default function PriceHistoryChart({ data, height = 280, color = "#1AAB9B" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!data || data.length < 2) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      grid: { left: 64, right: 20, top: 40, bottom: 32 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(20,20,20,.85)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        valueFormatter: (v: number) => `$${Number(v).toLocaleString()}`,
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#E8ECEC" } },
        axisLabel: { color: "#8A9099", fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        splitLine: { lineStyle: { color: "#F0F3F3", type: "dashed" } },
        axisLabel: { color: "#8A9099", fontSize: 11, formatter: (v: number) => `$${Number(v).toLocaleString()}` },
      },
      series: [
        {
          name: "净值",
          type: "line",
          data: data.map((d) => d.price),
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2.5, color },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(26,171,155,.25)" },
                { offset: 1, color: "rgba(26,171,155,0)" },
              ],
            },
          },
        },
      ],
      animationDuration: 600,
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data, color]);

  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty description="暂无价格历史数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return <div ref={ref} style={{ width: "100%", height }} />;
}