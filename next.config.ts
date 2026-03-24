import type { NextConfig } from "next";
import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";

const nextConfig: NextConfig = {
  // Note: NOT using output: 'export' because dynamic routes (reader/[docId]) need SSR/client routing
  // Empty turbopack config so Next.js 16 doesn't error on the webpack config below.
  // The webpack config is still needed when building with --webpack for the
  // CopyWebpackPlugin that copies the pdfjs worker.
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Copy pdfjs-dist worker to public
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(
                require.resolve('pdfjs-dist/package.json'),
                '..',
                'build',
                'pdf.worker.min.mjs',
              ),
              to: path.join(__dirname, 'public', 'workers', 'pdf.worker.min.mjs'),
            },
          ],
        }),
      );
    }

    // Handle .node files (for some deps)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  // Headers for SharedArrayBuffer support (Tesseract.js)
  // Note: headers don't work with output: 'export', will use vercel.json instead
};

export default nextConfig;
