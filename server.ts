import express from "express";
import path from "path";
import http from "http";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  console.log("[VoIP Server] Auto-provisioning python dependencies (pip install)...");
  
  try {
    const pipInstall = spawn("python3", ["-m", "pip", "install", "-r", "requirements.txt", "--user"]);
    await new Promise<void>((resolve) => {
      pipInstall.stdout.on("data", (data) => console.log(`[pip] ${data.toString().trim()}`));
      pipInstall.stderr.on("data", (data) => console.warn(`[pip stderr] ${data.toString().trim()}`));
      pipInstall.on("close", (code) => {
        console.log(`[pip] installation completed with exit code ${code}`);
        resolve();
      });
    });
  } catch (err) {
    console.error("[VoIP Server] Failed to execute pip install on boot. Attempting direct boot anyway:", err);
  }

  console.log("[VoIP Server] Spawning Python FastAPI backend (uvicorn app.main:app)...");
  
  const fastapiProcess = spawn("python3", ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], {
    env: { ...process.env, PYTHONUNBUFFERED: "1" }
  });

  fastapiProcess.stdout.on("data", (data) => {
    console.log(`[FastAPI Stdout] ${data.toString().trim()}`);
  });

  fastapiProcess.stderr.on("data", (data) => {
    console.warn(`[FastAPI Stderr] ${data.toString().trim()}`);
  });

  fastapiProcess.on("close", (code) => {
    console.error(`[FastAPI] Python background process exited with code ${code}`);
  });

  const handleProxy = (req: express.Request, res: express.Response) => {
    const options = {
      hostname: "127.0.0.1",
      port: 8000,
      path: req.originalUrl,
      method: req.method,
      headers: req.headers
    };

    const proxyReq = http.request(options, (proxyRes) => {
      if (proxyRes.statusCode) {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
      }
      proxyRes.pipe(res, { end: true });
    });

    req.pipe(proxyReq, { end: true });

    proxyReq.on("error", (err) => {
      console.error("[VoIP Server Proxy Error] Failed communication with FastAPI backend:", err);
      res.status(502).json({
        detail: "Failed communication with VoIP Analyzer FastAPI engine. Check if Python background servers are active."
      });
    });
  };

  app.all("/api/*", handleProxy);
  
  app.get("/docs", handleProxy);
  app.get("/redoc", handleProxy);
  app.get("/openapi.json", handleProxy);

  if (process.env.NODE_ENV !== "production") {
    console.log("[VoIP Server] Running in DEVELOPMENT mode. Mounting Vite Dev Middleware.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[VoIP Server] Running in PRODUCTION mode. Serving static assets.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VoIP Server] Front Gate is open at http://localhost:${PORT}`);
    console.log(`[VoIP Server] Swagger API is open at http://localhost:${PORT}/docs`);
  });
}

startServer().catch((error) => {
  console.error("[VoIP Server Failed to Launch]", error);
});
