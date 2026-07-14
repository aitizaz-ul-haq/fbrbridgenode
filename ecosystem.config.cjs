// PM2 process configuration for the FBR bridge.
// Usage on the droplet: pm2 start ecosystem.config.cjs --env production
module.exports = {
  apps: [
    {
      name: 'fbr-bridge',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
