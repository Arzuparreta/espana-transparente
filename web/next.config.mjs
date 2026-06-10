/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/poder", destination: "/personas", permanent: true },
      { source: "/integridad", destination: "/personas", permanent: true },
      { source: "/asistencia", destination: "/diputados?view=asistencia", permanent: true },
      { source: "/divergencias", destination: "/diputados?view=divergencias", permanent: true },
      { source: "/dinero-publico", destination: "/dinero?view=trazabilidad", permanent: true },
      { source: "/ccaa", destination: "/territorio?view=autonomico", permanent: true },
      { source: "/municipios", destination: "/territorio?view=municipal", permanent: true },
    ];
  },
};

export default nextConfig;
