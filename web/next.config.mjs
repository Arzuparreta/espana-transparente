/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/poder", destination: "/personas", permanent: true },
      { source: "/integridad", destination: "/personas", permanent: true },
      // Territorial consolidation: the standalone /ccaa and /municipios indexes
      // collapse into the single "Tu territorio" hub. Detail pages keep their
      // territory key under the unified /territorio/[scope]/[key] route.
      { source: "/ccaa", destination: "/territorio", permanent: true },
      { source: "/ccaa/:territory", destination: "/territorio/ccaa/:territory", permanent: true },
      { source: "/municipios", destination: "/territorio", permanent: true },
      { source: "/municipios/:territory", destination: "/territorio/municipio/:territory", permanent: true },
    ];
  },
};

export default nextConfig;
