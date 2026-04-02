#!/usr/bin/env node

/**
 * Script para iniciar el backend en modo desarrollo
 * Mata procesos anteriores y muestra todos los logs
 */

const { spawn, execSync } = require("child_process");

const PORT = process.env.PORT || 4000;

function killProcessOnPort() {
  try {
    if (process.platform === "win32") {
      // Windows: usar taskkill
      const output = execSync(`netstat -ano -p tcp | findstr :${PORT}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      if (output) {
        const match = output.match(/\s+(\d+)\s*$/m);
        if (match && match[1]) {
          const pid = match[1];
          try {
            execSync(`taskkill /PID ${pid} /F`, {
              stdio: "ignore",
            });
            console.log(`✅ Proceso anterior (PID: ${pid}) terminado`);
          } catch (e) {
            // Silent fail
          }
        }
      }
    } else {
      // Unix/Linux/Mac
      try {
        const pids = execSync(`lsof -ti :${PORT}`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });

        if (pids) {
          pids.split("\n").forEach((pid) => {
            if (pid.trim()) {
              try {
                process.kill(pid.trim(), 9);
                console.log(`✅ Proceso anterior (PID: ${pid.trim()}) terminado`);
              } catch (e) {
                // Silent fail
              }
            }
          });
        }
      } catch (e) {
        // Silent fail
      }
    }
  } catch (err) {
    // No process found, continue
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Iniciando backend en modo desarrollo...\n");

  // Matar proceso anterior
  killProcessOnPort();
  await sleep(1000);

  // Iniciar backend
  console.log("📦 Ejecutando: cd backend && node src/index.js\n");
  console.log("─".repeat(60));

  const child = spawn("node", ["src/index.js"], {
    cwd: `${__dirname}/../backend`,
    stdio: "inherit", // Mostrar todos los logs
  });

  child.on("error", (err) => {
    console.error("❌ Error iniciando backend:", err);
    process.exit(1);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`\n❌ Backend salió con código: ${code}`);
      process.exit(code);
    }
  });
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
