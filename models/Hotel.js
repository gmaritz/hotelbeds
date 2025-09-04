const mongoose = require('mongoose');

const FacilitySchema = new mongoose.Schema({
  facilityCode: Number,
  facilityGroupCode: Number,
  description: {
    content: String
  }
}, { _id: false });

const RoomFacilitySchema = new mongoose.Schema({
  facilityCode: Number,
  facilityGroupCode: Number,
  description: {
    content: String
  }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  roomCode: String,
  description: String,
  type: {
    code: String,
    description: String
  },
  characteristic: {
    code: String,
    description: String
  },
  roomFacilities: [String],
  combinedFacilities: [String]
}, { _id: false });

const HotelSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: String,
  description: {
    content: String
  },
  categoryCode: String,
  categoryName: String,
  chainCode: String,
  chainName: String,
  address: String,
  latitude: Number,
  longitude: Number,
  images: [mongoose.Schema.Types.Mixed],
  facilities: [FacilitySchema], // all facilities
  hotelWideFacilities: [FacilitySchema], // only facilityGroupCode == 60
  rooms: [RoomSchema],
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hotel', HotelSchema);
