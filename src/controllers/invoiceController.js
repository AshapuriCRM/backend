const Invoice = require("../models/Invoice");
const Company = require("../models/Company");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const mongoose = require("mongoose");
const {
  uploadFileToCloudinary,
  deleteFileFromCloudinary,
} = require("../utils/cloudinaryUpload");

// Helper function to calculate overtime threshold based on working days in month
const getOvertimeThreshold = (totalDays) => {
  // 30-day month: threshold is 26 days
  // 31-day month: threshold is 27 days
  // 28-day month: threshold is 24 days
  // 29-day month: threshold is 25 days
  // Formula: totalDays - 4
  return totalDays - 4;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads/attendance");
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, Excel, and image files are allowed."
        )
      );
    }
  },
}).single("attendanceFile");

// @desc    Create invoice from processed attendance data
// @route   POST /api/invoices/create
// @access  Private
const createInvoice = async (req, res) => {
  try {
    const {
      companyId,
      attendanceData,
      fileUrl,
      cloudinaryPublicId,
      fileName,
      fileType,
      fileSize,
      gstPaidBy = "principal-employer",
      serviceChargeRate = 7,
      bonusRate = 0,
      overtimeRate = 1.5,
      calculatedValues,
    } = req.body;

    // Validate company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    if (!attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({
        success: false,
        error: "Valid attendance data is required",
      });
    }

    // Use calculated values from frontend if provided, otherwise calculate here
    let totalEmployees,
      totalPresentDays,
      totalOvertimeDays,
      baseTotal,
      overtimeAmount,
      serviceChargeTotal,
      pf,
      esic,
      bonus,
      roundOffSubTotal,
      totalBeforeTax,
      cgst,
      sgst,
      grandTotal;

    if (calculatedValues) {
      // Use pre-calculated values from frontend
      totalEmployees = calculatedValues.totalEmployees;
      totalPresentDays = calculatedValues.totalPresentDays;
      totalOvertimeDays = calculatedValues.totalOvertimeDays || 0;
      baseTotal = calculatedValues.baseTotal;
      overtimeAmount = calculatedValues.overtimeAmount || 0;
      serviceChargeTotal = calculatedValues.serviceCharge;
      pf = calculatedValues.pfAmount;
      esic = calculatedValues.esicAmount;
      bonus = calculatedValues.bonusAmount || 0;
      roundOffSubTotal = calculatedValues.subTotal;
      totalBeforeTax = calculatedValues.totalBeforeTax;
      cgst = calculatedValues.cgst;
      sgst = calculatedValues.sgst;
      grandTotal = calculatedValues.grandTotal;
    } else {
      // Fallback calculation if values not provided
      totalEmployees = attendanceData.length;

      // Determine the month's total working days
      const workingDaysInMonth = Math.max(
        ...attendanceData.map((emp) => emp.total_day || 0)
      );
      const overtimeThreshold = getOvertimeThreshold(workingDaysInMonth);

      // Calculate regular and overtime days for each employee
      let regularDays = 0;
      let overtimeDays = 0;

      attendanceData.forEach((emp) => {
        const presentDay = emp.present_day || 0;
        if (presentDay > overtimeThreshold) {
          regularDays += overtimeThreshold;
          overtimeDays += presentDay - overtimeThreshold;
        } else {
          regularDays += presentDay;
        }
      });

      totalPresentDays = regularDays;
      totalOvertimeDays = overtimeDays;

      // Calculate base amount for regular days
      const perDayRate = 466;
      baseTotal = regularDays * perDayRate;

      // Calculate overtime amount (overtime rate × per day rate × overtime days)
      overtimeAmount = overtimeDays * perDayRate * parseFloat(overtimeRate);

      // Calculate PF, ESIC, and Bonus on (baseTotal + overtimeAmount)
      const totalBeforeStatutory = baseTotal + overtimeAmount;
      pf = totalBeforeStatutory * 0.13;
      esic = totalBeforeStatutory * 0.0325;
      bonus = totalBeforeStatutory * (parseFloat(bonusRate) / 100);

      // Calculate subtotal (baseTotal + overtime + PF + ESIC + Bonus)
      const subTotal = baseTotal + overtimeAmount + pf + esic + bonus;
      roundOffSubTotal = Math.round(subTotal);

      // Calculate service charge AFTER totaling PF, ESIC, and Bonus
      const serviceCharge = roundOffSubTotal * (parseFloat(serviceChargeRate) / 100);
      serviceChargeTotal = serviceCharge;

      totalBeforeTax = roundOffSubTotal + serviceChargeTotal;
      cgst = totalBeforeTax * 0.09;
      sgst = totalBeforeTax * 0.09;

      grandTotal =
        gstPaidBy === "ashapuri"
          ? Math.round(totalBeforeTax + cgst + sgst)
          : Math.round(totalBeforeTax);
    }

    // Calculate salary details with overtime breakdown
    const workingDaysInMonth = Math.max(
      ...attendanceData.map((emp) => emp.total_day || 0)
    );
    const overtimeThreshold = getOvertimeThreshold(workingDaysInMonth);
    const perDayRate = calculatedValues?.perDayRate || 466;

    const processedEmployees = attendanceData.map((employee) => {
      const presentDay = employee.present_day || 0;

      // Calculate regular and overtime days for this employee
      let empRegularDays = presentDay;
      let empOvertimeDays = 0;

      if (presentDay > overtimeThreshold) {
        empRegularDays = overtimeThreshold;
        empOvertimeDays = presentDay - overtimeThreshold;
      }

      // Calculate gross pay (regular + overtime)
      const regularPay = empRegularDays * perDayRate;
      const overtimePay = empOvertimeDays * perDayRate * parseFloat(overtimeRate);
      const gross = regularPay + overtimePay;

      // Calculate deductions
      const epf = gross * 0.12;
      const esic = gross * 0.0075;
      const net = gross - (epf + esic);

      return {
        name: employee.name,
        presentDays: presentDay,
        regularDays: empRegularDays,
        overtimeDays: empOvertimeDays,
        totalDays: employee.total_day,
        salary: net,
      };
    });

    // Generate invoice number
    const year = new Date().getFullYear();
    const count = await Invoice.countDocuments({
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      },
    });
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(3, "0")}`;

    // Create invoice record
    const invoice = new Invoice({
      invoiceNumber,
      companyId,
      fileName: fileName || `${invoiceNumber}.pdf`,
      fileType: fileType || "pdf",
      fileUrl: fileUrl || `/uploads/invoices/${invoiceNumber}.pdf`,
      cloudinaryPublicId: cloudinaryPublicId || undefined,
      fileSize: fileSize || JSON.stringify(attendanceData).length,
      taxType: "gst",
      paymentMethod: "paid-by-us",
      gstPaidBy: gstPaidBy,
      serviceChargeRate: parseFloat(serviceChargeRate),
      bonusRate: parseFloat(bonusRate),
      overtimeRate: parseFloat(overtimeRate),
      billDetails: {
        baseAmount: baseTotal,
        serviceCharge: serviceChargeTotal,
        pfAmount: pf,
        esicAmount: esic,
        bonusAmount: bonus,
        overtimeAmount: overtimeAmount,
        gstAmount: cgst + sgst,
        totalAmount: grandTotal,
      },
      attendanceData: {
        totalEmployees,
        totalPresentDays,
        totalOvertimeDays,
        perDayRate: 466,
        workingDays: Math.max(
          ...attendanceData.map((emp) => emp.total_day || 0)
        ),
      },
      processedData: {
        extractedEmployees: processedEmployees,
        processingStatus: "completed",
        processingDate: new Date(),
      },
      createdBy: req.user._id,
    });

    await invoice.save();

    res.status(200).json({
      success: true,
      data: {
        invoice,
        calculations: {
          baseTotal,
          overtimeAmount,
          serviceCharge: serviceChargeTotal,
          pf,
          esic,
          bonus,
          cgst,
          sgst,
          grandTotal,
          overtimeDetails: {
            totalOvertimeDays,
            overtimeRate: parseFloat(overtimeRate),
            overtimeThreshold: getOvertimeThreshold(
              Math.max(...attendanceData.map((emp) => emp.total_day || 0))
            ),
          },
        },
      },
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    console.error("Error details:", error.errors);
    res.status(500).json({
      success: false,
      error: error.message || "Error creating invoice",
    });
  }
};

// @desc    Process attendance file with AI
// @route   POST /api/invoices/process-attendance
// @access  Private
const processAttendanceFile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const {
        companyId,
        perDayRate = 466,
        gstPaidBy = "principal-employer",
        serviceChargeRate = 7,
      } = req.body;

      // Validate company exists
      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: "Company ID is required",
        });
      }

      // First check if it's a valid ObjectId
      const mongoose = require("mongoose");
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          error: `Invalid company ID format: ${companyId}`,
        });
      }

      const company = await Company.findById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          error: "Company not found",
        });
      }

      // Direct Gemini API integration
      const { GoogleGenerativeAI } = require("@google/generative-ai");

      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable not set");
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
You are a data extraction specialist. Extract the following information:
1. Names of people/employees
2. Present days (attendance days)
3. Total days (total working days) or Absent (absent or absent days) or zero (0) if not present
Rules:
- Extract ALL names and their corresponding attendance data
- If data is in table format, extract from each row
- If data is handwritten/unstructured, identify patterns like "Name X/Y" or "Name X Y"
- Handle variations in handwriting and formatting
- Return ONLY valid JSON format
Required JSON format:
{
    "extracted_data": [
        {
            "name": "Person Name",
            "present_day": number,
            "total_day": number // or "absent_day": number
        }
    ]
}
If you cannot extract certain information, use null for missing values.
`;

      let result;
      const fileExtension = req.file.originalname
        .toLowerCase()
        .split(".")
        .pop();

      if (fileExtension === "xlsx" || fileExtension === "xls") {
        // Handle Excel files
        const xlsx = require("xlsx");
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const csvData = xlsx.utils.sheet_to_csv(worksheet);

        const fullPrompt = `${prompt}\n\nSpreadsheet data:\n${csvData}`;
        result = await model.generateContent(fullPrompt);
      } else {
        // Handle PDF and image files
        const fileBuffer = await fs.readFile(req.file.path);
        const mimeType = req.file.mimetype;

        const imagePart = {
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType,
          },
        };

        result = await model.generateContent([prompt, imagePart]);
      }

      // Process AI response
      const responseText = result.response.text();
      const cleaned = responseText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const attendanceData = parsed.extracted_data || [];

      if (!attendanceData.length) {
        return res.status(400).json({
          success: false,
          error: "No attendance data could be extracted from the file",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          attendanceData,
        },
      });
    });
  } catch (error) {
    console.error("Error processing attendance file:", error);

    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || "Error processing attendance file",
    });
  }
};

// Helper function to determine file type
const getFileType = (fileName) => {
  const extension = fileName.toLowerCase().split(".").pop();
  switch (extension) {
    case "pdf":
      return "pdf";
    case "xlsx":
    case "xls":
      return "excel";
    case "jpg":
    case "jpeg":
    case "png":
      return "image";
    default:
      return "unknown";
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
      .populate("companyId", "name location")
      .populate("createdBy", "name email")
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
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single invoice by ID
// @route   GET /api/invoices/:id
// @access  Private
const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("companyId")
      .populate("createdBy", "name email");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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
        error: "Invoice not found",
      });
    }

    // Update allowed fields
    if (status) invoice.status = status;
    if (paymentStatus) {
      invoice.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") {
        invoice.paymentDate = new Date();
      }
    }
    if (billTo) invoice.billTo = { ...invoice.billTo, ...billTo };
    if (notes !== undefined) invoice.notes = notes;

    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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
        error: "Invoice not found",
      });
    }

    // Delete associated file from Cloudinary or local storage
    if (invoice.fileUrl) {
      // Check if it's a Cloudinary URL
      if (invoice.fileUrl.includes("cloudinary.com")) {
        // Extract public_id from Cloudinary URL or use stored cloudinaryPublicId
        const publicId = invoice.cloudinaryPublicId;
        if (publicId) {
          try {
            await deleteFileFromCloudinary(publicId, "raw");
          } catch (error) {
            console.error("Error deleting file from Cloudinary:", error);
          }
        }
      } else {
        // Delete from local storage
        const filePath = path.join(__dirname, "../../", invoice.fileUrl);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          console.error("Error deleting local file:", error);
        }
      }
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: "$billDetails.totalAmount" },
          paidAmount: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "paid"] },
                "$billDetails.totalAmount",
                0,
              ],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "pending"] },
                "$billDetails.totalAmount",
                0,
              ],
            },
          },
          draftCount: {
            $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
          },
          sentCount: {
            $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
          },
        },
      },
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
        paidCount: 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get all invoices (admin/global)
// @route   GET /api/invoices/
// @access  Private
const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus } = req.query;
    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const invoices = await Invoice.find(query)
      .populate("companyId", "name location")
      .populate("createdBy", "name email")
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
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Configure multer for invoice file uploads
const invoiceStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads/invoices");
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const uploadInvoice = multer({
  storage: invoiceStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, Excel, and image files are allowed."
        )
      );
    }
  },
}).single("invoiceFile");

// @desc    Upload invoice file to Cloudinary
// @route   POST /api/invoices/upload-file
// @access  Private
const uploadInvoiceFile = async (req, res) => {
  try {
    uploadInvoice(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const { invoiceNumber } = req.body;

      try {
        // Upload to Cloudinary
        // Use 'raw' for PDFs, 'auto' for images and Excel files
        const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
        const resourceType = fileExtension === 'pdf' ? 'raw' : 'auto';

        const cloudinaryResult = await uploadFileToCloudinary(req.file.path, {
          folder: "invoices",
          public_id: invoiceNumber || undefined,
          resource_type: resourceType,
        });

        // Delete local file after successful upload
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up local file:", cleanupError);
        }

        res.status(200).json({
          success: true,
          data: {
            fileUrl: cloudinaryResult.url,
            publicId: cloudinaryResult.publicId,
            fileName: req.file.originalname,
            fileType: getFileType(req.file.originalname),
            fileSize: cloudinaryResult.bytes,
          },
        });
      } catch (uploadError) {
        // Clean up local file on error
        if (req.file && req.file.path) {
          try {
            await fs.unlink(req.file.path);
          } catch (cleanupError) {
            console.error("Error cleaning up file:", cleanupError);
          }
        }

        res.status(500).json({
          success: false,
          error: uploadError.message || "Error uploading file to Cloudinary",
        });
      }
    });
  } catch (error) {
    console.error("Error uploading invoice file:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error uploading invoice file",
    });
  }
};

module.exports = {
  createInvoice,
  processAttendanceFile,
  getCompanyInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats,
  getAllInvoices,
  uploadInvoiceFile,
};
