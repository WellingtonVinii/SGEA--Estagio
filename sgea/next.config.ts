import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://localhost:5001";
    return [
      { source: "/api/autenticacao/:path*", destination: `${backend}/autenticacao/:path*` },
      { source: "/api/categorias/:path*", destination: `${backend}/categorias/:path*` },
      { source: "/api/produtos/:path*", destination: `${backend}/produtos/:path*` },
      { source: "/api/funcionarios/:path*", destination: `${backend}/funcionarios/:path*` },
      { source: "/api/usuarios/:path*", destination: `${backend}/usuarios/:path*` },
      { source: "/api/pedidos/:path*", destination: `${backend}/pedidos/:path*` },
      { source: "/api/entradas/:path*", destination: `${backend}/entradas/:path*` },
      { source: "/api/saidas/:path*", destination: `${backend}/saidas/:path*` },
      { source: "/api/ajustes/:path*", destination: `${backend}/ajustes/:path*` },
      { source: "/api/estoque/:path*", destination: `${backend}/estoque/:path*` },
      { source: "/api/historico/:path*", destination: `${backend}/historico/:path*` },
    ];
  },
};

export default nextConfig;
