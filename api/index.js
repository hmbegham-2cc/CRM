// Vercel serverless entry point - CommonJS handler
const app = require('../apps/api/dist/server.cjs').default;

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
