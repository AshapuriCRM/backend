const Invoice = require("../models/Invoice");
const Company = require("../models/Company");
const mongoose = require("mongoose");
const {
  uploadFileToCloudinary,
  deleteFileFromCloudinary,
  getSignedUrl,
  getDownloadUrl,
} = require("../utils/cloudinaryUpload");
const { generateMergedInvoicePDF } = require("../utils/pdfGenerator");
const fs = require("fs").promises;
const path = require("path");

// @desc    Get all invoices for admin (with filters)
// @route   GET /api/admin/invoices
// @access  Private/Admin
const getAllInvoicesForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      companyId,
      isMerged,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Filter by status
    if (status) query.status = status;

    // Filter by payment status
    if (paymentStatus) query.paymentStatus = paymentStatus;

    // Filter by company
    if (companyId) query.companyId = companyId;

    // Filter by merged status
    if (isMerged !== undefined) {
      query.isMerged = isMerged === "true";
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const invoices = await Invoice.find(query)
      .populate("companyId", "name location gstNumber")
      .populate("createdBy", "name email")
      .populate("sourceInvoices", "invoiceNumber billDetails.totalAmount")
      .populate("mergedCompanies", "name")
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

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
    console.error("Error fetching invoices for admin:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching invoices",
    });
  }
};

// @desc    Merge multiple invoices into one
// @route   POST /api/admin/invoices/merge
// @access  Private/Admin
const mergeInvoices = async (req, res) => {
  try {
    const { invoiceIds, notes } = req.body;

    // Validate input
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: "At least 2 invoice IDs are required for merging",
      });
    }

    // Validate all IDs are valid ObjectIds
    const invalidIds = invoiceIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid invoice IDs: ${invalidIds.join(", ")}`,
      });
    }

    // Fetch all invoices to merge
    const invoices = await Invoice.find({
      _id: { $in: invoiceIds },
    }).populate("companyId", "name location gstNumber");

    // Validate all invoices exist
    if (invoices.length !== invoiceIds.length) {
      const foundIds = invoices.map((inv) => inv._id.toString());
      const missingIds = invoiceIds.filter((id) => !foundIds.includes(id));
      return res.status(404).json({
        success: false,
        error: `Invoices not found: ${missingIds.join(", ")}`,
      });
    }

    // Check if any invoice is already a merged invoice (prevent nested merging)
    const alreadyMerged = invoices.filter((inv) => inv.isMerged);
    if (alreadyMerged.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot merge already merged invoices: ${alreadyMerged
          .map((inv) => inv.invoiceNumber)
          .join(", ")}`,
      });
    }

    // Collect unique companies
    const companyIds = [
      ...new Set(invoices.map((inv) => inv.companyId._id.toString())),
    ];
    const companyNames = [
      ...new Set(invoices.map((inv) => inv.companyId.name)),
    ];

    // Calculate merged bill details
    const mergedBillDetails = {
      baseAmount: 0,
      serviceCharge: 0,
      pfAmount: 0,
      esicAmount: 0,
      bonusAmount: 0,
      overtimeAmount: 0,
      gstAmount: 0,
      totalAmount: 0,
    };

    // Calculate merged attendance data
    const mergedAttendanceData = {
      totalEmployees: 0,
      totalPresentDays: 0,
      totalOvertimeDays: 0,
      perDayRate: 0,
      workingDays: 0,
    };

    // Collect all employees from all invoices
    const allEmployees = [];

    // Sum up all bill details and attendance data
    invoices.forEach((invoice) => {
      // Sum bill details
      if (invoice.billDetails) {
        mergedBillDetails.baseAmount += invoice.billDetails.baseAmount || 0;
        mergedBillDetails.serviceCharge +=
          invoice.billDetails.serviceCharge || 0;
        mergedBillDetails.pfAmount += invoice.billDetails.pfAmount || 0;
        mergedBillDetails.esicAmount += invoice.billDetails.esicAmount || 0;
        mergedBillDetails.bonusAmount += invoice.billDetails.bonusAmount || 0;
        mergedBillDetails.overtimeAmount +=
          invoice.billDetails.overtimeAmount || 0;
        mergedBillDetails.gstAmount += invoice.billDetails.gstAmount || 0;
        mergedBillDetails.totalAmount += invoice.billDetails.totalAmount || 0;
      }

      // Sum attendance data
      if (invoice.attendanceData) {
        mergedAttendanceData.totalEmployees +=
          invoice.attendanceData.totalEmployees || 0;
        mergedAttendanceData.totalPresentDays +=
          invoice.attendanceData.totalPresentDays || 0;
        mergedAttendanceData.totalOvertimeDays +=
          invoice.attendanceData.totalOvertimeDays || 0;
        // Take the max perDayRate and workingDays
        mergedAttendanceData.perDayRate = Math.max(
          mergedAttendanceData.perDayRate,
          invoice.attendanceData.perDayRate || 0
        );
        mergedAttendanceData.workingDays = Math.max(
          mergedAttendanceData.workingDays,
          invoice.attendanceData.workingDays || 0
        );
      }

      // Collect employees with company info
      if (
        invoice.processedData &&
        invoice.processedData.extractedEmployees &&
        invoice.processedData.extractedEmployees.length > 0
      ) {
        invoice.processedData.extractedEmployees.forEach((emp) => {
          allEmployees.push({
            ...emp.toObject ? emp.toObject() : emp,
            sourceCompany: invoice.companyId.name,
            sourceInvoice: invoice.invoiceNumber,
          });
        });
      }
    });

    // Generate merged invoice number
    const year = new Date().getFullYear();
    const mergedCount = await Invoice.countDocuments({
      isMerged: true,
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      },
    });
    const mergedInvoiceNumber = `MINV-${year}-${String(mergedCount + 1).padStart(
      3,
      "0"
    )}`;

    // Determine tax type and payment method (use most common from source invoices)
    const taxTypes = invoices.map((inv) => inv.taxType);
    const paymentMethods = invoices.map((inv) => inv.paymentMethod);
    const gstPaidByArr = invoices.map((inv) => inv.gstPaidBy);

    const mostCommon = (arr) => {
      const counts = {};
      arr.forEach((item) => {
        counts[item] = (counts[item] || 0) + 1;
      });
      return Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b
      );
    };

    // Create the merged invoice
    const mergedInvoice = new Invoice({
      invoiceNumber: mergedInvoiceNumber,
      companyId: invoices[0].companyId._id, // Primary company (first in list)
      fileName: `${mergedInvoiceNumber}.pdf`,
      fileType: "pdf",
      fileUrl: `/uploads/merged-invoices/${mergedInvoiceNumber}.pdf`,
      taxType: mostCommon(taxTypes),
      paymentMethod: mostCommon(paymentMethods),
      gstPaidBy: mostCommon(gstPaidByArr),
      serviceChargeRate: Math.max(
        ...invoices.map((inv) => inv.serviceChargeRate || 7)
      ),
      bonusRate: Math.max(...invoices.map((inv) => inv.bonusRate || 0)),
      overtimeRate: Math.max(...invoices.map((inv) => inv.overtimeRate || 0)),
      billDetails: mergedBillDetails,
      attendanceData: mergedAttendanceData,
      processedData: {
        extractedEmployees: allEmployees,
        processingStatus: "completed",
        processingDate: new Date(),
      },
      billTo: {
        name: companyNames.join(" + "),
        address: invoices
          .map((inv) => inv.billTo?.address)
          .filter(Boolean)
          .join("; "),
        gstNumber: invoices
          .map((inv) => inv.billTo?.gstNumber || inv.companyId.gstNumber)
          .filter(Boolean)
          .join(", "),
      },
      status: "draft",
      paymentStatus: "pending",
      notes: notes || `Merged invoice from: ${invoices.map((inv) => inv.invoiceNumber).join(", ")}`,
      createdBy: req.user._id,
      isMerged: true,
      sourceInvoices: invoiceIds.map((id) => new mongoose.Types.ObjectId(id)),
      mergedCompanies: companyIds.map((id) => new mongoose.Types.ObjectId(id)),
    });

    await mergedInvoice.save();

    // Generate PDF for the merged invoice
    let pdfUploadResult = null;
    try {
      // Ensure temp directory exists
      const tempDir = path.join(__dirname, "../../uploads/temp");
      await fs.mkdir(tempDir, { recursive: true });

      // Generate PDF file
      const tempPdfPath = path.join(tempDir, `${mergedInvoiceNumber}.pdf`);

      // Prepare data for PDF generation
      const pdfInvoiceData = {
        ...mergedInvoice.toObject(),
        mergedCompanies: companyNames.map((name, idx) => ({
          _id: companyIds[idx],
          name: name,
        })),
      };

      await generateMergedInvoicePDF(pdfInvoiceData, invoices, tempPdfPath);

      // Upload PDF to Cloudinary
      const cloudinaryResult = await uploadFileToCloudinary(tempPdfPath, {
        folder: "merged-invoices",
        public_id: mergedInvoiceNumber,
        resource_type: "raw",
      });

      pdfUploadResult = cloudinaryResult;

      // Update invoice with Cloudinary URL
      mergedInvoice.fileUrl = cloudinaryResult.url;
      mergedInvoice.cloudinaryPublicId = cloudinaryResult.publicId;
      mergedInvoice.fileSize = cloudinaryResult.bytes;
      await mergedInvoice.save();

      // Clean up temp file
      try {
        await fs.unlink(tempPdfPath);
      } catch (cleanupError) {
        console.error("Error cleaning up temp PDF:", cleanupError);
      }

      console.log(`PDF generated and uploaded for merged invoice: ${mergedInvoiceNumber}`);
    } catch (pdfError) {
      console.error("Error generating/uploading PDF:", pdfError);
      // Continue without PDF - invoice is still created
    }

    // Populate the saved invoice for response
    const populatedMergedInvoice = await Invoice.findById(mergedInvoice._id)
      .populate("companyId", "name location gstNumber")
      .populate("createdBy", "name email")
      .populate("sourceInvoices", "invoiceNumber companyId billDetails.totalAmount createdAt")
      .populate("mergedCompanies", "name location");

    res.status(201).json({
      success: true,
      message: `Successfully merged ${invoices.length} invoices${pdfUploadResult ? " with PDF generated" : ""}`,
      data: {
        mergedInvoice: populatedMergedInvoice,
        pdfGenerated: !!pdfUploadResult,
        sourceInvoiceSummary: invoices.map((inv) => ({
          id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          company: inv.companyId.name,
          totalAmount: inv.billDetails.totalAmount,
        })),
      },
    });
  } catch (error) {
    console.error("Error merging invoices:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error merging invoices",
    });
  }
};

// @desc    Get all merged invoices
// @route   GET /api/admin/invoices/merged
// @access  Private/Admin
const getMergedInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { isMerged: true };

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const invoices = await Invoice.find(query)
      .populate("companyId", "name location")
      .populate("createdBy", "name email")
      .populate({
        path: "sourceInvoices",
        select: "invoiceNumber companyId billDetails.totalAmount createdAt",
        populate: {
          path: "companyId",
          select: "name",
        },
      })
      .populate("mergedCompanies", "name location")
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

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
    console.error("Error fetching merged invoices:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching merged invoices",
    });
  }
};

// @desc    Get merged invoice details with source invoices
// @route   GET /api/admin/invoices/merged/:id
// @access  Private/Admin
const getMergedInvoiceDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid invoice ID",
      });
    }

    const invoice = await Invoice.findById(id)
      .populate("companyId", "name location gstNumber contactPerson")
      .populate("createdBy", "name email")
      .populate({
        path: "sourceInvoices",
        populate: [
          { path: "companyId", select: "name location gstNumber" },
          { path: "createdBy", select: "name email" },
        ],
      })
      .populate("mergedCompanies", "name location gstNumber");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    if (!invoice.isMerged) {
      return res.status(400).json({
        success: false,
        error: "This is not a merged invoice",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Error fetching merged invoice details:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching invoice details",
    });
  }
};

// @desc    Get non-merged invoices for selection (admin merge UI)
// @route   GET /api/admin/invoices/available-for-merge
// @access  Private/Admin
const getAvailableForMerge = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      companyId,
      startDate,
      endDate,
    } = req.query;

    // Only get non-merged invoices that are not cancelled
    const query = {
      isMerged: { $ne: true },
      status: { $ne: "cancelled" },
    };

    if (companyId) query.companyId = companyId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(query)
      .populate("companyId", "name location")
      .populate("createdBy", "name email")
      .select("invoiceNumber companyId billDetails.totalAmount createdAt status paymentStatus")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

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
    console.error("Error fetching available invoices:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching invoices",
    });
  }
};

// @desc    Download invoice file (returns URL or proxies download)
// @route   GET /api/admin/invoices/:id/download
// @access  Private/Admin
const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { proxy } = req.query; // ?proxy=true to stream through backend

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid invoice ID",
      });
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    if (!invoice.fileUrl) {
      return res.status(404).json({
        success: false,
        error: "No file associated with this invoice",
      });
    }

    // If it's a Cloudinary URL
    if (invoice.fileUrl.includes("cloudinary.com") || invoice.fileUrl.startsWith("http")) {
      // If proxy=true, stream the file through the backend (bypasses CORS/auth issues)
      if (proxy === "true") {
        return await proxyDownload(invoice, res);
      }

      // Try to generate a signed download URL
      let publicId = invoice.cloudinaryPublicId;

      // Extract publicId from URL if not stored
      if (!publicId) {
        try {
          const urlParts = invoice.fileUrl.split("/");
          const uploadIndex = urlParts.findIndex(part => part === "upload");
          if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
            const pathAfterUpload = urlParts.slice(uploadIndex + 1);
            const startIndex = pathAfterUpload[0]?.match(/^v\d+$/) ? 1 : 0;
            publicId = pathAfterUpload.slice(startIndex).join("/").replace(/\.[^/.]+$/, "");
          }
        } catch (parseError) {
          console.error("Error parsing Cloudinary URL:", parseError);
        }
      }

      // Generate signed download URL
      if (publicId) {
        try {
          const downloadUrl = getDownloadUrl(publicId, {
            resourceType: "raw",
            fileName: invoice.fileName,
            format: invoice.fileType === "pdf" ? "pdf" : undefined,
          });

          return res.status(200).json({
            success: true,
            data: {
              downloadUrl: downloadUrl,
              fileName: invoice.fileName,
              fileType: invoice.fileType,
              // Include proxy URL as fallback
              proxyUrl: `/api/admin/invoices/${id}/download?proxy=true`,
            },
          });
        } catch (urlError) {
          console.error("Error generating download URL:", urlError);
        }
      }

      // Fallback: return stored URL with proxy option
      return res.status(200).json({
        success: true,
        data: {
          downloadUrl: invoice.fileUrl,
          fileName: invoice.fileName,
          fileType: invoice.fileType,
          proxyUrl: `/api/admin/invoices/${id}/download?proxy=true`,
        },
      });
    }

    // For local files, send the file directly
    const path = require("path");
    const fs = require("fs").promises;
    const filePath = path.join(__dirname, "../../", invoice.fileUrl);

    try {
      await fs.access(filePath);
      res.download(filePath, invoice.fileName);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: "File not found on server",
      });
    }
  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error downloading invoice",
    });
  }
};

// Helper function to proxy download from Cloudinary
const proxyDownload = async (invoice, res) => {
  const https = require("https");
  const http = require("http");

  try {
    const fileUrl = invoice.fileUrl;
    const protocol = fileUrl.startsWith("https") ? https : http;

    // Set response headers for download
    const contentType = invoice.fileType === "pdf"
      ? "application/pdf"
      : invoice.fileType === "excel"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.fileName}"`);

    // Fetch from Cloudinary using API credentials
    const cloudinary = require("../config/cloudinary");

    // Generate an authenticated URL using Cloudinary SDK
    const authenticatedUrl = cloudinary.url(
      invoice.cloudinaryPublicId || extractPublicId(invoice.fileUrl),
      {
        resource_type: "raw",
        type: "upload",
        secure: true,
        sign_url: true,
      }
    );

    return new Promise((resolve, reject) => {
      protocol.get(authenticatedUrl, (response) => {
        if (response.statusCode === 200) {
          response.pipe(res);
          response.on("end", resolve);
        } else if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          const redirectUrl = response.headers.location;
          protocol.get(redirectUrl, (redirectResponse) => {
            if (redirectResponse.statusCode === 200) {
              redirectResponse.pipe(res);
              redirectResponse.on("end", resolve);
            } else {
              res.status(redirectResponse.statusCode).json({
                success: false,
                error: `Failed to download file: ${redirectResponse.statusCode}`,
              });
              resolve();
            }
          }).on("error", reject);
        } else {
          // Try fetching the original URL directly (might work for public files)
          protocol.get(fileUrl, (retryResponse) => {
            if (retryResponse.statusCode === 200) {
              retryResponse.pipe(res);
              retryResponse.on("end", resolve);
            } else {
              res.status(retryResponse.statusCode).json({
                success: false,
                error: `Failed to download file: ${retryResponse.statusCode}`,
              });
              resolve();
            }
          }).on("error", reject);
        }
      }).on("error", (error) => {
        console.error("Proxy download error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to download file from cloud storage",
        });
        resolve();
      });
    });
  } catch (error) {
    console.error("Proxy download error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to proxy download",
    });
  }
};

// Helper to extract publicId from Cloudinary URL
const extractPublicId = (url) => {
  try {
    const urlParts = url.split("/");
    const uploadIndex = urlParts.findIndex(part => part === "upload");
    if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
      const pathAfterUpload = urlParts.slice(uploadIndex + 1);
      const startIndex = pathAfterUpload[0]?.match(/^v\d+$/) ? 1 : 0;
      return pathAfterUpload.slice(startIndex).join("/").replace(/\.[^/.]+$/, "");
    }
  } catch (e) {
    console.error("Error extracting publicId:", e);
  }
  return null;
};

// @desc    Delete merged invoice (only merged invoices)
// @route   DELETE /api/admin/invoices/merged/:id
// @access  Private/Admin
const deleteMergedInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid invoice ID",
      });
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    if (!invoice.isMerged) {
      return res.status(400).json({
        success: false,
        error: "This route is only for deleting merged invoices. Use the regular delete route for normal invoices.",
      });
    }

    // Delete associated file from Cloudinary if exists
    if (invoice.cloudinaryPublicId) {
      try {
        await deleteFileFromCloudinary(invoice.cloudinaryPublicId, "raw");
      } catch (error) {
        console.error("Error deleting file from Cloudinary:", error);
      }
    }

    await Invoice.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Merged invoice deleted successfully. Source invoices remain intact.",
    });
  } catch (error) {
    console.error("Error deleting merged invoice:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error deleting invoice",
    });
  }
};

// @desc    Get admin invoice statistics
// @route   GET /api/admin/invoices/stats
// @access  Private/Admin
const getAdminInvoiceStats = async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalInvoices: { $sum: 1 },
                totalAmount: { $sum: "$billDetails.totalAmount" },
                mergedCount: {
                  $sum: { $cond: [{ $eq: ["$isMerged", true] }, 1, 0] },
                },
                regularCount: {
                  $sum: { $cond: [{ $ne: ["$isMerged", true] }, 1, 0] },
                },
              },
            },
          ],
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                amount: { $sum: "$billDetails.totalAmount" },
              },
            },
          ],
          byPaymentStatus: [
            {
              $group: {
                _id: "$paymentStatus",
                count: { $sum: 1 },
                amount: { $sum: "$billDetails.totalAmount" },
              },
            },
          ],
          byCompany: [
            {
              $group: {
                _id: "$companyId",
                count: { $sum: 1 },
                amount: { $sum: "$billDetails.totalAmount" },
              },
            },
            { $sort: { amount: -1 } },
            { $limit: 10 },
          ],
          recentMerged: [
            { $match: { isMerged: true } },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                invoiceNumber: 1,
                billDetails: 1,
                createdAt: 1,
                sourceInvoices: 1,
              },
            },
          ],
        },
      },
    ]);

    // Populate company names for byCompany stats
    const byCompanyWithNames = await Company.populate(stats[0].byCompany, {
      path: "_id",
      select: "name",
    });

    res.status(200).json({
      success: true,
      data: {
        overall: stats[0].overall[0] || {
          totalInvoices: 0,
          totalAmount: 0,
          mergedCount: 0,
          regularCount: 0,
        },
        byStatus: stats[0].byStatus,
        byPaymentStatus: stats[0].byPaymentStatus,
        byCompany: byCompanyWithNames.map((item) => ({
          company: item._id?.name || "Unknown",
          companyId: item._id?._id,
          count: item.count,
          amount: item.amount,
        })),
        recentMerged: stats[0].recentMerged,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error fetching statistics",
    });
  }
};

module.exports = {
  getAllInvoicesForAdmin,
  mergeInvoices,
  getMergedInvoices,
  getMergedInvoiceDetails,
  getAvailableForMerge,
  downloadInvoice,
  deleteMergedInvoice,
  getAdminInvoiceStats,
};
