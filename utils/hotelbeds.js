const crypto = require('crypto');

const apiKey = process.env.HOTELBEDS_API_KEY.trim();
const secret = process.env.HOTELBEDS_SECRET.trim();
const timestamp = Math.floor(Date.now() / 1000).toString();

//function generateSignature(apiKey, secret, timestamp) {
function generateSignature() {
  return crypto
    .createHash('sha256')
    .update(apiKey + secret + timestamp)
    .digest('hex');
}

module.exports = { generateSignature };