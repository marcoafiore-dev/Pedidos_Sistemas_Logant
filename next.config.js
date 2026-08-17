/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable API routes
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // Production build
  reactStrictMode: true,
  publicRuntimeConfig: {
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID
  },
  serverRuntimeConfig: {
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID
  }
}

module.exports = nextConfig
