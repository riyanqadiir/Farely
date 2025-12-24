const { Signup } = require("../controller/auth.controller");

const express = require("express");
const router = express.Router();


router.post("/signup", Signup);

module.exports = router