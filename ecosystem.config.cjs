const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  const env = {};
  try {
    const content = fs.readFileSync(path.resolve(__dirname, filePath), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  } catch {}
  return env;
}

const env = loadEnv(".env");

module.exports = {
  apps: [
    {
      name: "email-api",
      script: "pnpm",
      args: "--filter @email-relay/api start",
      env,
    },
    {
      name: "email-smtp",
      script: "pnpm",
      args: "--filter @email-relay/smtp-server start",
      env,
    },
    {
      name: "email-worker",
      script: "pnpm",
      args: "--filter @email-relay/worker start",
      env,
    },
    {
      name: "email-admin",
      script: "pnpm",
      args: "--filter @email-relay/admin-panel preview",
      env,
    },
  ],
};
