import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TourAPI 관광지 사진(한국관광공사 tong 서버) — next/image 최적화(리사이즈·webp·지연로딩) 허용
    remotePatterns: [
      {
        protocol: "http",
        hostname: "tong.visitkorea.or.kr",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
