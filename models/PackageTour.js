const mongoose = require('mongoose');

const packageTourSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  image: [{ type: String }],
  price: [{ type: Number}],
  regions: [{ type: String }],
  duration: { type: String },
  languages: [{ type: String }],
  highlights: [{ type: String }],
  included: [{ type: String }],
  excluded: [{ type: String }],
  itinerary: [{ 
    day: Number, 
    activities: [String] 
  }],
  rating: { type: Number, min: 0, max: 5 }
});

module.exports = mongoose.model('PackageTour', packageTourSchema);