import { spawn } from "node:child_process";

const port = Number(process.env.SMOKE_PORT || 5097);
const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

const startup = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("A API não iniciou no prazo esperado.")), 10_000);
  const inspect = (chunk) => {
    const output = chunk.toString();
    if (output.includes("serving on port")) {
      clearTimeout(timeout);
      resolve();
    }
  };
  child.stdout.on("data", inspect);
  child.stderr.on("data", inspect);
  child.once("exit", (code) => reject(new Error(`A API encerrou durante a inicialização (${code}).`)));
});

try {
  await startup;
  const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
  const health = await healthResponse.json();
  if (!healthResponse.ok || health.status !== "ok") throw new Error("Health check inválido.");

  const openApiResponse = await fetch(`http://127.0.0.1:${port}/api/openapi.json`);
  const openApi = await openApiResponse.json();
  if (!openApiResponse.ok || openApi.openapi !== "3.0.3" || Object.keys(openApi.paths || {}).length < 18) throw new Error("OpenAPI inválida.");

  const publicAssets = ["/", "/escola", "/manifest.webmanifest", "/sw.js", "/privacy.html", "/terms.html", "/cookies.html", "/school-icon-192.png", "/school-icon-512.png"];
  const assetResponses = await Promise.all(publicAssets.map((path) => fetch(`http://127.0.0.1:${port}${path}`)));
  if (assetResponses.some((response) => !response.ok)) throw new Error("Um ou mais artefatos públicos/PWA não foram servidos.");

  const publicResponse = await fetch(`http://127.0.0.1:${port}/api/v1/public/auth/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "0100" }),
  });
  const publicResult = await publicResponse.json();
  if (![200, 503].includes(publicResponse.status) || typeof publicResult !== "object") throw new Error("Fluxo público não respondeu de forma controlada.");

  console.log(`Smoke test aprovado: health=200, OpenAPI=${Object.keys(openApi.paths).length} rotas, ${publicAssets.length} rotas/PWA e fluxo público=${publicResponse.status}.`);
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("close", resolve));
}
