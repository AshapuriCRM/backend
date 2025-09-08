const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/attendance');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Excel, and image files are allowed.'));
    }
  }
}).single('attendanceFile');

// @desc    Process attendance file with AI
// @route   POST /api/invoices/process-attendance
// @access  Private
const processAttendanceFile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { companyId, perDayRate = 466 } = req.body;

      // Validate company exists
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      // Create form data for AI service
      const FormData = require('form-data');
      const formData = new FormData();
      const fileBuffer = await fs.readFile(req.file.path);
      formData.append('file', fileBuffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });

      // Call AI service
      const axios = require('axios');
      const aiResponse = await axios.post(
        'https://ai-invoice-generator-python.onrender.com/upload/',
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 60000 // 60 second timeout
        }
      );

      // Process AI response
      const cleaned = aiResponse.data.result.replace(/```json|```/g, '');
      const parsed = JSON.parse(cleaned);
      const attendanceData = parsed.extracted_data || [];

      if (!attendanceData.length) {
        return res.status(400).json({
          success: false,
          error: 'No attendance data could be extracted from the file'
        });
      }

      // Calculate salary details
      const processedEmployees = attendanceData.map(employee => {
        const gross = employee.present_day * perDayRate;
        const epf = gross * 0.12;
        const esic = gross * 0.0075;
        const net = gross - (epf + esic);

        return {
          name: employee.name,
          presentDays: employee.present_day,
          totalDays: employee.total_day,
          salary: net
        };
      });

      // Calculate totals
      const totalEmployees = attendanceData.length;
      const totalPresentDays = attendanceData.reduce((sum, emp) => sum + emp.present_day, 0);
      const baseTotal = totalPresentDays * perDayRate;
      
      const serviceCharge = baseTotal * 0.07; // 7%
      const pf = baseTotal * 0.13; // 13%
      const esic = baseTotal * 0.0325; // 3.25%
      const subTotal = baseTotal + pf + esic;
      const roundOffSubTotal = Math.round(subTotal);
      const serviceChargeTotal = serviceCharge;
      const totalBeforeTax = roundOffSubTotal + serviceChargeTotal;
      const cgst = totalBeforeTax * 0.09; // 9%
      const sgst = totalBeforeTax * 0.09; // 9%
      const grandTotal = Math.round(totalBeforeTax + cgst + sgst);

      // Create invoice record
      const invoice = new Invoice({
        companyId,
        fileName: req.file.originalname,
        fileType: getFileType(req.file.originalname),
        fileUrl: `/uploads/attendance/${req.file.filename}`,
        fileSize: req.file.size,
        taxType: 'gst', // Default to GST
        paymentMethod: 'paid-by-us', // Default
        billDetails: {
          baseAmount: baseTotal,
          serviceCharge: serviceChargeTotal,
          pfAmount: pf,
          esicAmount: esic,
          gstAmount: cgst + sgst,
          totalAmount: grandTotal
        },
        attendanceData: {
          totalEmployees,
          totalPresentDays,
          perDayRate: perDayRate,
          workingDays: Math.max(...attendanceData.map(emp => emp.total_day))
        },
        processedData: {
          extractedEmployees: processedEmployees,
          processingStatus: 'completed',
          processingDate: new Date()
        },
        createdBy: req.user._id
      });

      await invoice.save();

      res.status(200).json({
        success: true,
        data: {
          invoice,
          attendanceData,
          stats: {
            totalEmployees,
            totalPresentDays,
            totalGross: baseTotal,
            totalNet: processedEmployees.reduce((sum, emp) => sum + emp.salary, 0)
          },
          calculations: {
            baseTotal,
            serviceCharge: serviceChargeTotal,
            pf,
            esic,
            cgst,
            sgst,
            grandTotal
          }
        }
      });
    });
  } catch (error) {
    console.error('Error processing attendance file:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error processing attendance file'
    });
  }
};

// Helper function to determine file type
const getFileType = (fileName) => {
  const extension = fileName.toLowerCase().split('.').pop();
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'xlsx':
    case 'xls':
      return 'excel';
    case 'jpg':
    case 'jpeg':
    case 'png':
      return 'image';
    default:
      return 'unknown';
  }
};

// @desc    Get all invoices for a company
// @route   GET /api/invoices/company/:companyId
// @access  Private
const getCompanyInvoices = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10, status, paymentStatus } = req.query;

    // Build query
    const query = { companyId };
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const invoices = await Invoice.find(query)
      .populate('companyId', 'name location')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single invoice by ID
// @route   GET /api/invoices/:id
// @access  Private
const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('companyId')
      .populate('createdBy', 'name email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
const updateInvoice = async (req, res) => {
  try {
    const { status, paymentStatus, billTo, notes } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Update allowed fields
    if (status) invoice.status = status;
    if (paymentStatus) {
      invoice.paymentStatus = paymentStatus;
      if (paymentStatus === 'paid') {
        invoice.paymentDate = new Date();
      }
    }
    if (billTo) invoice.billTo = { ...invoice.billTo, ...billTo };
    if (notes !== undefined) invoice.notes = notes;

    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Delete associated file
    if (invoice.fileUrl) {
      const filePath = path.join(__dirname, '../../', invoice.fileUrl);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats/:companyId
// @access  Private
const getInvoiceStats = async (req, res) => {
  try {
    const { companyId } = req.params;

    const stats = await Invoice.aggregate([
      { $match: { companyId: mongoose.Types.ObjectId(companyId) } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$billDetails.totalAmount' },
          paidAmount: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                '$billDetails.totalAmount',
                0
              ]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'pending'] },
                '$billDetails.totalAmount',
                0
              ]
            }
          },
          draftCount: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          sentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  processAttendanceFile,
  getCompanyInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats
};