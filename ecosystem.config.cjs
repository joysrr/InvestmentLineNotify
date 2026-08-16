const path = require("path");
const dotenv = require("dotenv");

// 動態載入當前目錄下的 .env 檔
dotenv.config({ path: path.resolve(__dirname, ".env") });

module.exports = {
  apps: [
    {
      name: "api-server",
      script: "src/api/server.mjs",
      interpreter: "node",
      cwd: __dirname,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: 3000,
        ...process.env,
      },
      max_memory_restart: "300M",
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: path.resolve(__dirname, "logs/pm2-api-error.log"),
      out_file: path.resolve(__dirname, "logs/pm2-api-out.log"),
    },
    {
      name: "bot-daemon",
      script: "src/bot.mjs",
      interpreter: "node",
      cwd: __dirname,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        ...process.env,
      },
      max_memory_restart: "200M",
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: path.resolve(__dirname, "logs/pm2-bot-error.log"),
      out_file: path.resolve(__dirname, "logs/pm2-bot-out.log"),
    },
  ],
};
