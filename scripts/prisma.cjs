const { spawn } = require("node:child_process");

process.env.DATABASE_URL ??= "postgresql://cove:cove@127.0.0.1:5432/cove?connect_timeout=3";

const child = spawn("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
