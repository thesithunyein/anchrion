import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Both landing pages are static files in public/.
   *
   * Two things make this less obvious than it looks:
   *   1. Next serves public files by exact path and will not resolve a folder's
   *      index, so /chestly needs the rewrite below to reach its index.html.
   *   2. Vercel serves public/index.html at / automatically, and that wins over
   *      any Next rewrite. So there is deliberately no public/index.html: the
   *      root rule lives in beforeFiles (which runs ahead of filesystem routes)
   *      and has nothing left to compete with.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/chestly/index.html' },
      ],
      afterFiles: [
        // /chestly stays as an alias so links already shared keep working.
        { source: '/chestly', destination: '/chestly/index.html' },
        { source: '/chestly/', destination: '/chestly/index.html' },
        { source: '/anchrion', destination: '/anchrion.html' },
        { source: '/anchrion/', destination: '/anchrion.html' },
        // The old root path, so any link to /index.html still lands somewhere.
        { source: '/index.html', destination: '/anchrion.html' },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
