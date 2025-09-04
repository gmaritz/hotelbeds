const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hotel = require('./models/Hotel');
const crypto = require('crypto');
dotenv.config();

const BASE_URL = 'https://api.test.hotelbeds.com';
const hotelCodes = ["26852", "26976"]; // Update with your hotel codes

function generateSignature() {
  const apiKey = process.env.HOTELBEDS_API_KEY.trim();
  const secret = process.env.HOTELBEDS_SECRET.trim();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawSignature = apiKey + secret + timestamp;
  return crypto.createHash('sha256').update(rawSignature).digest('hex');
}

async function fetchHotelDetails(codes) {
  const headers = {
    'Api-Key': process.env.HOTELBEDS_API_KEY,
    'X-Signature': generateSignature(),
    'Accept': 'application/json',
  };

  const url = `${BASE_URL}/hotel-content-api/1.0/hotels/${codes.join(',')}/details?language=ENG&useSecondaryLanguage=false`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error fetching details:', errorText);
    throw new Error('Failed to fetch hotel details');
  }

  const data = await response.json();
  return data.hotels || [];
}

function extractHotelWideFacilities(facilities = []) {
  return facilities.filter(f => f.facilityGroupCode === 60);
}

function combineRoomFacilitiesWithHotelWide(roomFacilities = [], hotelWide = []) {
  const roomFacilityNames = roomFacilities.map(f => f.description?.content).filter(Boolean);
  const hotelFacilityNames = hotelWide.map(f => f.description?.content).filter(Boolean);
  return [...new Set([...roomFacilityNames, ...hotelFacilityNames])]; // merge and deduplicate
}

async function saveHotelContentToMongo(hotelContent) {
  const facilities = hotelContent.facilities || [];

  // Log available facility group codes for debugging
  const groupCodes = facilities.map(f => f.facilityGroupCode);
  console.log(`Hotel ${hotelContent.code} facility group codes:`, [...new Set(groupCodes)]);

  const hotelWideFacilities = extractHotelWideFacilities(facilities);

  const rooms = (hotelContent.rooms || []).map(room => {
    const roomFacilities = (room.roomFacilities || []).map(f => f.description?.content).filter(Boolean);
    
    return {
      roomCode: room.roomCode,
      description: room.description,
      type: {
        code: room.type?.code,
        description: room.type?.description?.content || ''
      },
      characteristic: {
        code: room.characteristic?.code,
        description: room.characteristic?.description?.content || ''
      },
      roomFacilities,
      combinedFacilities: combineRoomFacilitiesWithHotelWide(roomFacilities, hotelWideFacilities)
    };
  });


  await Hotel.findOneAndUpdate(
    { code: hotelContent.code },
    {
      code: hotelContent.code,
      name: hotelContent.name?.content,
      description: hotelContent.description,
      categoryCode: hotelContent.categoryCode,
      categoryName: hotelContent.categoryName,
      chainCode: hotelContent.chainCode,
      chainName: hotelContent.chainName,
      address: hotelContent.address?.content,
      latitude: hotelContent.coordinate?.latitude,
      longitude: hotelContent.coordinate?.longitude,
      images: hotelContent.images || [],
      facilities,
      hotelWideFacilities,
      rooms,
      lastUpdated: new Date()
    },
    { upsert: true, new: true }
  );

  console.log(`Hotel ${hotelContent.code} updated.`);
}


async function updateHotelDescriptions() {
  await mongoose.connect(process.env.DATABASE_URL);

  try {
    const contentHotels = await fetchHotelDetails(hotelCodes);

    for (const hotel of contentHotels) {
      await saveHotelContentToMongo(hotel);
    }

  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    mongoose.connection.close();
  }
}

updateHotelDescriptions();
