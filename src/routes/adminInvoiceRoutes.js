const express = require("express");
const router = express.Router();
const {
  getAllInvoicesForAdmin,
  mergeInvoices,
  getMergedInvoices,
  getMergedInvoiceDetails,
  getAvailableForMerge,
  downloadInvoice,
  deleteMergedInvoice,
  getAdminInvoiceStats,
} = require("../controllers/adminInvoiceController");
const { protect, authorize } = require("../middleware/auth");

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(authorize("admin"));

// @route   GET /api/admin/invoices/stats
// @desc    Get admin invoice statistics
// @access  Private/Admin
router.get("/stats", getAdminInvoiceStats);

// @route   GET /api/admin/invoices/available-for-merge
// @desc    Get invoices available for merging (non-merged, non-cancelled)
// @access  Private/Admin
router.get("/available-for-merge", getAvailableForMerge);

// @route   GET /api/admin/invoices/merged
// @desc    Get all merged invoices
// @access  Private/Admin
router.get("/merged", getMergedInvoices);

// @route   GET /api/admin/invoices/merged/:id
// @desc    Get merged invoice with full source invoice details
// @access  Private/Admin
router.get("/merged/:id", getMergedInvoiceDetails);

// @route   DELETE /api/admin/invoices/merged/:id
// @desc    Delete a merged invoice (source invoices remain intact)
// @access  Private/Admin
router.delete("/merged/:id", deleteMergedInvoice);

// @route   POST /api/admin/invoices/merge
// @desc    Merge multiple invoices into one
// @access  Private/Admin
router.post("/merge", mergeInvoices);

// @route   GET /api/admin/invoices/:id/download
// @desc    Download invoice file
// @access  Private/Admin
router.get("/:id/download", downloadInvoice);

// @route   GET /api/admin/invoices
// @desc    Get all invoices with admin filters
// @access  Private/Admin
router.get("/", getAllInvoicesForAdmin);

module.exports = router;
