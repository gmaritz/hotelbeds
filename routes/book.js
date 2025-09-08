const express = require('express');
const router = express.Router();
const { checkRate, bookHotel } = require('../services/hotelbedsService');

const API_KEY = process.env.HOTELBEDS_API_KEY;
const SECRET = process.env.HOTELBEDS_SECRET;

router.post('/book', async (req, res) => {
  console.log('Received request body:', req.body); 
  let bookingData = req.body.bookingData;
  if (!bookingData) {
    return res.status(400).render('bookingError', { errorMessage: 'No booking data received.' });
  }

  // Parse the JSON string
  let selectedRates;
  try {
    selectedRates = JSON.parse(bookingData);
  } catch (e) {
    return res.status(400).render('bookingError', { errorMessage: 'Invalid booking data.' });
  }

  // If you only allow one selection:
  const selected = Array.isArray(selectedRates) ? selectedRates[0] : selectedRates;
  const rateKey = selected.rateKey;
  const paxes = selected.paxes;
  
  // ...use rateKey, selected, etc. to build your booking payload...
  
  // Print rateKey to console for debugging
  console.log('Received rateKey:', rateKey);

  try {
    let finalRateKey = rateKey;

    if (typeof rateKey === 'string' && rateKey.includes('RECHECK')) {
      const checked = await checkRate(rateKey, API_KEY, SECRET);
      finalRateKey = checked.hotel.rooms[0].rates[0].rateKey;
    }

    const bookingPayload = {
      holder:  { name: 'John', surname: 'Doe' },
      rooms: [{ rateKey: finalRateKey, paxes }],
      clientReference: 'my-booking-123',
      remark: 'Booking via website',
      tolerance: 2.00
    };

    const bookingResponse = await bookHotel(bookingPayload, API_KEY, SECRET);
    res.render('bookingSuccess', { booking: bookingResponse });
  } catch (err) {
    res.status(500).render('bookingError', { errorMessage: err.message });
  }
});

module.exports = router;
