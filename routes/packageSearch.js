const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { fetchAvailability } = require('../services/fetchAvailability');
const Hotel = require('../models/Hotel');

router.post('/package-search', async (req, res) => {
  const { tourId, tourStartDate, adults, children } = req.body;

  try {
    // Extract child ages from form data
    const childAges = [];
    const childrenCount = parseInt(children) || 0;
    
    for (let i = 1; i <= childrenCount; i++) {
      const childAge = req.body[`childAge${i}`];
      if (childAge) {
        childAges.push(parseInt(childAge));
      }
    }
    
    // Build pax array for API
    const paxes = [];
    
    // Add adults
    const adultsCount = parseInt(adults) || 2;
    for (let i = 0; i < adultsCount; i++) {
      paxes.push({
        type: "AD",
        age: 30
      });
    }
    
    // Add children
    childAges.forEach(age => {
      paxes.push({
        type: "CH",
        age: age
      });
    });

    console.log('Passenger configuration:', {
      adults: adultsCount,
      children: childrenCount,
      childAges: childAges,
      paxes: paxes
    });

    // Load package tour data from JSON
    const toursData = fs.readFileSync(path.join(__dirname, '../data/packageTours.json'), 'utf8');
    const tours = JSON.parse(toursData);
    const tour = tours.find(t => t.id === tourId);
    
    if (!tour) {
      return res.status(404).send('Tour not found');
    }

    const accommodations = tour.accommodations || [];
    
    if (accommodations.length === 0) {
      return res.render('package', { 
        tour, 
        results: [],
        message: 'No accommodations configured for this tour.' 
      });
    }

    // Calculate dates for each stop
    let currentDate = new Date(tourStartDate);
    const stayRequests = [];

    accommodations.forEach(accommodation => {
      const checkIn = new Date(currentDate);
      const checkOut = new Date(currentDate);
      checkOut.setDate(checkOut.getDate() + accommodation.nights);
      currentDate = new Date(checkOut);

      // Get all hotel codes for this stop
      const hotelCodes = accommodation.hotelOptions.map(option => option.hotelCode);

      stayRequests.push({
        stopNumber: accommodation.stopNumber,
        location: accommodation.location,
        hotelCodes: hotelCodes,
        nights: accommodation.nights,
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10),
        paxes: paxes // Add passenger info to each stay request
      });
    });

    console.log('Stay requests with pax data:', stayRequests);

    // Fetch availability for each stop
    const results = [];
    for (const stay of stayRequests) {
      try {
        console.log(`\n--- STOP ${stay.stopNumber}: ${stay.location} ---`);
        console.log(`Fetching availability for hotels ${stay.hotelCodes.join(', ')} from ${stay.checkIn} to ${stay.checkOut}`);
        console.log(`Passenger configuration:`, stay.paxes);
        
        // Fetch live availability from Hotelbeds API with passenger info
        const availability = await fetchAvailability(stay.hotelCodes, stay.checkIn, stay.checkOut, stay.paxes);
        console.log(`API returned ${availability.length} hotels for stop ${stay.stopNumber}`);

        if (!availability || availability.length === 0) {
          console.log(`No availability found for stop ${stay.stopNumber} hotels: ${stay.hotelCodes.join(', ')}`);
          results.push({
            stopNumber: stay.stopNumber,
            location: stay.location,
            hotelCodes: stay.hotelCodes,
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            hotels: []
          });
          continue;
        }

        // Extract hotel codes from availability
        const availableHotelCodes = availability.map(h => h.code);
        console.log(`Available hotel codes:`, availableHotelCodes);

        // Load hotel content from MongoDB using string codes
        const contentHotels = await Hotel.find({
          code: { $in: availableHotelCodes.map(code => code.toString()) }
        }).lean();

        console.log(`Found ${contentHotels.length} hotels in MongoDB for codes:`, contentHotels.map(h => h.code));

        // Enrich API data with MongoDB hotel information
        const enrichedHotels = availability.map(hotel => {
          const content = contentHotels.find(c => c.code.toString() === hotel.code.toString()) || {};
          console.log(`Enriching hotel ${hotel.code}: found content = ${!!content.name}`);

          const name = content.name || hotel.name || `Hotel ${hotel.code}`;
          
          const description = content.description?.content ||
            content.descriptions?.[0]?.content ||
            'No description available.';

          const images = Array.isArray(content.images)
            ? content.images.map(img => ({
                path: img.path || img.imagePath || '',
              }))
            : [];

          const facilities = Array.isArray(content.facilities)
            ? content.facilities.map(fac => {
                if (typeof fac.description === 'string') {
                  return { description: { content: fac.description } };
                }
                return fac;
              }).filter(f => f.description?.content)
            : [];

          const hotelWideFacilities = facilities
            .filter(f => f.facilityGroupCode === 60)
            .map(f => f.description?.content)
            .filter(Boolean);

          // Use real room data from API with enhanced room information from MongoDB
          const rooms = (hotel.rooms || []).map(room => {
            const dbRoom = content.rooms?.find(r => r.roomCode === room.code);
            
            return {
              code: room.code,
              name: room.name || 'Unnamed Room',
              description: dbRoom?.description || room.name || 'Room description not available',
              rates: room.rates || [],
              roomFacilities: dbRoom?.roomFacilities || [],
              combinedFacilities: dbRoom?.combinedFacilities || [],
            };
          });

          return {
            code: hotel.code.toString(),
            name,
            description,
            images,
            facilities,
            hotelWideFacilities,
            address: content.address,
            categoryName: content.categoryName || hotel.category || "Hotel",
            destinationName: stay.location,
            rooms,
            price: hotel.price || 'N/A',
            currency: hotel.currency || 'ZAR',
            category: hotel.category,
            location: hotel.location,
            stars: content.stars || hotel.stars || 0,
          };
        });
        
        console.log(`Enriched ${enrichedHotels.length} hotels for stop ${stay.stopNumber}`);
        
        results.push({
          stopNumber: stay.stopNumber,
          location: stay.location,
          hotelCodes: stay.hotelCodes,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          hotels: enrichedHotels
        });

      } catch (error) {
        console.error(`Error fetching hotels for stop ${stay.stopNumber}:`, error);
        results.push({
          stopNumber: stay.stopNumber,
          location: stay.location,
          hotelCodes: stay.hotelCodes,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          hotels: []
        });
      }
    }

    console.log(`\n--- FINAL RESULTS ---`);
    console.log(`Total stops processed: ${results.length}`);
    results.forEach((result, index) => {
      console.log(`Stop ${result.stopNumber}: ${result.hotels.length} hotels available`);
    });

    // Render package.ejs with tour info and results
res.render('package', { 
  tour, 
  results,
  searchParams: {
    adults: adultsCount,
    children: childrenCount,
    childAges: childAges
  }
});

  } catch (error) {
    console.error('Error in package search:', error);
    res.status(500).send('Error loading package tour data');
  }
});

module.exports = router;