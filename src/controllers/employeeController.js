const Employee = require("../models/Employee");
const Company = require("../models/Company");
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private
const createEmployee = async (req, res) => {
  console.log("> req reached ");
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      name,
      email,
      phone,
      address,
      category,
      categoryId,
      dateJoined,
      salary,
      companyId,
      documents,
      emergencyContact,
      workSchedule,
    } = req.body;

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    // Check if employee with same email already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        error: "Employee with this email already exists",
      });
    }

    // Create employee
    const employee = new Employee({
      name,
      email,
      phone,
      address,
      category,
      categoryId,
      dateJoined,
      salary,
      companyId,
      documents,
      emergencyContact,
      workSchedule,
      createdBy: req.user._id,
    });

    await employee.save();

    // Populate company info before returning
    await employee.populate("companyId", "name location");

    res.status(201).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Create employee error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error creating employee",
    });
  }
};

// @desc    Get all employees with pagination and filters
// @route   GET /api/employees
// @access  Private
const getEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      companyId,
      status,
      category,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    if (companyId) {
      query.companyId = companyId;
    }

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination
    const employees = await Employee.find(query)
      .populate("companyId", "name location")
      .populate("createdBy", "name email")
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Employee.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        employees,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching employees",
    });
  }
};

// @desc    Get single employee by ID
// @route   GET /api/employees/:id
// @access  Private
const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate("companyId", "name location contactInfo")
      .populate("createdBy", "name email");

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching employee",
    });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private
const updateEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    const {
      name,
      email,
      phone,
      address,
      category,
      categoryId,
      dateJoined,
      salary,
      companyId,
      documents,
      emergencyContact,
      workSchedule,
      status,
    } = req.body;

    // Check if email is being changed and if new email already exists
    if (email && email !== employee.email) {
      const existingEmployee = await Employee.findOne({
        email,
        _id: { $ne: req.params.id },
      });

      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          error: "Employee with this email already exists",
        });
      }
    }

    // Check if company exists when changing company
    if (companyId && companyId !== employee.companyId.toString()) {
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: "Company not found",
        });
      }
    }

    // Update fields
    if (name) employee.name = name;
    if (email) employee.email = email;
    if (phone) employee.phone = phone;
    if (address) employee.address = { ...employee.address, ...address };
    if (category) employee.category = category;
    if (categoryId) employee.categoryId = categoryId;
    if (dateJoined) employee.dateJoined = dateJoined;
    if (salary) employee.salary = salary;
    if (companyId) employee.companyId = companyId;
    if (documents) employee.documents = { ...employee.documents, ...documents };
    if (emergencyContact)
      employee.emergencyContact = {
        ...employee.emergencyContact,
        ...emergencyContact,
      };
    if (workSchedule)
      employee.workSchedule = { ...employee.workSchedule, ...workSchedule };
    if (status) employee.status = status;

    await employee.save();

    // Populate company info before returning
    await employee.populate("companyId", "name location");

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Update employee error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error updating employee",
    });
  }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    await Employee.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error deleting employee",
    });
  }
};

// @desc    Get employees by company
// @route   GET /api/employees/company/:companyId
// @access  Private
const getEmployeesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status = "active", limit = 50 } = req.query;

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    const employees = await Employee.find({
      companyId,
      ...(status && { status }),
    })
      .select("name email phone category salary status dateJoined")
      .sort({ name: 1 })
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: {
        company: {
          name: company.name,
          location: company.location,
        },
        employees,
        count: employees.length,
      },
    });
  } catch (error) {
    console.error("Get employees by company error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching employees by company",
    });
  }
};

// @desc    Update employee status
// @route   PUT /api/employees/:id/status
// @access  Private
const updateEmployeeStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive", "terminated", "on-leave"].includes(status)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid status. Must be active, inactive, terminated, or on-leave",
      });
    }

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    employee.status = status;
    await employee.save();

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Update employee status error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error updating employee status",
    });
  }
};

// @desc    Search employees
// @route   GET /api/employees/search
// @access  Private
const searchEmployees = async (req, res) => {
  try {
    const { q, companyId, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search query must be at least 2 characters long",
      });
    }

    const query = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ],
      status: "active",
    };

    if (companyId) {
      query.companyId = companyId;
    }

    const employees = await Employee.find(query)
      .populate("companyId", "name location")
      .select("name email phone category salary companyId")
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Search employees error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error searching employees",
    });
  }
};

// @desc    Get employee statistics
// @route   GET /api/employees/stats
// @access  Private
const getEmployeeStats = async (req, res) => {
  try {
    const { companyId } = req.query;

    const matchStage = companyId
      ? { companyId: new mongoose.Types.ObjectId(companyId) }
      : {};

    const stats = await Employee.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalEmployees: { $sum: 1 },
          activeEmployees: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          inactiveEmployees: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
          terminatedEmployees: {
            $sum: { $cond: [{ $eq: ["$status", "terminated"] }, 1, 0] },
          },
          onLeaveEmployees: {
            $sum: { $cond: [{ $eq: ["$status", "on-leave"] }, 1, 0] },
          },
          averageSalary: { $avg: "$salary" },
          totalSalaryExpense: { $sum: "$salary" },
        },
      },
    ]);

    const result = stats[0] || {
      totalEmployees: 0,
      activeEmployees: 0,
      inactiveEmployees: 0,
      terminatedEmployees: 0,
      onLeaveEmployees: 0,
      averageSalary: 0,
      totalSalaryExpense: 0,
    };

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get employee stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching employee statistics",
    });
  }
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeesByCompany,
  updateEmployeeStatus,
  searchEmployees,
  getEmployeeStats,
};
