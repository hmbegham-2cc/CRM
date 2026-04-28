// Vercel serverless entry point
// This imports the built Express app from apps/api/dist/server.js

import app from '../apps/api/dist/server.js';

export default function handler(req, res) {
  return app(req, res);
}
