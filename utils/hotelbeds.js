const crypto = require('crypto');

function generateSignature(apiKey, secret, timestamp) {
  return crypto
    .createHash('sha256')
    .update(apiKey + secret + timestamp)
    .digest('hex');
}

module.exports = { generateSignature };