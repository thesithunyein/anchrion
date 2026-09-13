import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * The landing page is served as a static file from public/index.html, which
   * Next.js exposes at /index.html but not at the site root. This rewrite makes
   * `npm run dev` and a self-hosted production build behave the way the
   * deployed site does, so a reviewer who clones the repo sees the landing page
   * at http://localhost:3000/ instead of a 404.
   */
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        // Static pages in public/ need their index resolving explicitly: Next
        // serves public files by exact path and will not resolve a folder's.
        // The root serves the Chestly design; the Anchrion project page moved
        // to /anchrion, and /chestly stays as an alias so shared links hold.
        { source: '/', destination: '/chestly/index.html' },
        { source: '/chestly', destination: '/chestly/index.html' },
        { source: '/chestly/', destination: '/chestly/index.html' },
        { source: '/anchrion', destination: '/index.html' },
        { source: '/anchrion/', destination: '/index.html' },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
