// Vercel adapter; secrets and provider calls remain on the server.
module.exports = require('../backend/assistant/handler.cjs').createHandler();
