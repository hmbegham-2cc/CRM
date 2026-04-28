// Vercel serverless entry point - uses dynamic import for ESM
export default async function handler(req, res) {
  try {
    console.log('[API] Loading server...');
    const app = (await import('../apps/api/dist/server.js')).default;
    console.log('[API] Server loaded, handling request');
    return app(req, res);
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: error.stack 
    });
  }
}
