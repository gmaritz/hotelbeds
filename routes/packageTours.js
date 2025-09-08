const express = require('express');
const router = express.Router();
const PackageTour = require('../models/PackageTour');
// hypothetical
// const fetchAvailability = require('../hotelbeds/fetchAvailability'); 

router.get('/packages/:id', async (req, res) => {
  try {
    const tour = await PackageTour.findById(req.params.id).lean();
    // const hotels = await fetchAvailability(/* params as needed */);

    res.render('package', { tour });  //hotels
  } catch (err) {
    res.status(500).send('Error loading package tour');
  }
});

module.exports = router;