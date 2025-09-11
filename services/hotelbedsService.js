const { generateSignature } = require('../utils/hotelbeds');
const API_URL = 'https://api.test.hotelbeds.com/hotel-api/1.0';

async function checkRate(rateKey, apiKey, secret) {

  const response = await fetch(`${API_URL}/checkrates`, {
    method: 'POST',
    headers: {
      'Api-key': apiKey,
      'X-Signature': generateSignature(),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rooms: [{ rateKey }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`CheckRate failed: ${err}`);
  }
  return await response.json();
}

async function bookHotel(bookingData, apiKey, secret) {

  const response = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Api-key': apiKey,
      'X-Signature': generateSignature(),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bookingData)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Booking failed: ${err}`);
  }
  return await response.json();
}

module.exports = { checkRate, bookHotel };
