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

// ===== 风格 A：金融蓝（Centrifuge 参考）=====
const themeA: AppTheme = {
  id: "a",
  name: "金融蓝",
  themeConfig: {
    token: {
      colorPrimary: "#2762FF",
      colorInfo: "#2762FF",
      colorSuccess: "#16A34A",
      colorWarning: "#FFC012",
      colorError: "#E5484D",
      colorBgLayout: "#F2F4F7",
      colorBorderSecondary: "#E7E7E7",
      borderRadius: 8,
      borderRadiusLG: 12,
      fontFamily: fontStack,
      fontSize: 14,
      controlHeight: 40,
      wireframe: false,
    },
    components: {
      Button: { borderRadius: 4, controlHeight: 40, primaryShadow: "0 2px 6px rgba(39,98,255,.35)" },
      Card: { borderRadiusLG: 8 },
      Table: { headerBg: "#F6F6F6", headerColor: "#667085", rowHoverBg: "#F2F4F7" },
      Statistic: { contentFontSize: 28, titleFontSize: 13 },
      Steps: { iconSize: 28 },
      Tag: { borderRadiusSM: 4 },
    },
  },
  layoutColors: {
    sidebarBg: "linear-gradient(180deg, #00243C 0%, #0B3B5C 100%)",
    sidebarText: "rgba(255,255,255,.75)",
    sidebarSelected: "#2762FF",
    menuTheme: "dark",
    topbarBg: "#FFFFFF",
    contentBg: "#F2F4F7",
    border: "#E7E7E7",
    textPrimary: "#252B34",
  },
};

// ===== 风格 B：暗黑科技（Uniswap + Geeker-Admin 参考）=====
const themeB: AppTheme = {
  id: "b",
  name: "暗黑科技",
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

// ===== 风格 C：浅色极简（Maker 青绿 + Uniswap 白底参考）=====
const themeC: AppTheme = {
  id: "c",
  name: "浅色极简",
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

export const THEMES: AppTheme[] = [themeA, themeB, themeC];
export const DEFAULT_THEME_ID = "a";

export const themeConfig = themeA.themeConfig;
export const layoutColors = themeA.layoutColors;
