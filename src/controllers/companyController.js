const Company = require('../models/Company');
const { validationResult } = require('express-validator');

// @desc    Create new company
// @route   POST /api/companies
// @access  Private
const createCompany = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      location,
      address,
      contactInfo,
      gstNumber,
      panNumber,
      contractInfo
    } = req.body;

    // Check if company with same name already exists
    const existingCompany = await Company.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        error: 'Company with this name already exists'
      });
    }

    // Create company
    const company = new Company({
      name,
      location,
      address,
      contactInfo,
      gstNumber,
      panNumber,
      contractInfo,
      createdBy: req.user._id
    });

    await company.save();

    res.status(201).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error creating company'
    });
  }
};

// @desc    Get all companies with pagination and filters
// @route   GET /api/companies
// @access  Private
const getCompanies = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { 'contactInfo.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const companies = await Company.find(query)
      .populate('createdBy', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Company.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        companies,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching companies'
    });
  }
};

// @desc    Get single company by ID
// @route   GET /api/companies/:id
// @access  Private
const getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('actualEmployeeCount');

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching company'
    });
  }
};

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Private
const updateCompany = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const {
      name,
      location,
      address,
      contactInfo,
      gstNumber,
      panNumber,
      contractInfo,
      status
    } = req.body;

    // Check if name is being changed and if new name already exists
    if (name && name !== company.name) {
      const existingCompany = await Company.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingCompany) {
        return res.status(400).json({
          success: false,
          error: 'Company with this name already exists'
        });
      }
    }

    // Update fields
    if (name) company.name = name;
    if (location) company.location = location;
    if (address) company.address = { ...company.address, ...address };
    if (contactInfo) company.contactInfo = { ...company.contactInfo, ...contactInfo };
    if (gstNumber !== undefined) company.gstNumber = gstNumber;
    if (panNumber !== undefined) company.panNumber = panNumber;
    if (contractInfo) company.contractInfo = { ...company.contractInfo, ...contractInfo };
    if (status) company.status = status;

    await company.save();

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error updating company'
    });
  }
};

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Private
const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Check if company has employees (you might want to prevent deletion)
    if (company.employeeCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete company with active employees. Please transfer or remove employees first.'
      });
    }

    await Company.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error deleting company'
    });
  }
};

// @desc    Search companies
// @route   GET /api/companies/search
// @access  Private
const searchCompanies = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    const companies = await Company.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { 'contactInfo.email': { $regex: q, $options: 'i' } }
      ],
      status: 'active'
    })
    .select('name location contactInfo.email employeeCount')
    .limit(parseInt(limit))
    .lean();

    res.status(200).json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Search companies error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error searching companies'
    });
  }
};

// @desc    Get company statistics
// @route   GET /api/companies/stats
// @access  Private
const getCompanyStats = async (req, res) => {
  try {
    const stats = await Company.aggregate([
      {
        $group: {
          _id: null,
          totalCompanies: { $sum: 1 },
          activeCompanies: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveCompanies: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          suspendedCompanies: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
          },
          totalEmployees: { $sum: '$employeeCount' },
          totalContractValue: { $sum: '$contractInfo.contractValue' }
        }
      }
    ]);

    const result = stats[0] || {
      totalCompanies: 0,
      activeCompanies: 0,
      inactiveCompanies: 0,
      suspendedCompanies: 0,
      totalEmployees: 0,
      totalContractValue: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error fetching company statistics'
    });
  }
};

module.exports = {
  createCompany,
  getCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
  getCompanyStats
};