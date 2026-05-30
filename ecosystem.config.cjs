module.exports = {
  apps: [
    {
      name: "email-api",
      script: "pnpm",
      args: "--filter @email-relay/api start",
    },
    {
      name: "email-smtp",
      script: "pnpm",
      args: "--filter @email-relay/smtp-server start",
    },
    {
      name: "email-worker",
      script: "pnpm",
      args: "--filter @email-relay/worker start",
    },
    {
      name: "email-admin",
      script: "pnpm",
      args: "--filter @email-relay/admin-panel preview",
    },
  ],
};
