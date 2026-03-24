import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist worker is copied to public/workers/ by the prebuild script in package.json
  // COOP/COEP headers for SharedArrayBuffer are set in vercel.json
};

export default nextConfig;
