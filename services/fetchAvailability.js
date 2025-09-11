const { generateSignature } = require('../utils/hotelbeds');

const BASE_URL = 'https://api.test.hotelbeds.com';

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

module.exports = { fetchAvailability };
