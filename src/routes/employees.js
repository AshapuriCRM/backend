const express = require("express");
const {
  createEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeesByCompany,
  updateEmployeeStatus,
  searchEmployees,
  getEmployeeStats,
} = require("../controllers/employeeController");
const { protect } = require("../middleware/auth");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

const router = express.Router();
const { uploadEmployeePhotoOptional } = require("../middleware/imageUpload");

// Validation rules
const createEmployeeValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Employee name must be between 2 and 100 characters"),
  body("email")
    .optional()
    .isString()
    .withMessage("Please provide a valid email"),
  body("phone")
    .matches(/^[+]?[\d\s-()]{10,15}$/)
    .withMessage("Please provide a valid phone number"),
  body("category")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),
  body("categoryId")
    .optional()
    .isMongoId()
    .withMessage("Please provide a valid category ID"),
  body("salary")
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Salary must be a positive number"),
  body("companyId")
    .isMongoId()
    .withMessage("Please provide a valid company ID"),
  body("dateJoined")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date"),
  body("dob")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date of birth")
    .custom((value) => {
      if (value) {
        const dob = new Date(value);
        const age = (new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 18 || age > 100) {
          throw new Error("Employee age must be between 18 and 100 years");
        }
      }
      return true;
    }),
  // Address (optional)
  body("address.street").optional().isString().trim(),
  body("address.city").optional().isString().trim(),
  body("address.state").optional().isString().trim(),
  body("address.pinCode").optional().isString().trim(),
  body("address.country").optional().isString().trim(),
  // Documents (optional container)
  body("documents.aadhar").optional().isString().trim(),
  body("documents.pan").optional().isString().trim(),
  body("documents.uan").optional().isString().trim(),
  // Bank account (required in schema)
  body("documents.bankAccount.accountNumber")
    .exists({ checkFalsy: true })
    .withMessage("Account number is required")
    .bail()
    .isString()
    .trim(),
  body("documents.bankAccount.ifscCode")
    .exists({ checkFalsy: true })
    .withMessage("IFSC code is required")
    .bail()
    .isString()
    .trim(),
  body("documents.bankAccount.bankName")
    .exists({ checkFalsy: true })
    .withMessage("Bank name is required")
    .bail()
    .isString()
    .trim(),
  // Photo (optional)
  body("documents.photo").optional().isString().trim(),
  // PF (optional)
  body("pf.type")
    .optional()
    .isIn(["percentage", "fixed"])
    .withMessage("PF type must be 'percentage' or 'fixed'"),
  body("pf.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("PF value must be a positive number"),
  // ESIC (optional)
  body("esic.type")
    .optional()
    .isIn(["percentage", "fixed"])
    .withMessage("ESIC type must be 'percentage' or 'fixed'"),
  body("esic.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("ESIC value must be a positive number"),
  // Emergency contact (optional)
  body("emergencyContact.name").optional().isString().trim(),
  body("emergencyContact.relationship").optional().isString().trim(),
  body("emergencyContact.phone").optional().isString().trim(),
  // Work schedule (optional container, but with constraints)
  body("workSchedule.shiftType")
    .optional()
    .isIn(["day", "night", "rotating"])
    .withMessage("shiftType must be one of day, night, rotating"),
  body("workSchedule.workingDays")
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage("workingDays must be between 1 and 31"),
  body("workSchedule.workingHours")
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage("workingHours must be between 1 and 24"),
];

const updateEmployeeValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Employee name must be between 2 and 100 characters"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("phone")
    .optional()
    .matches(/^[+]?[\d\s-()]{10,15}$/)
    .withMessage("Please provide a valid phone number"),
  body("category")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),
  body("categoryId")
    .optional()
    .isMongoId()
    .withMessage("Please provide a valid category ID"),
  body("salary")
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Salary must be a positive number"),
  body("companyId")
    .optional()
    .isMongoId()
    .withMessage("Please provide a valid company ID"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "terminated", "on-leave"])
    .withMessage("Status must be active, inactive, terminated, or on-leave"),
  body("dateJoined")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date"),
  body("dob")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date of birth")
    .custom((value) => {
      if (value) {
        const dob = new Date(value);
        const age = (new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 18 || age > 100) {
          throw new Error("Employee age must be between 18 and 100 years");
        }
      }
      return true;
    }),
  // Address (optional fields)
  body("address.street").optional().isString().trim(),
  body("address.city").optional().isString().trim(),
  body("address.state").optional().isString().trim(),
  body("address.pinCode").optional().isString().trim(),
  body("address.country").optional().isString().trim(),
  // Documents
  body("documents.aadhar").optional().isString().trim(),
  body("documents.pan").optional().isString().trim(),
  body("documents.uan").optional().isString().trim(),
  body("documents.bankAccount.accountNumber").optional().isString().trim(),
  body("documents.bankAccount.ifscCode").optional().isString().trim(),
  body("documents.bankAccount.bankName").optional().isString().trim(),
  body("documents.photo").optional().isString().trim(),
  // PF (optional)
  body("pf.type")
    .optional()
    .isIn(["percentage", "fixed"])
    .withMessage("PF type must be 'percentage' or 'fixed'"),
  body("pf.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("PF value must be a positive number"),
  // ESIC (optional)
  body("esic.type")
    .optional()
    .isIn(["percentage", "fixed"])
    .withMessage("ESIC type must be 'percentage' or 'fixed'"),
  body("esic.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("ESIC value must be a positive number"),
  // Emergency contact
  body("emergencyContact.name").optional().isString().trim(),
  body("emergencyContact.relationship").optional().isString().trim(),
  body("emergencyContact.phone").optional().isString().trim(),
  // Work schedule
  body("workSchedule.shiftType")
    .optional()
    .isIn(["day", "night", "rotating"])
    .withMessage("shiftType must be one of day, night, rotating"),
  body("workSchedule.workingDays")
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage("workingDays must be between 1 and 31"),
  body("workSchedule.workingHours")
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage("workingHours must be between 1 and 24"),
];

const statusUpdateValidation = [
  body("status")
    .isIn(["active", "inactive", "terminated", "on-leave"])
    .withMessage("Status must be active, inactive, terminated, or on-leave"),
];

// Apply authentication middleware to all routes
router.use(protect);

// @route   GET /api/employees/stats
// @desc    Get employee statistics
// @access  Private
router.get("/stats", getEmployeeStats);

// @route   GET /api/employees/search
// @desc    Search employees
// @access  Private
router.get("/search", searchEmployees);

// @route   GET /api/employees/company/:companyId
// @desc    Get employees by company
// @access  Private
router.get("/company/:companyId", getEmployeesByCompany);

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private
// Accept multipart/form-data with optional photo field
router.post(
  "/",
  uploadEmployeePhotoOptional,
  createEmployeeValidation,
  validate,
  createEmployee
);

// @route   GET /api/employees
// @desc    Get all employees with pagination
// @access  Private
router.get("/", getEmployees);

// @route   GET /api/employees/:id
// @desc    Get single employee
// @access  Private
router.get("/:id", getEmployee);

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private
// Accept multipart/form-data with optional photo field
router.put(
  "/:id",
  uploadEmployeePhotoOptional,
  updateEmployeeValidation,
  validate,
  updateEmployee
);

// @route   PUT /api/employees/:id/status
// @desc    Update employee status
// @access  Private
router.put(
  "/:id/status",
  statusUpdateValidation,
  // validate,
  updateEmployeeStatus
);

// @route   DELETE /api/employees/:id
// @desc    Delete employee
// @access  Private
router.delete("/:id", deleteEmployee);

module.exports = router;
