"use client";

import { useEffect, useState } from "react";
import { Carousel, Typography, Skeleton } from "antd";
import { api } from "@/lib/api";
import { useAppTheme } from "@/components/ThemeProvider";

const { Text } = Typography;

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
  enabled: boolean;
  sort_order: number;
}

/**
 * 广告横幅（Landing 展示位）
 * 数据来自管理后台配置（GET /api/ads?position=home_banner）
 * 有图片显示图片；无图片用品牌渐变背景 + 标题
 */
export default function AdBanner() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useAppTheme();
  const dark = theme.id === "dark";

  useEffect(() => {
    api
      .get<{ data: Ad[] }>("/ads?position=home_banner")
      .then((r) => setAds(r.data || []))
      .catch(() => setAds([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton active style={{ margin: "0 24px" }} />;
  if (!ads.length) return null;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 8px" }}>
      <Carousel autoplay autoplaySpeed={5000} dots>
        {ads.map((ad) => (
          <a
            key={ad.id}
            href={ad.link_url || undefined}
            target={ad.link_url ? "_blank" : undefined}
            rel="noopener noreferrer"
            style={{ display: "block", textDecoration: "none" }}
          >
            {ad.image_url ? (
              <img
                src={ad.image_url}
                alt={ad.title}
                style={{ width: "100%", borderRadius: 12, objectFit: "cover", maxHeight: 220 }}
              />
            ) : (
              <div
                style={{
                  height: 120,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: dark
                    ? "linear-gradient(90deg, rgba(26,171,155,.25), rgba(124,92,255,.25))"
                    : "linear-gradient(90deg, #F0FBF9, #E6F7F4)",
                  border: `1px solid ${dark ? "rgba(26,171,155,.3)" : "#D3EFEA"}`,
                }}
              >
                <Text strong style={{ fontSize: 20, color: dark ? "#E6E8EB" : "#141414" }}>
                  {ad.title}
                </Text>
              </div>
            )}
          </a>
        ))}
      </Carousel>
    </div>
  );
}
