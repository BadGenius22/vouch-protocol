/** @type {import('next').NextConfig} */

// Content Security Policy for XSS protection
// Allows: self, Solana RPC endpoints, verifier service, Sentry
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self'
    https://api.mainnet-beta.solana.com
    https://api.devnet.solana.com
    https://api.testnet.solana.com
    https://*.helius-rpc.com
    https://*.helius.xyz
    wss://*.helius-rpc.com
    wss://*.helius.xyz
    https://verifier.vouch.dev
    https://*.sentry.io
    https://aztec-ignition.s3.amazonaws.com
    https://*.privacycash.co
    https://privacycash.co
    https://*.radrlabs.io
    https://api.radr.fun
    https://*.radr.fun;
  worker-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

// Security headers following OWASP recommendations
// Note: COEP is set to 'credentialless' instead of 'require-corp' to allow
// @aztec/bb.js WASM loading while still enabling SharedArrayBuffer
const securityHeaders = [
  // COOP/COEP required for SharedArrayBuffer (Barretenberg multithreading)
  // Using 'credentialless' allows cross-origin WASM while still enabling SharedArrayBuffer
  {
    key: 'Cross-Origin-Embedder-Policy',
    value: 'credentialless',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  // CSP - Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  // Prevent MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Prevent clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // XSS protection (legacy browsers)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Control referrer information
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Enforce HTTPS
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Permissions Policy (disable unnecessary features)
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Externalize packages that use WASM/Workers (don't bundle in serverless)
    serverComponentsExternalPackages: [
      '@aztec/bb.js',
      '@noir-lang/noir_js',
      '@noir-lang/types',
    ],
  },

  // Security headers
  async headers() {
    // In development, use minimal headers to avoid WASM loading issues
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      return [
        {
          source: '/:path*',
          headers: [
            // Only COOP for SharedArrayBuffer, skip COEP to allow external fetches
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
          ],
        },
      ];
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Additional headers for API routes
      {
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
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
