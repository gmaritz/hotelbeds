const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/packages/:id', (req, res) => {
  const jsonPath = path.join(__dirname, '../data/packageTours.json');
  fs.readFile(jsonPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error loading package tours');
    const tours = JSON.parse(data);
    const tour = tours.find(t => t.id === req.params.id);
    if (!tour) return res.status(404).send('Package tour not found');
    res.render('package', { tour });
  });
});

module.exports = router;