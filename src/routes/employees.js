const express = require('express');
const {
  createEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeesByCompany,
  updateEmployeeStatus,
  searchEmployees,
  getEmployeeStats
} = require('../controllers/employeeController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Validation rules
const createEmployeeValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Employee name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .matches(/^[+]?[\d\s-()]{10,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('category')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters'),
  body('salary')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Salary must be a positive number'),
  body('companyId')
    .isMongoId()
    .withMessage('Please provide a valid company ID'),
  body('dateJoined')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date')
];

const updateEmployeeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Employee name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s-()]{10,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('category')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters'),
  body('salary')
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Salary must be a positive number'),
  body('companyId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid company ID'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'terminated', 'on-leave'])
    .withMessage('Status must be active, inactive, terminated, or on-leave'),
  body('dateJoined')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date')
];

const statusUpdateValidation = [
  body('status')
    .isIn(['active', 'inactive', 'terminated', 'on-leave'])
    .withMessage('Status must be active, inactive, terminated, or on-leave')
];

// Apply authentication middleware to all routes
router.use(protect);

// @route   GET /api/employees/stats
// @desc    Get employee statistics
// @access  Private
router.get('/stats', getEmployeeStats);

// @route   GET /api/employees/search
// @desc    Search employees
// @access  Private
router.get('/search', searchEmployees);

// @route   GET /api/employees/company/:companyId
// @desc    Get employees by company
// @access  Private
router.get('/company/:companyId', getEmployeesByCompany);

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private
router.post('/', createEmployeeValidation, validate, createEmployee);

// @route   GET /api/employees
// @desc    Get all employees with pagination
// @access  Private
router.get('/', getEmployees);

// @route   GET /api/employees/:id
// @desc    Get single employee
// @access  Private
router.get('/:id', getEmployee);

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private
router.put('/:id', updateEmployeeValidation, validate, updateEmployee);

// @route   PUT /api/employees/:id/status
// @desc    Update employee status
// @access  Private
router.put('/:id/status', statusUpdateValidation, validate, updateEmployeeStatus);

// @route   DELETE /api/employees/:id
// @desc    Delete employee
// @access  Private
router.delete('/:id', deleteEmployee);

module.exports = router;