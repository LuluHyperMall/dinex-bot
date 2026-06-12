/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    unoptimized: true,
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    // Never cache the app HTML pages (so new deploys show immediately). Static
    // /_next/static assets keep their hashed immutable caching.
    const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }];
    return [
      { source: "/", headers: noStore },
      { source: "/bot/:path*", headers: noStore },
      { source: "/kitchen", headers: noStore },
      { source: "/admin", headers: noStore },
    ];
  },
};

export default nextConfig;
