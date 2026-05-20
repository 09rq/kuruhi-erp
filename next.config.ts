import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer はサーバーサイドでネイティブ依存を持つため外部パッケージ扱いにする
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
