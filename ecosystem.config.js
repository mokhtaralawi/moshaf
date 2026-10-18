/**
 * PM2 Process Management Configuration for Linux Production
 * Run with: pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'zad-alansari-app',
      script: 'server.js',
      instances: 'max', // Scale across all available CPU cores or set to 1 for small VPS
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
