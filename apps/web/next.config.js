/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // COOP/COEP headers required for SharedArrayBuffer (Barretenberg multithreading)
  // See: https://github.com/AztecProtocol/barretenberg/blob/master/ts/README.md
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Handle WASM files for Noir/Barretenberg
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        path: false,
        crypto: false,
        'pino-pretty': false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
