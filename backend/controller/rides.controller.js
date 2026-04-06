const rideSimulationService = require("../service/rideSimulation.service");

async function compare(req, res, next) {
  try {
    const {
      pickup,
      destination,
      pickupLat,
      pickupLng,
      destinationLat,
      destinationLng,
      rideType,
      rideId,
      action,
    } = req.body || {};

    const isBookMode = Boolean(rideId) || action === "book";
    if (isBookMode) {
      const data = rideSimulationService.bookRide(rideId);
      return res.json(data);
    }

    const pickupCoords =
      typeof pickupLat === "number" && typeof pickupLng === "number"
        ? { latitude: pickupLat, longitude: pickupLng }
        : null;
    const destinationCoords =
      typeof destinationLat === "number" && typeof destinationLng === "number"
        ? { latitude: destinationLat, longitude: destinationLng }
        : null;

    const data = rideSimulationService.findRides({
      pickup,
      destination,
      pickupCoords,
      destinationCoords,
      rideType,
    });
    return res.json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    next(err);
  }
}

async function estimateMin(req, res, next) {
  try {
    const {
      pickupLat,
      pickupLng,
      destinationLat,
      destinationLng,
      rideType,
    } = req.body || {};

    const pickupCoords =
      typeof pickupLat === 'number' && typeof pickupLng === 'number'
        ? { latitude: pickupLat, longitude: pickupLng }
        : null;
    const destinationCoords =
      typeof destinationLat === 'number' && typeof destinationLng === 'number'
        ? { latitude: destinationLat, longitude: destinationLng }
        : null;

    const data = rideSimulationService.estimateMinFare({
      pickupCoords,
      destinationCoords,
      rideType,
    });
    return res.json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    next(err);
  }
}

module.exports = {
  compare,
  estimateMin,
};

