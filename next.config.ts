import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/upload",
        destination: "/imports",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
