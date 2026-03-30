/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@cashpile/ui", "@cashpile/db", "@cashpile/ai"],
  experimental: {
    serverComponentsExternalPackages: ["openai"],
  },
};

export default nextConfig;
