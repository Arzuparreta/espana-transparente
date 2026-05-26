/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/poder", destination: "/personas", permanent: true },
      { source: "/integridad", destination: "/personas", permanent: true },
      { source: "/ccaa", destination: "/territorio", permanent: true },
    ];
  },
};

export default nextConfig;
