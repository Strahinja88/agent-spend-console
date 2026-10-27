import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // e2e builds into its own folder so it can't clash with a running dev server (D-022)
  distDir: process.env.NEXT_DIST_DIR || ".next",
}

export default nextConfig
