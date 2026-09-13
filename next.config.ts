import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * The project landing page and an unrelated design study are both static files
   * in public/, served alongside the Next.js app.
   *
   * Two things make this less obvious than it looks:
   *   1. Next serves public files by exact path and will not resolve a folder's
   *      index, so /chestly needs the rewrite below to reach its index.html.
   *   2. Vercel serves public/index.html at / automatically, and that beats any
   *      Next rewrite. That is why the landing page here is public/anchrion.html
   *      with the root mapped explicitly in beforeFiles (which runs ahead of
   *      filesystem routes) — and why there is no public/index.html to compete
   *      with it. Renaming the landing back to index.html would make the root
   *      rule dead code and hand the root back to the platform.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/anchrion.html' },
      ],
      afterFiles: [
        // Kept so links shared while the study was at the root still resolve.
        { source: '/anchrion', destination: '/anchrion.html' },
        { source: '/anchrion/', destination: '/anchrion.html' },
        { source: '/index.html', destination: '/anchrion.html' },
        { source: '/chestly', destination: '/chestly/index.html' },
        { source: '/chestly/', destination: '/chestly/index.html' },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
