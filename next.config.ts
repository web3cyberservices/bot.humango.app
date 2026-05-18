
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: [
    'pg', 
    'puppeteer', 
    'isomorphic-dompurify', 
    'jsdom',
    'html-encoding-sniffer',
    'whatwg-url',
    'parse5',
    'nwsapi',
    'xml-name-validator',
    'decimal.js',
    'entities',
    'abab',
    'data-urls',
    'domexception',
    'escodegen',
    'form-data',
    'iconv-lite',
    'saxes',
    'symbol-tree',
    'tough-cookie',
    'w3c-hr-time',
    'w3c-xmlserializer',
    'webidl-conversions',
    'whatwg-encoding',
    'whatwg-mimetype'
  ],
  experimental: {
    allowedDevOrigins: [
      '6000-firebase-studio-1777733792819.cluster-4cmpbiopffe5oqk7tloeb2ltrk.cloudworkstations.dev',
      'localhost:9002',
      'bot.humango.app'
    ]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/((?!_next|favicon.ico|logo.png).*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
