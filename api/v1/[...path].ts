import app from "../../../apps/api/src/server.ts";

export default function handler(req: any, res: any) {
  return app(req as any, res as any);
}
