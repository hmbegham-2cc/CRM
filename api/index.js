// Vercel serverless entry point - uses dynamic import for ESM
export default async function handler(req, res) {
  const app = (await import('../apps/api/dist/server.js')).default;
  return app(req, res);
}
