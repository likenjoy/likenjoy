"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { THEMES, DEFAULT_THEME_ID, type AppTheme } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: AppTheme;
  setThemeId: (id: string) => void;
}>({ theme: THEMES[0], setThemeId: () => {} });

export const useAppTheme = () => useContext(ThemeContext);

const STORAGE_KEY = "rwa-theme";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some((t) => t.id === saved)) {
      setThemeId(saved);
    }
  }, []);

  const theme = useMemo(() => THEMES.find((t) => t.id === themeId) || THEMES[0], [themeId]);

  const setThemeIdAndSave = (id: string) => {
    setThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeId: setThemeIdAndSave }}>
      <ConfigProvider locale={zhCN} theme={theme.themeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
