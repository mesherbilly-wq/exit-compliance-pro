import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/upload",
        destination: "/imports/upload",
        permanent: true,
      },
      {
        source: "/reports",
        destination: "/compliance",
        permanent: true,
      },
      {
        source: "/reports/exit-compliance",
        destination: "/compliance",
        permanent: true,
      },
      {
        source: "/reports/:path*",
        destination: "/compliance",
        permanent: true,
      },
      {
        source: "/customers",
        destination: "/",
        permanent: true,
      },
      {
        source: "/sites",
        destination: "/doors",
        permanent: true,
      },
      {
        source: "/scheduled",
        destination: "/executive-reports",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
