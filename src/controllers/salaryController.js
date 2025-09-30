const SalarySlip = require('../models/SalarySlip');
const Employee = require('../models/Employee');
const Company = require('../models/Company');
const mongoose = require('mongoose');

// @desc    Create salary slips for multiple employees
// @route   POST /api/salary/create-bulk
// @access  Private
const createBulkSalarySlips = async (req, res) => {
  console.log("> reached POST /api/salary/create-bulk")
  try {
    const { companyId, month, year, employees, payPeriod } = req.body;
    console.log({...req.body})

    // Validate company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Validate required fields
    if (!month || !year || !employees || !Array.isArray(employees)) {
      return res.status(400).json({
        success: false,
        error: 'Month, year, and employees array are required'
      });
    }

    const salarySlips = [];
    const errors = [];

    for (const empData of employees) {
      try {
        // Check if employee exists
        const employee = await Employee.findById(empData.employeeId);
        if (!employee) {
          errors.push(`Employee with ID ${empData.employeeId} not found`);
          continue;
        }

        // Check if salary slip already exists for this employee, month, and year
        const existingSlip = await SalarySlip.findOne({
          employeeId: empData.employeeId,
          month,
          year
        });

        if (existingSlip) {
          errors.push(`Salary slip already exists for ${employee.name} for ${month} ${year}`);
          continue;
        }

        // Calculate salary components
        const basicSalary = empData.basicSalary || employee.salary || 0;
        const daysPresent = empData.daysPresent || 0;
        const totalWorkingDays = empData.totalWorkingDays || 30;
        const bonus = empData.bonus || 0;

        // Calculate gross salary based on attendance
        const dailySalary = basicSalary / totalWorkingDays;
        const earnedSalary = dailySalary * daysPresent;
        
        // Calculate deductions
        const pfEmployeeContribution = earnedSalary * ((empData.pfPercentage || 12) / 100);
        const esicEmployeeContribution = earnedSalary * ((empData.esicPercentage || 0.75) / 100);
        const pfEmployerContribution = earnedSalary * 0.12; // Standard 12%
        const esicEmployerContribution = earnedSalary * 0.0325; // Standard 3.25%

        // Create salary slip
        const salarySlip = new SalarySlip({
          employeeId: empData.employeeId,
          companyId,
          month,
          year,
          payPeriod: payPeriod || {
            startDate: new Date(year, new Date(Date.parse(month +" 1, 2012")).getMonth(), 1),
            endDate: new Date(year, new Date(Date.parse(month +" 1, 2012")).getMonth() + 1, 0)
          },
          attendance: {
            totalWorkingDays,
            daysPresent,
            daysAbsent: totalWorkingDays - daysPresent,
            overtimeHours: empData.overtimeHours || 0
          },
          salary: {
            basicSalary,
            allowances: {
              hra: empData.hra || 0,
              transport: empData.transport || 0,
              medical: empData.medical || 0,
              special: empData.special || 0,
              overtime: empData.overtime || 0
            },
            grossSalary: earnedSalary
          },
          deductions: {
            pf: {
              employeeContribution: pfEmployeeContribution,
              employerContribution: pfEmployerContribution
            },
            esic: {
              employeeContribution: esicEmployeeContribution,
              employerContribution: esicEmployerContribution
            },
            tax: {
              tds: empData.tds || 0,
              professionalTax: empData.professionalTax || 0
            },
            other: {
              advance: empData.advance || 0,
              loan: empData.loan || 0,
              penalty: empData.penalty || 0
            }
          },
          bonus,
          createdBy: req.user._id
        });

        await salarySlip.save();
        salarySlips.push(salarySlip);

      } catch (error) {
        errors.push(`Error creating salary slip for employee ${empData.employeeId}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        created: salarySlips.length,
        salarySlips,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    console.error('Error creating bulk salary slips:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error creating salary slips'
    });
  }
};

// @desc    Get salary slips for a company
// @route   GET /api/salary/company/:companyId
// @access  Private
const getCompanySalarySlips = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, year, status, employeeId, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { companyId };
    if (month) query.month = month;
    if (year) query.year = parseInt(year);
    if (status) query.status = status;
    if (employeeId) query.employeeId = employeeId;

    const salarySlips = await SalarySlip.find(query)
      .populate('employeeId', 'name email phone category')
      .populate('companyId', 'name location')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SalarySlip.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        salarySlips,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching salary slips:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching salary slips'
    });
  }
};

// @desc    Get single salary slip by ID
// @route   GET /api/salary/:id
// @access  Private
const getSalarySlip = async (req, res) => {
  try {
    const salarySlip = await SalarySlip.findById(req.params.id)
      .populate('employeeId')
      .populate('companyId')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!salarySlip) {
      return res.status(404).json({
        success: false,
        error: 'Salary slip not found'
      });
    }

    res.status(200).json({
      success: true,
      data: salarySlip
    });

  } catch (error) {
    console.error('Error fetching salary slip:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching salary slip'
    });
  }
};

// @desc    Update salary slip
// @route   PUT /api/salary/:id
// @access  Private
const updateSalarySlip = async (req, res) => {
  try {
    const salarySlip = await SalarySlip.findById(req.params.id);
    
    if (!salarySlip) {
      return res.status(404).json({
        success: false,
        error: 'Salary slip not found'
      });
    }

    // Only allow updates to draft status salary slips
    if (salarySlip.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Can only update draft salary slips'
      });
    }

    const allowedFields = [
      'attendance', 'salary', 'deductions', 'bonus', 'paymentInfo', 'notes'
    ];

    // Update allowed fields
    Object.keys(req.body).forEach(field => {
      if (allowedFields.includes(field)) {
        if (typeof req.body[field] === 'object' && req.body[field] !== null) {
          salarySlip[field] = { ...salarySlip[field], ...req.body[field] };
        } else {
          salarySlip[field] = req.body[field];
        }
      }
    });

    await salarySlip.save();

    res.status(200).json({
      success: true,
      data: salarySlip
    });

  } catch (error) {
    console.error('Error updating salary slip:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error updating salary slip'
    });
  }
};

// @desc    Approve salary slip
// @route   PUT /api/salary/:id/approve
// @access  Private
const approveSalarySlip = async (req, res) => {
  try {
    const salarySlip = await SalarySlip.findById(req.params.id);
    
    if (!salarySlip) {
      return res.status(404).json({
        success: false,
        error: 'Salary slip not found'
      });
    }

    if (salarySlip.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Can only approve draft salary slips'
      });
    }

    salarySlip.status = 'approved';
    salarySlip.approvedBy = req.user._id;
    salarySlip.approvedAt = new Date();

    await salarySlip.save();

    res.status(200).json({
      success: true,
      data: salarySlip
    });

  } catch (error) {
    console.error('Error approving salary slip:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error approving salary slip'
    });
  }
};

// @desc    Mark salary slip as paid
// @route   PUT /api/salary/:id/pay
// @access  Private
const markSalarySlipPaid = async (req, res) => {
  try {
    const { paymentDate, paymentMethod, transactionId, bankDetails } = req.body;
    
    const salarySlip = await SalarySlip.findById(req.params.id);
    
    if (!salarySlip) {
      return res.status(404).json({
        success: false,
        error: 'Salary slip not found'
      });
    }

    if (salarySlip.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Can only mark approved salary slips as paid'
      });
    }

    salarySlip.status = 'paid';
    salarySlip.paymentInfo = {
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || 'bank-transfer',
      transactionId,
      bankDetails
    };

    await salarySlip.save();

    res.status(200).json({
      success: true,
      data: salarySlip
    });

  } catch (error) {
    console.error('Error marking salary slip as paid:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error updating payment status'
    });
  }
};

// @desc    Delete salary slip
// @route   DELETE /api/salary/:id
// @access  Private
const deleteSalarySlip = async (req, res) => {
  try {
    const salarySlip = await SalarySlip.findById(req.params.id);
    
    if (!salarySlip) {
      return res.status(404).json({
        success: false,
        error: 'Salary slip not found'
      });
    }

    // Only allow deletion of draft salary slips
    if (salarySlip.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Can only delete draft salary slips'
      });
    }

    await SalarySlip.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Salary slip deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting salary slip:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error deleting salary slip'
    });
  }
};

// @desc    Get salary statistics
// @route   GET /api/salary/stats/:companyId
// @access  Private
const getSalaryStats = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, year } = req.query;

    // Build match query
    const matchQuery = { companyId: new mongoose.Types.ObjectId(companyId) };
    if (month) matchQuery.month = month;
    if (year) matchQuery.year = parseInt(year);

    const stats = await SalarySlip.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSlips: { $sum: 1 },
          totalPayroll: { $sum: '$totalSalary' },
          totalDeductions: { $sum: '$deductions.totalDeductions' },
          totalBonus: { $sum: '$bonus' },
          averageSalary: { $avg: '$totalSalary' },
          draftCount: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalSlips: 0,
        totalPayroll: 0,
        totalDeductions: 0,
        totalBonus: 0,
        averageSalary: 0,
        draftCount: 0,
        approvedCount: 0,
        paidCount: 0
      }
    });

  } catch (error) {
    console.error('Error fetching salary stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching salary statistics'
    });
  }
};

module.exports = {
  createBulkSalarySlips,
  getCompanySalarySlips,
  getSalarySlip,
  updateSalarySlip,
  approveSalarySlip,
  markSalarySlipPaid,
  deleteSalarySlip,
  getSalaryStats
};
