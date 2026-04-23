const rideSimulationService = require("../service/rideSimulation.service");
const RideSearchLog = require("../model/RideSearchLog.model");
const ProviderSelectionLog = require("../model/ProviderSelectionLog.model");
const RideHandoff = require("../model/RideHandoff.model");

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
    } = req.body || {};

    const carAcEffective = effectiveCarAc(rideType, parseCarAcFlag(carAc));

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

async function recordRideHandoff(req, res, next) {
  try {
    const {
      searchLogId,
      selectionLogId,
      pickup,
      destination,
      pickupCoords,
      destinationCoords,
      rideType,
      carAc,
      provider,
      providerRideName,
      estimatedFare,
      redirectSucceeded,
      redirectMode,
      failureReason,
      openedUrl,
    } = req.body || {};

    const carAcEffective = effectiveCarAc(rideType || "car", parseCarAcFlag(carAc));

    if (!provider || typeof provider !== "string") {
      return res.status(400).json({ msg: "provider is required" });
    }

    const doc = await RideHandoff.create({
      userId: req.userId,
      searchLogId: searchLogId || null,
      selectionLogId: selectionLogId || null,
      pickup: pickup || "",
      destination: destination || "",
      ...(pickupCoords && typeof pickupCoords.latitude === "number"
        && typeof pickupCoords.longitude === "number"
        ? { pickupCoords }
        : {}),
      ...(destinationCoords && typeof destinationCoords.latitude === "number"
        && typeof destinationCoords.longitude === "number"
        ? { destinationCoords }
        : {}),
      rideType: rideType || "car",
      carAc: carAcEffective,
      provider: provider.trim(),
      providerRideName: providerRideName || "",
      estimatedFare: typeof estimatedFare === "number" ? estimatedFare : null,
      redirectSucceeded: Boolean(redirectSucceeded),
      redirectMode: redirectMode || "unknown",
      failureReason: failureReason || "",
      openedUrl: typeof openedUrl === "string" ? openedUrl.slice(0, 2000) : "",
      status: redirectSucceeded ? "handoff_opened" : "handoff_failed",
    });

    return res.status(201).json({ success: true, id: doc._id });
  } catch (err) {
    next(err);
  }
}

async function confirmRideHandoff(req, res, next) {
  try {
    const { handoffId, taken } = req.body || {};
    if (!handoffId) {
      return res.status(400).json({ msg: "handoffId is required" });
    }
    if (typeof taken !== "boolean") {
      return res.status(400).json({ msg: "taken must be boolean" });
    }

    const handoff = await RideHandoff.findOne({ _id: handoffId, userId: req.userId });
    if (!handoff) {
      return res.status(404).json({ msg: "Ride handoff not found" });
    }

    handoff.userConfirmedTaken = taken;
    handoff.userConfirmedAt = new Date();
    handoff.status = taken ? "ride_confirmed" : "ride_not_taken";
    await handoff.save();

    return res.json({ success: true, id: handoff._id, status: handoff.status });
  } catch (err) {
    next(err);
  }
}

async function listRideHistory(req, res, next) {
  try {
    const docs = await RideHandoff.find({
      userId: req.userId,
      status: "ride_confirmed",
      userConfirmedTaken: true,
    })
      .sort({ userConfirmedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ success: true, rides: docs });
  } catch (err) {
    next(err);
  }
}

async function listPendingRideReviews(req, res, next) {
  try {
    const docs = await RideHandoff.find({
      userId: req.userId,
      redirectSucceeded: true,
      status: "handoff_opened",
      userConfirmedTaken: null,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ success: true, rides: docs });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  compare,
  estimateMin,
  logProviderSelection,
  recordRideHandoff,
  confirmRideHandoff,
  listRideHistory,
  listPendingRideReviews,
};

