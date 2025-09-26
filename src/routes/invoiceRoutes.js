const express = require('express');
const router = express.Router();
const {
  createInvoice,
  processAttendanceFile,
  getCompanyInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');
const { validateInvoiceUpdate } = require('../middleware/validate');

// Apply authentication middleware to all routes
router.use(protect);

// @route   POST /api/invoices/create
// @desc    Create invoice from processed attendance data
// @access  Private
router.post('/create', createInvoice);

// @route   POST /api/invoices/process-attendance
// @desc    Process attendance file with AI
// @access  Private
router.post('/process-attendance', processAttendanceFile);

// @route   GET /api/invoices/company/:companyId
// @desc    Get all invoices for a company
// @access  Private
router.get('/company/:companyId', getCompanyInvoices);

// @route   GET /api/invoices/stats/:companyId
// @desc    Get invoice statistics for a company
// @access  Private
router.get('/stats/:companyId', getInvoiceStats);

// @route   GET /api/invoices/:id
// @desc    Get single invoice
// @access  Private
router.get('/:id', getInvoice);

// @route   PUT /api/invoices/:id
// @desc    Update invoice
// @access  Private
router.put('/:id', validateInvoiceUpdate, updateInvoice);

// @route   DELETE /api/invoices/:id
// @desc    Delete invoice
// @access  Private
router.delete('/:id', deleteInvoice);

module.exports = router;