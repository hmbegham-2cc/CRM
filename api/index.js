// Vercel serverless entry point
// The API is bundled into api/_server.cjs by esbuild during build
const app = require('./_server.cjs').default;

module.exports = async function handler(req, res) {
  try {
    return app(req, res);
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
};
