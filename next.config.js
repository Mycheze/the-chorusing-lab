/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable strict mode to prevent audio component double-initialization
  reactStrictMode: false,

  // Optimize for audio-heavy applications
  experimental: {
    // Enable server actions for file uploads
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        process.env.NEXT_PUBLIC_VERCEL_URL
          ? process.env.NEXT_PUBLIC_VERCEL_URL
          : null,
      ].filter(Boolean),
      bodySizeLimit: "50mb",
    },
    // Packages that should not be bundled (for server-side)
    serverComponentsExternalPackages: ["youtube-dl-exec"],
  },

  // Audio file handling
  webpack: (config, { dev, isServer }) => {
    // Handle audio files in webpack
    config.module.rules.push({
      test: /\.(mp3|wav|ogg|m4a|webm)$/i,
      type: "asset/resource",
      generator: {
        filename: "static/audio/[name].[hash][ext]",
      },
    });

    // Exclude problematic packages from bundling (server-side only)
    // These packages use modern JS features (private class fields) that webpack can't parse
    if (isServer) {
      // Add externals function to exclude youtube-dl-exec if needed
      const originalExternals = config.externals;
      const externalFunction = ({ request }, callback) => {
        // Check if the request matches youtube-dl-exec
        if (
          request === "youtube-dl-exec" ||
          (typeof request === "string" &&
            request.startsWith("youtube-dl-exec/"))
        ) {
          return callback(null, `commonjs ${request}`);
        }
        // Call original externals if it's a function
        if (typeof originalExternals === "function") {
          return originalExternals({ request }, callback);
        }
        callback();
      };

      if (Array.isArray(originalExternals)) {
        config.externals = [...originalExternals, externalFunction];
      } else if (originalExternals) {
        config.externals = [originalExternals, externalFunction];
      } else {
        config.externals = externalFunction;
      }
    }

    // Optimize for audio processing
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    // Suppress Supabase realtime warnings
    config.ignoreWarnings = [
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message:
          /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    // Alternative: More aggressive suppression if the above doesn't work
    const originalWarn =
      config.infrastructureLogging?.level !== "error" ? console.warn : () => {};

    config.infrastructureLogging = {
      level: "error", // Only show errors, not warnings
    };

    return config;
  },

  // Image optimization (for waveform thumbnails if needed)
  images: {
    domains: ["localhost"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // Headers for audio streaming
  async headers() {
    return [
      {
        source: "/api/audio/:path*",
        headers: [
          {
            key: "Accept-Ranges",
            value: "bytes",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
    ];
  },

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
