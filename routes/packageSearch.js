const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { fetchAvailability } = require('../services/fetchAvailability');
const Hotel = require('../models/Hotel');

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
    try {
      // Fetch hotel information from MongoDB
      const hotelInfo = await Hotel.findOne({ code: stay.hotelCode });
      
      if (!hotelInfo) {
        console.log(`Hotel ${stay.hotelCode} not found in database`);
        results.push({
          hotelCode: stay.hotelCode,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          hotels: []
        });
        continue;
      }

      console.log(`Found hotel ${stay.hotelCode}:`, {
        name: hotelInfo.name,
        imageCount: hotelInfo.images ? hotelInfo.images.length : 0,
        images: hotelInfo.images ? hotelInfo.images.slice(0, 3) : 'No images'
      });

      // Fetch live availability from Hotelbeds API
      console.log(`Fetching availability for hotel ${stay.hotelCode} from ${stay.checkIn} to ${stay.checkOut}`);
      let availability = [];
      
      try {
        availability = await fetchAvailability([stay.hotelCode], stay.checkIn, stay.checkOut);
        console.log(`API returned ${availability.length} hotels for ${stay.hotelCode}`);
      } catch (apiError) {
        console.error(`API error for hotel ${stay.hotelCode}:`, apiError.message);
        // Continue with empty availability - we'll show hotel info without rates
      }
      
      if (!availability || availability.length === 0) {
        console.log(`No availability found for hotel ${stay.hotelCode}, showing hotel info only`);
        
        // Show hotel info with mock rates as fallback
        const enrichedHotel = {
          code: hotelInfo.code.toString(),
          name: hotelInfo.name || `Hotel ${stay.hotelCode}`,
          description: hotelInfo.description?.content || hotelInfo.descriptions?.[0]?.content || 'No description available.',
          images: Array.isArray(hotelInfo.images) ? hotelInfo.images.map(img => ({ path: img.path || img.imagePath || '' })) : [],
          facilities: Array.isArray(hotelInfo.facilities) ? hotelInfo.facilities.map(fac => {
            if (typeof fac.description === 'string') {
              return { description: { content: fac.description } };
            }
            return fac;
          }).filter(f => f.description?.content) : [],
          hotelWideFacilities: (Array.isArray(hotelInfo.facilities) ? hotelInfo.facilities : [])
            .filter(f => f.facilityGroupCode === 60)
            .map(f => f.description?.content)
            .filter(Boolean),
          address: hotelInfo.address,
          categoryName: hotelInfo.categoryName || "Hotel",
          destinationName: "Cape Town",
          rooms: [
            {
              code: "DBL.ST",
              roomCode: "DBL.ST", 
              name: "Standard Double Room",
              description: "Standard Double Room (API unavailable - showing sample rates)",
              rates: [
                {
                  rateKey: `${stay.hotelCode}-fallback-${Date.now()}`,
                  net: 1200,
                  currency: "ZAR",
                  boardName: "Room Only",
                  refundable: true,
                  cancellationPolicies: [
                    {
                      amount: "0.00",
                      from: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    }
                  ]
                }
              ],
              roomFacilities: ["Free WiFi", "Air conditioning", "Private bathroom"]
            }
          ]
        };
        
        results.push({
          hotelCode: stay.hotelCode,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          hotels: [enrichedHotel]
        });
        continue;
      }

      // Enrich API data with MongoDB hotel information
      const enrichedHotels = availability.map(apiHotel => {
        // Use MongoDB data for basic hotel info, API data for rooms/rates
        const name = hotelInfo.name || apiHotel.name || `Hotel ${stay.hotelCode}`;
        
        const description = hotelInfo.description?.content ||
          hotelInfo.descriptions?.[0]?.content ||
          'No description available.';

        const images = Array.isArray(hotelInfo.images)
          ? hotelInfo.images.map(img => ({
              path: img.path || img.imagePath || '',
            }))
          : [];

        const facilities = Array.isArray(hotelInfo.facilities)
          ? hotelInfo.facilities.map(fac => {
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
        const rooms = (apiHotel.rooms || []).map(apiRoom => {
          const dbRoom = hotelInfo.rooms?.find(r => r.roomCode === apiRoom.code);
          
          return {
            code: apiRoom.code,
            roomCode: apiRoom.code,
            name: apiRoom.name || dbRoom?.name || 'Unnamed Room',
            description: dbRoom?.description || apiRoom.name || 'Room description not available',
            rates: (apiRoom.rates || []).map(rate => ({
              rateKey: rate.rateKey,
              net: parseFloat(rate.net),
              currency: rate.currency || 'ZAR',
              boardName: rate.boardName,
              refundable: rate.refundable,
              cancellationPolicies: rate.cancellationPolicies || [],
              rateComments: rate.rateComments || '',
              offers: rate.offers || [],
              taxes: rate.taxes || []
            })),
            roomFacilities: dbRoom?.roomFacilities || [],
            combinedFacilities: dbRoom?.combinedFacilities || [],
          };
        });

        return {
          code: apiHotel.code.toString(),
          name,
          description,
          images,
          facilities,
          hotelWideFacilities,
          address: hotelInfo.address,
          categoryName: hotelInfo.categoryName || apiHotel.category || "Hotel",
          destinationName: "Cape Town",
          rooms,
          price: apiHotel.price,
          currency: apiHotel.currency,
          location: apiHotel.location
        };
      });
      
      console.log(`Enriched ${enrichedHotels.length} hotels for ${stay.hotelCode}`);
      
      results.push({
        hotelCode: stay.hotelCode,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        hotels: enrichedHotels
      });
    } catch (error) {
      console.error(`Error fetching hotel ${stay.hotelCode}:`, error);
      results.push({
        hotelCode: stay.hotelCode,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        hotels: []
      });
    }
  }

  // Render package.ejs with tour info and results
  res.render('package', { tour, results });
});

// Debug route to check hotels in database
router.get('/debug-hotels', async (req, res) => {
  try {
    const hotels = await Hotel.find({}, 'code name').limit(10);
    res.json(hotels.map(h => ({ code: h.code, name: h.name })));
  } catch (error) {
    res.json({ error: error.message });
  }
});

module.exports = router;