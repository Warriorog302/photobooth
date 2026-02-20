/** @type {import('next').NextConfig} */
const nextConfig = {
  cleanDistDir: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
