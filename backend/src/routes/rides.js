const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   POST api/rides/compare
// @desc    Get fare comparisons from multiple providers
router.post('/compare', auth, async (req, res) => {
  const { pickup, destination } = req.body;

  if (!pickup || !destination) {
    return res.status(400).json({ msg: 'Please provide pickup and destination' });
  }

  // Mock fare calculation logic (In real app, call provider APIs/Scrapers)
  // Distance simulated as random for now
  const baseDistance = Math.random() * 10 + 2; // 2-12 km

  const comparisons = [
    {
      provider: 'Careem',
      fare: Math.round(baseDistance * 50 + 100), // PKR
      eta: '5 mins',
      rideType: 'Economy',
      id: 'careem_1',
    },
    {
      provider: 'Yango',
      fare: Math.round(baseDistance * 45 + 80),
      eta: '3 mins',
      rideType: 'Comfort',
      id: 'yango_1',
    },
    {
      provider: 'inDrive',
      fare: Math.round(baseDistance * 40 + 50),
      eta: '7 mins',
      rideType: 'Mini',
      id: 'indrive_1',
    },
    {
      provider: 'Uber',
      fare: Math.round(baseDistance * 55 + 120),
      eta: '4 mins',
      rideType: 'UberX',
      id: 'uber_1',
    }
  ];

  res.json(comparisons);
});

module.exports = router;
