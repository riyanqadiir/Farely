const rideSimulationService = require("../service/rideSimulation.service");
const RideSearchLog = require("../model/RideSearchLog.model");
const ProviderSelectionLog = require("../model/ProviderSelectionLog.model");

function parseCarAcFlag(carAc) {
  return carAc === true || carAc === "true" || carAc === 1 || carAc === "1";
}

/** AC option only applies when ride type is car. */
function effectiveCarAc(rideType, carAcFlag) {
  const rt = String(rideType || "car").trim().toLowerCase();
  return rt === "car" && Boolean(carAcFlag);
}

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
      carAc,
      rideId,
      action,
      paymentMethod,
      paymentMethodId,
    } = req.body || {};

    const carAcEffective = effectiveCarAc(rideType, parseCarAcFlag(carAc));

    const isBookMode = Boolean(rideId) || action === "book";
    if (isBookMode) {
      const data = rideSimulationService.bookRide(rideId);
      return res.json({ ...data, payment: { method: paymentMethod || "cash", paymentMethodId: paymentMethodId || null } });
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
      carAc: carAcEffective,
    });
    const searchLog = await RideSearchLog.create({
      userId: req.userId,
      pickup,
      destination,
      pickupCoords,
      destinationCoords,
      rideType: data.rideType,
      carAc: Boolean(data.carAc),
      distanceKm: data.distanceKm,
      baseFare: data.baseFare,
      perKmRate: data.perKmRate,
      estimateNotice: data.estimateNotice || "",
      comparisons: (data.comparisons || []).map((item) => ({
        provider: item.provider,
        name: item.name,
        fare: item.fare,
        eta: item.eta,
        estimateConfidence: item.estimateConfidence,
      })),
    });
    data.searchLogId = searchLog._id;
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
      carAc,
    } = req.body || {};

    const carAcEffective = effectiveCarAc(rideType, parseCarAcFlag(carAc));

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
      carAc: carAcEffective,
    });
    return res.json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    next(err);
  }
}

async function logProviderSelection(req, res, next) {
  try {
    const {
      searchLogId,
      provider,
      rideType,
      carAc,
      estimatedFare,
      redirectAttempted,
      redirectSucceeded,
      redirectMode,
      failureReason,
    } = req.body || {};

    const carAcEffective = effectiveCarAc(rideType || "car", parseCarAcFlag(carAc));

    if (!provider) {
      return res.status(400).json({ msg: "provider is required" });
    }

    const created = await ProviderSelectionLog.create({
      userId: req.userId,
      searchLogId: searchLogId || null,
      provider,
      rideType: rideType || "car",
      carAc: carAcEffective,
      estimatedFare: typeof estimatedFare === "number" ? estimatedFare : null,
      redirectAttempted: Boolean(redirectAttempted),
      redirectSucceeded: Boolean(redirectSucceeded),
      redirectMode: redirectMode || "unknown",
      failureReason: failureReason || "",
    });

    return res.status(201).json({ success: true, id: created._id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  compare,
  estimateMin,
  logProviderSelection,
};

