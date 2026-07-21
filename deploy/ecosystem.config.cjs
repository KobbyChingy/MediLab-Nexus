module.exports = {
  apps: [
    {
      name: "medilab-api",
      cwd: ".",
      script: "node",
      args: "apps/api/dist/server.js",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
    {
      name: "medilab-worker",
      cwd: ".",
      script: "node",
      args: "apps/api/dist/worker.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
