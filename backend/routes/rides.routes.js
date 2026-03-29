const express = require("express");
const router = express.Router();
const ridesController = require("../controller/rides.controller");
const { protect } = require("../middleware/auth.middleware");

// Require auth like other protected resources.
router.use(protect);

// POST /rides/compare
router.post("/compare", ridesController.compare);

module.exports = router;

