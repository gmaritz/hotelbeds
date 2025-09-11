const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const fetchAvailability = require('../services/fetchAvailability');

router.post('/package-search', async (req, res) => {
  const { tourId, tourStartDate } = req.body;

  // Load package tour data from JSON
  const tours = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/packageTours.json')));
  const tour = tours.find(t => t.id === tourId);
  if (!tour) return res.status(404).send('Tour not found');
  // Example: Assume tour.accommodations is an array of { hotelCode, nights }
  const accommodations = tour.accommodations || [];

  // Calculate dates for each stop
  let currentDate = new Date(tourStartDate);
  const stayRequests = accommodations.map(acc => {
    const checkIn = new Date(currentDate);
    const checkOut = new Date(currentDate);
    checkOut.setDate(checkOut.getDate() + acc.nights);
    currentDate = new Date(checkOut);
    return {
      hotelCode: acc.hotelCode,
      checkIn: checkIn.toISOString().slice(0, 10),
      checkOut: checkOut.toISOString().slice(0, 10)
    };
  });

  // Fetch availability for each stop
  const results = [];
  for (const stay of stayRequests) {
    // Uncomment and use your actual fetchAvailability function
    // const availability = await fetchAvailability([stay.hotelCode], stay.checkIn, stay.checkOut);
    const availability = []; // Placeholder
    results.push({
      hotelCode: stay.hotelCode,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      hotels: availability
    });
  }

  // Render package.ejs with tour info and results
  res.render('package', { tour, results });
});

module.exports = router;