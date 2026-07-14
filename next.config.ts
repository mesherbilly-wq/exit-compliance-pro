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
        destination: "/executive-reports",
        permanent: true,
      },
      {
        source: "/reports/exit-compliance",
        destination: "/executive-reports",
        permanent: true,
      },
      {
        source: "/reports/:path*",
        destination: "/executive-reports",
        permanent: true,
      },
      {
        source: "/compliance",
        destination: "/",
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
