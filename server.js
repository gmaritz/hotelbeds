require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const Hotel = require('./models/Hotel');
const { generateSignature } = require('./utils/hotelbeds');

const app = express();
const PORT = 3000;

// Hardcoded hotel codes
const HOTEL_CODES = ["26852", "26976"]; // to be extended
const BASE_URL = 'https://api.test.hotelbeds.com';

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', require('./routes/book'));
app.use('/', require('./routes/packageTours'));
app.use('/', require('./routes/packageSearch'));

mongoose.connect(process.env.DATABASE_URL, {
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Show form to pick dates
app.get('/', (req, res) => {
  res.render('form');
});

// Handle form submit and fetch hotel availability
app.post('/search', async (req, res) => {
  const { checkIn, checkOut } = req.body;

  try {
    const availability = await fetchAvailability(HOTEL_CODES, checkIn, checkOut);

    // Extract hotel codes from availability
    const hotelCodes = availability.map(h => h.code);

    // Load hotel content from MongoDB using string codes
    const contentHotels = await Hotel.find({
      code: { $in: hotelCodes.map(code => code.toString()) }
    }).lean();

    // Normalize and enrich each hotel
    const enrichedHotels = availability.map(hotel => {
      const content = contentHotels.find(c => c.code.toString() === hotel.code.toString()) || {};

      const name = content.name || hotel.name;
      
      const description =
        content.description?.content ||
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
        .filter(Boolean); // remove undefined/null values
  
      const rooms = (hotel.rooms || []).map(room => {
        const dbRoom = content.rooms?.find(r => r.roomCode === room.code);
        
        return {
          code: room.code,
          name: room.name || 'Unnamed Room',
          description: dbRoom?.description || '',
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
        rooms,
        price: hotel.price || 'N/A',  // minimum rate available at hotel
        currency: hotel.currency || 'ZAR',
        category: hotel.category,
        location: hotel.location,
        stars: content.stars || hotel.stars || 0,
      };
    });

    res.render('hotel', { hotels: enrichedHotels });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('Something went wrong.');
  }
});

// Fetch availability + room info in ZAR
async function fetchAvailability(hotelCodes, checkIn, checkOut) {
  const query = {
    stay: { checkIn, checkOut },
    occupancies: [{ rooms: 1, adults: 2, children: 0 }],
    hotels: {
      hotel: hotelCodes
    }
  };

  const headers = {
    'Api-Key': process.env.HOTELBEDS_API_KEY,
    'X-Signature': generateSignature(),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Currency': 'ZAR',
  };

  try {
    const response = await fetch(`${BASE_URL}/hotel-api/1.0/hotels?language=ENG&currency=ZAR`, {
      method: 'POST',
      headers,
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('API error response:', errorBody);
      throw new Error(`Hotelbeds API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Debugging code
    console.log('Full API response:', JSON.stringify(data, null, 2));

    const availability = data.hotels?.hotels || [];

    // Filter and deduplicate rooms
    availability.forEach(hotel => {
  const roomsMap = new Map();

  hotel.rooms = (hotel.rooms || [])
    .flatMap(room => {
      const validRates = (room.rates || []).filter(rate => {
        const board = rate.boardName?.toLowerCase() || "";
        return board.includes("breakfast") || board.includes("full board");
      });

      return validRates.map(rate => {
        const key = `${room.code}_${rate.boardName?.toLowerCase()}`;
        if (roomsMap.has(key)) return null;

        const rateData = {
          boardName: rate.boardName,
          currency: rate.currency,
          net: rate.net,
          rateKey: rate.rateKey,
          refundable: rate.rateType !== 'NRF',
          cancellationPolicies: rate.cancellationPolicies || [],
          rateComments: rate.rateComments || '',
          offers: rate.offers || [],
          taxes: rate.taxes || []
        };

        roomsMap.set(key, {
          code: room.code,
          name: room.name,
          rates: [rateData],
        });

        return roomsMap.get(key);
      });
    })
    .filter(Boolean);
  });
    return availability
      .filter(h => h.code && h.rooms)
      .map(h => ({
        code: h.code,
        name: h.name,
        rooms: h.rooms.map(r => ({
          code: r.code,
          name: r.name,
          rates: r.rates, // ✅ Keep all rate options
        })),
        price: h.minRate,
        currency: h.currency,
        category: h.categoryCode,
        location: {
          latitude: h.latitude,
          longitude: h.longitude,
        },
      }));
    
  } catch (error) {
    console.error('Error fetching availability:', error.message);
    return [];
  }
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
