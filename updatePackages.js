const mongoose = require('mongoose');
const PackageTour = require('./models/PackageTour');
const dotenv = require('dotenv');
dotenv.config();

    mongoose.connect(process.env.DATABASE_URL);

    const sampleTours = [
    {
    title: "Cape Town Highlights 4 Day Package",
    description: "Sip, savor, and celebrate the Cape Winelands' most exceptional wines...",
    image: ["/images/winetours/cape-winelands-tour.jpg"],
    price: [4290, 4290, 3990, 3690, 3590, 3390],
    regions: ["Paarl", "Franschhoek", "Stellenbosch"],
    duration: "Full day, ± 8 hrs",
    languages: ["English", "German"],
    highlights: [
      "Master cheese & wine pairing at Fairview estate",
      "Flagship wine tasting at Anthonij Rupert Wines",
      "Chocolate & wine pairing at Waterford estate",
      "Fine dining lunch experience"
    ],
    included: [
      "Certified professional tour guide",
      "All wine tasting fees",
      "Air conditioned vehicle & fuel",
      "Pickup and return to your accommodation"
    ],
    excluded: ["Lunch"],
    itinerary: [
      { day: 1, activities: ["Arrival", "Welcome dinner"] },
      { day: 2, activities: ["Wine tour", "Cheese tasting"] }
    ],
    rating: 4.8
  }
  // Add more sample tours as needed
];

PackageTour.insertMany(sampleTours)
  .then(() => {
    console.log('Sample package tours seeded!');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error(err);
    mongoose.connection.close();
  });
