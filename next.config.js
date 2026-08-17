module.exports = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  publicRuntimeConfig: {
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID
  }
}
