module.exports = {
  apps: [
    {
      name: "api-server",
      script: "src/api/server.mjs",
      interpreter: "node",
      cwd: "/home/ubuntu/investnotify",
      env_production: {
        NODE_ENV: "production",
      },
      max_memory_restart: "300M",
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "bot-daemon",
      script: "src/bot.mjs",
      interpreter: "node",
      cwd: "/home/ubuntu/investnotify",
      env_production: {
        NODE_ENV: "production",
      },
      max_memory_restart: "200M",
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
