const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Show single tour
router.get('/tours/:id', (req, res) => {
  try {
    const tours = require('../data/tours.json');
    const tour = tours.find(t => t.id === req.params.id);
    
    if (!tour) {
      return res.status(404).send('Tour not found');
    }
    
    res.render('tour', { tour });
  } catch (error) {
    console.error('Error loading tour:', error);
    res.status(500).send('Error loading tour data');
  }
});

// List all tours (optional)
router.get('/tours', (req, res) => {
  try {
    const tours = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/tours.json'), 'utf-8'));
    res.render('tours', { tours });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading tours');
  }
});

module.exports = router;