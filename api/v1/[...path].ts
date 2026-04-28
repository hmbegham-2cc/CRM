// Load env vars in Vercel (they're injected automatically, but dotenv helps locally)
import "../../../apps/api/src/server.ts";

export default async function handler(req: any, res: any) {
  const app = (await import("../../../apps/api/src/server.ts")).default;
  return app(req, res);
}
