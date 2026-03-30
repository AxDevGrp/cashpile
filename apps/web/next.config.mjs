/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cashpile/ui", "@cashpile/db", "@cashpile/ai"],
  experimental: {
    serverComponentsExternalPackages: ["openai"],
  },
};

export default nextConfig;
