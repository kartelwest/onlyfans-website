import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/amplia/:path*",
        destination: "/admin/socialmediamodels/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
