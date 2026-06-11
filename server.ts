import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
