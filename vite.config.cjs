module.exports = {
  server: {
    allowedHosts: true,
    headers: {
      'Content-Security-Policy': 'frame-ancestors *',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': 'frame-ancestors *',
    },
  },
}
