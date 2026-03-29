// In-memory ride simulation (no database).
// Stores booking data by rideId for the duration of the server process.

const activeBookings = new Map();

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function calcEtaMinutes(distanceKm, avgSpeedKmh = 30) {
  const minutes = (distanceKm / avgSpeedKmh) * 60;
  return Math.max(1, Math.round(minutes));
}

const PRICING = {
  // Calibrated so that for a 2km journey:
  // bike=200, rickshaw=275, car=350 (PKR)
  bike: { base: 0, perKm: 100 },
  rickshaw: { base: 0, perKm: 137.5 },
  car: { base: 0, perKm: 175 },
  // Premium kept higher for demo realism
  premium: { base: 0, perKm: 250 },
};

function calcPrice(type, distanceKm) {
  const pricing = PRICING[type] || PRICING.car;
  return pricing.base + distanceKm * pricing.perKm;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function generateRider() {
  const firstNames = ['Ali', 'Ahmed', 'Bilal', 'Hassan', 'Ahsan', 'Umer', 'Fahad', 'Usman', 'Zain'];
  const lastNames = ['Khan', 'Ahmed', 'Hussain', 'Raza', 'Malik', 'Qureshi', 'Siddiqui', 'Sheikh', 'Mughal', 'Chaudhry'];

  const name = `${randomFrom(firstNames)} ${randomFrom(lastNames)}`;
  const phone = `+92${randomInt(3000000000, 4999999999)}`;
  const numberPlate = `LE-${randomInt(1000, 9999)}`;

  return { name, phone, numberPlate };
}

function generateDriver() {
  const firstNames = ['Omar', 'Saad', 'Hamza', 'Yasir', 'Waqas', 'Asad', 'Irfan', 'Tahir', 'Noman', 'Majid'];
  const lastNames = ['Khan', 'Butt', 'Malik', 'Qureshi', 'Chaudhry', 'Hussain', 'Raza', 'Sher', 'Abbas'];
  const vehicles = ['Car', 'Sedan', 'Hatchback', 'SUV'];

  const name = `${randomFrom(firstNames)} ${randomFrom(lastNames)}`;
  const phone = `+92${randomInt(3000000000, 4999999999)}`;
  const numberPlate = `DR-${randomInt(1000, 9999)}`;
  const vehicleType = randomFrom(vehicles);

  return { name, phone, numberPlate, vehicleType };
}

function randomPointWithinRadiusKm(center, radiusKm) {
  const bearing = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radiusKm;
  const lat = center.latitude;
  const lon = center.longitude;

  const newLat = lat + (distance / 111.32) * Math.cos(bearing);
  const newLon = lon + (distance / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(bearing);

  return { latitude: newLat, longitude: newLon };
}

const PROVIDER_PRICING = {
  Careem: { multiplier: 1.0, baseAdd: 0 },
  Yango: { multiplier: 0.97, baseAdd: 0 },
  Uber: { multiplier: 1.05, baseAdd: 0 },
};

const TICKETS = {
  Careem: [
    { tier: 'Standard', multiplier: 1.0, etaMultiplier: 1.05 },
    { tier: 'Plus', multiplier: 1.12, etaMultiplier: 0.95 },
  ],
  Yango: [
    { tier: 'Standard', multiplier: 0.98, etaMultiplier: 1.0 },
    { tier: 'Comfort', multiplier: 1.1, etaMultiplier: 0.92 },
  ],
  Uber: [
    { tier: 'Standard', multiplier: 1.0, etaMultiplier: 1.0 },
    { tier: 'XL', multiplier: 1.25, etaMultiplier: 0.9 },
  ],
};

const optionNames = {
  Careem: { rickshaw: 'Careem Rickshaw', bike: 'Careem Bike', car: 'Careem Go', premium: 'Careem Business' },
  Yango: { rickshaw: 'Yango Rickshaw', bike: 'Yango Moto', car: 'Yango Comfort', premium: 'Yango Premier' },
  Uber: { rickshaw: 'Uber Auto', bike: 'Uber Moto', car: 'UberX', premium: 'Uber Black' },
};

const pricingTypeByRideType = {
  rickshaw: 'rickshaw',
  bike: 'bike',
  car: 'car',
  premium: 'premium',
};

function findRides({ pickup, destination, pickupCoords, destinationCoords, rideType }) {
  if (!pickup || !destination) {
    const err = new Error('Please provide pickup and destination');
    err.statusCode = 400;
    throw err;
  }

  const distanceKm = pickupCoords && destinationCoords
    ? haversineKm(
      pickupCoords.latitude,
      pickupCoords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude
    )
    : (Math.random() * 10 + 2);

  const normalizedRideType = String(rideType || 'car').trim().toLowerCase();
  const pricingType = pricingTypeByRideType[normalizedRideType] || 'car';

  const baseId = Date.now();
  const providers = ['Careem', 'Yango', 'Uber'];
  const catalog = providers.flatMap((provider) => {
    const tickets = TICKETS[provider] || [{ tier: 'Standard', multiplier: 1.0, etaMultiplier: 1.0 }];
    const baseName = optionNames[provider]?.[normalizedRideType] || provider;
    return tickets.map((t, idx) => ({
      provider,
      name: `${baseName} ${t.tier}`.trim(),
      pricingType,
      id: `${provider.toLowerCase()}_${baseId}_${idx}_${Math.floor(Math.random() * 10000)}`,
      etaMultiplier: t.etaMultiplier,
      fareMultiplier: t.multiplier,
    }));
  });

  const comparisons = catalog.map((opt) => {
    const rider = generateRider();
    const etaMins = calcEtaMinutes(distanceKm * opt.etaMultiplier);
    const providerPricing = PROVIDER_PRICING[opt.provider] || { multiplier: 1.0, baseAdd: 0 };
    const basePrice = calcPrice(opt.pricingType, distanceKm);
    const fare = Math.max(
      50,
      Math.round((basePrice + providerPricing.baseAdd) * providerPricing.multiplier * opt.fareMultiplier)
    );

    const rideOption = {
      provider: opt.provider,
      name: opt.name,
      fare,
      eta: `${etaMins} mins`,
      rideType: normalizedRideType,
      distanceKm: Number(distanceKm.toFixed(2)),
      id: opt.id,
      rider,
    };

    activeBookings.set(String(opt.id), {
      rideOption,
      pickupCoords,
      destinationCoords,
      rider,
      driver: null,
      driverLocation: null,
      status: 'Searching',
      createdAt: Date.now(),
    });

    return rideOption;
  });

  return comparisons;
}

function bookRide(rideId) {
  if (!rideId) {
    const err = new Error('rideId is required to book');
    err.statusCode = 400;
    throw err;
  }

  const booking = activeBookings.get(String(rideId));
  if (!booking) {
    const err = new Error('Ride not found');
    err.statusCode = 404;
    throw err;
  }

  const driver = booking.driver || generateDriver();
  const pickupCoords = booking.pickupCoords;
  const driverLocation = pickupCoords
    ? randomPointWithinRadiusKm(pickupCoords, 1.5)
    : randomPointWithinRadiusKm({ latitude: 24.8607, longitude: 67.0011 }, 1.5);

  booking.driver = driver;
  booking.status = 'Driver Assigned';
  booking.driverLocation = driverLocation;

  return {
    rideId: String(rideId),
    status: booking.status,
    driver,
    driverLocation,
  };
}

module.exports = {
  findRides,
  bookRide,
};

