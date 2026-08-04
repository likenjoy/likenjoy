import { theme, type ThemeConfig } from "antd";

/**
 * 多主题系统（参考 Centrifuge Fabric / Uniswap / Maker / Geeker-Admin）
 * 切换只需在 TopBar 主题选择器选择，localStorage 持久化
 */

export interface LayoutColors {
  sidebarBg: string;
  sidebarText: string;
  sidebarSelected: string;
  menuTheme: "dark" | "light";
  topbarBg: string;
  contentBg: string;
  border: string;
  textPrimary: string;
}

export interface AppTheme {
  id: string;
  name: string;
  themeConfig: ThemeConfig;
  layoutColors: LayoutColors;
}

const fontStack =
  "Inter, -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif";

// ===== 风格 B：暗黑科技（Uniswap + Geeker-Admin 参考）=====
const themeB: AppTheme = {
  id: "dark",
  name: "暗色",
  themeConfig: {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: "#7C5CFF",
      colorInfo: "#7C5CFF",
      colorSuccess: "#16A34A",
      colorWarning: "#FFC012",
      colorError: "#E5484D",
      colorBgLayout: "#0F1115",
      colorBorderSecondary: "#262A33",
      borderRadius: 8,
      borderRadiusLG: 12,
      fontFamily: fontStack,
      fontSize: 14,
      controlHeight: 40,
      wireframe: false,
    },
    components: {
      Button: { borderRadius: 4, controlHeight: 40, primaryShadow: "0 2px 8px rgba(124,92,255,.35)" },
      Card: { borderRadiusLG: 8 },
      Table: { headerBg: "#1A1D24", headerColor: "#8A90A0", rowHoverBg: "#1A1D24" },
      Statistic: { contentFontSize: 28, titleFontSize: 13 },
      Steps: { iconSize: 28 },
      Tag: { borderRadiusSM: 4 },
    },
  },
  layoutColors: {
    sidebarBg: "linear-gradient(180deg, #0A0C10 0%, #131722 100%)",
    sidebarText: "rgba(255,255,255,.7)",
    sidebarSelected: "#7C5CFF",
    menuTheme: "dark",
    topbarBg: "#16181D",
    contentBg: "#0F1115",
    border: "#262A33",
    textPrimary: "#E6E8EB",
  },
};

// ===== 风格 C：绿白浅色（Maker 青绿 + Uniswap 白底参考）=====
const themeC: AppTheme = {
  id: "light",
  name: "绿白",
  themeConfig: {
    token: {
      colorPrimary: "#1AAB9B",
      colorInfo: "#1AAB9B",
      colorSuccess: "#16A34A",
      colorWarning: "#FFC012",
      colorError: "#E5484D",
      colorBgLayout: "#F7F9F9",
      colorBorderSecondary: "#E8ECEC",
      borderRadius: 8,
      borderRadiusLG: 12,
      fontFamily: fontStack,
      fontSize: 14,
      controlHeight: 40,
      wireframe: false,
    },
    components: {
      Button: { borderRadius: 4, controlHeight: 40, primaryShadow: "0 2px 8px rgba(26,171,155,.3)" },
      Card: { borderRadiusLG: 8 },
      Table: { headerBg: "#FAFBFB", headerColor: "#8A9099", rowHoverBg: "#F4F7F7" },
      Statistic: { contentFontSize: 28, titleFontSize: 13 },
      Steps: { iconSize: 28 },
      Tag: { borderRadiusSM: 4 },
    },
  },
  layoutColors: {
    sidebarBg: "#FFFFFF",
    sidebarText: "rgba(0,0,0,.65)",
    sidebarSelected: "#1AAB9B",
    menuTheme: "light",
    topbarBg: "#FFFFFF",
    contentBg: "#F7F9F9",
    border: "#E8ECEC",
    textPrimary: "#141414",
  },
};

export const THEMES: AppTheme[] = [themeC, themeB];
export const DEFAULT_THEME_ID = "light";

export const themeConfig = themeC.themeConfig;
export const layoutColors = themeC.layoutColors;
