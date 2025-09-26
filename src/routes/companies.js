const express = require('express');
const {
  createCompany,
  getCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
  getCompanyStats
} = require('../controllers/companyController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Validation rules
const createCompanyValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('location')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be between 2 and 200 characters'),
  body('contactInfo.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('gstNumber')
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Please provide a valid GST number'),
  body('panNumber')
    .optional()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Please provide a valid PAN number')
];

const updateCompanyValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be between 2 and 200 characters'),
  body('contactInfo.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('gstNumber')
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Please provide a valid GST number'),
  body('panNumber')
    .optional()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Please provide a valid PAN number'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended')
];

// Apply authentication middleware to all routes
router.use(protect);

// @route   GET /api/companies/stats
// @desc    Get company statistics
// @access  Private
router.get('/stats', getCompanyStats);

// @route   GET /api/companies/search
// @desc    Search companies
// @access  Private
router.get('/search', searchCompanies);

// @route   POST /api/companies
// @desc    Create new company
// @access  Private
router.post('/', createCompanyValidation, validate, createCompany);

// @route   GET /api/companies
// @desc    Get all companies with pagination
// @access  Private
router.get('/', getCompanies);

// @route   GET /api/companies/:id
// @desc    Get single company
// @access  Private
router.get('/:id', getCompany);

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private
router.put('/:id', updateCompanyValidation, validate, updateCompany);

// @route   DELETE /api/companies/:id
// @desc    Delete company
// @access  Private
router.delete('/:id', deleteCompany);

module.exports = router;