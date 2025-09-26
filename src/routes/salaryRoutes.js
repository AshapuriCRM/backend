const express = require('express');
const {
  createBulkSalarySlips,
  getCompanySalarySlips,
  getSalarySlip,
  updateSalarySlip,
  approveSalarySlip,
  markSalarySlipPaid,
  deleteSalarySlip,
  getSalaryStats
} = require('../controllers/salaryController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Salary slip routes
router.post('/create-bulk', createBulkSalarySlips);
router.get('/company/:companyId', getCompanySalarySlips);
router.get('/stats/:companyId', getSalaryStats);
router.get('/:id', getSalarySlip);
router.put('/:id', updateSalarySlip);
router.put('/:id/approve', approveSalarySlip);
router.put('/:id/pay', markSalarySlipPaid);
router.delete('/:id', deleteSalarySlip);

module.exports = router;