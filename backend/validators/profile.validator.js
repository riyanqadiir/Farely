const { body } = require("express-validator");

const updateProfile = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage("Name cannot exceed 120 characters"),
  body("phone")
    .not()
    .exists()
    .withMessage("Phone number cannot be changed from profile."),
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Provide a valid email")
    .normalizeEmail(),
  body("countryCode")
    .optional()
    .trim()
    .matches(/^\+\d{1,4}$/)
    .withMessage("Invalid country code"),
  body("street").optional().trim().isLength({ max: 200 }).withMessage("Street too long"),
  body("city").optional().trim().isLength({ max: 80 }).withMessage("City too long"),
  body("district").optional().trim().isLength({ max: 80 }).withMessage("District too long"),
];

module.exports = { updateProfile };
