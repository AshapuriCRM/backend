const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Company constants
const COMPANY_INFO = {
  name: "ASHAPURI SECURITY SERVICES",
  tagline: "SECURITY",
  address: "LG-1, SHEKHAR RESIDENCY, OPP.MARRIOTT HOTEL,",
  address2: "SCH. NO. 54, VIJAY NAGAR, INDORE-452010 (M.P.)",
  tel: "TEL. NO. / FAX: 0731-4009596",
  mobile: "MOBILE: 9425064985, 9755007867",
  email: "EMAIL: ashapuridsc@yahoo.com",
  gstin: "23ADCPC7046H1ZZ",
  pan: "ADCPC7046H",
  bank: {
    name: "PUNJAB NATIONAL BANK",
    account: "0788101000960",
    ifsc: "PUNB0078810",
    branch: "SCH. NO. 54, VIJAY NAGAR, INDORE",
  },
};

/**
 * Generates an invoice PDF
 * @param {Object} invoiceData - The invoice data
 * @param {String} outputPath - Path to save the PDF (optional, returns buffer if not provided)
 * @returns {Promise<Buffer|String>} Buffer or file path
 */
async function generateInvoicePDF(invoiceData, outputPath = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 30,
        info: {
          Title: `Invoice ${invoiceData.invoiceNumber}`,
          Author: "Ashapuri Security Services",
        },
      });

      const buffers = [];

      if (outputPath) {
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);
        writeStream.on("finish", () => resolve(outputPath));
        writeStream.on("error", reject);
      } else {
        doc.on("data", (buffer) => buffers.push(buffer));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
      }

      // Generate PDF content
      generateHeader(doc, invoiceData);
      generateInvoiceInfo(doc, invoiceData);
      generateBillTo(doc, invoiceData);
      generateEmployeeTable(doc, invoiceData);
      generateBillDetails(doc, invoiceData);
      generateFooter(doc, invoiceData);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a merged invoice PDF with details from multiple source invoices
 * Styled to match the sample single invoice format
 * @param {Object} mergedInvoice - The merged invoice data
 * @param {Array} sourceInvoices - Array of source invoice data
 * @param {String} outputPath - Path to save the PDF (optional)
 * @returns {Promise<Buffer|String>} Buffer or file path
 */
async function generateMergedInvoicePDF(mergedInvoice, sourceInvoices = [], outputPath = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 30,
        info: {
          Title: `Merged Invoice ${mergedInvoice.invoiceNumber}`,
          Author: "Ashapuri Security Services",
        },
      });

      const buffers = [];

      if (outputPath) {
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);
        writeStream.on("finish", () => resolve(outputPath));
        writeStream.on("error", reject);
      } else {
        doc.on("data", (buffer) => buffers.push(buffer));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
      }

      // Generate merged invoice content matching sample invoice style
      generateMergedHeader(doc);
      generateMergedBillToAndInvoiceInfo(doc, mergedInvoice, sourceInvoices);
      generateMergedItemsTable(doc, mergedInvoice, sourceInvoices);
      generateMergedTotalsSection(doc, mergedInvoice);
      generateMergedBankAndFooter(doc, mergedInvoice);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to generate header
function generateHeader(doc, invoice, isMerged = false) {
  // Company Logo/Name
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("ASHAPURI SECURITY SERVICES", 50, 50, { align: "center" });

  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Security & Manpower Solutions", { align: "center" });

  // Invoice Title
  doc.moveDown(2);
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(isMerged ? "#2563eb" : "#000")
    .text(isMerged ? "MERGED INVOICE" : "INVOICE", { align: "center" });

  doc.fillColor("#000");

  // Horizontal line
  doc
    .moveTo(50, doc.y + 10)
    .lineTo(545, doc.y + 10)
    .stroke();

  doc.moveDown(2);
}

// Helper function to generate invoice info
function generateInvoiceInfo(doc, invoice) {
  const startY = doc.y;

  // Left side - Invoice details
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Invoice Number:", 50, startY)
    .font("Helvetica")
    .text(invoice.invoiceNumber || "N/A", 150, startY);

  doc
    .font("Helvetica-Bold")
    .text("Date:", 50, startY + 15)
    .font("Helvetica")
    .text(formatDate(invoice.createdAt), 150, startY + 15);

  doc
    .font("Helvetica-Bold")
    .text("Due Date:", 50, startY + 30)
    .font("Helvetica")
    .text(formatDate(invoice.dueDate), 150, startY + 30);

  doc
    .font("Helvetica-Bold")
    .text("Status:", 50, startY + 45)
    .font("Helvetica")
    .text((invoice.status || "Draft").toUpperCase(), 150, startY + 45);

  // Right side - Payment info
  doc
    .font("Helvetica-Bold")
    .text("Tax Type:", 350, startY)
    .font("Helvetica")
    .text((invoice.taxType || "GST").toUpperCase(), 430, startY);

  doc
    .font("Helvetica-Bold")
    .text("Payment Status:", 350, startY + 15)
    .font("Helvetica")
    .text((invoice.paymentStatus || "Pending").toUpperCase(), 430, startY + 15);

  doc.y = startY + 70;
  doc.moveDown();
}

// Helper function for merged invoice info
function generateMergedInvoiceInfo(doc, invoice, sourceInvoices) {
  const startY = doc.y;

  // Left side
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Merged Invoice #:", 50, startY)
    .font("Helvetica")
    .text(invoice.invoiceNumber || "N/A", 160, startY);

  doc
    .font("Helvetica-Bold")
    .text("Date Created:", 50, startY + 15)
    .font("Helvetica")
    .text(formatDate(invoice.createdAt), 160, startY + 15);

  doc
    .font("Helvetica-Bold")
    .text("Source Invoices:", 50, startY + 30)
    .font("Helvetica")
    .text(sourceInvoices.length.toString(), 160, startY + 30);

  // Right side
  doc
    .font("Helvetica-Bold")
    .text("Total Companies:", 350, startY)
    .font("Helvetica")
    .text((invoice.mergedCompanies?.length || 1).toString(), 450, startY);

  doc
    .font("Helvetica-Bold")
    .text("Status:", 350, startY + 15)
    .font("Helvetica")
    .text((invoice.status || "Draft").toUpperCase(), 450, startY + 15);

  doc.y = startY + 55;
  doc.moveDown();
}

// Helper function to generate bill to section
function generateBillTo(doc, invoice) {
  const company = invoice.companyId || {};
  const billTo = invoice.billTo || {};

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Bill To:", 50, doc.y);

  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(billTo.name || company.name || "N/A", 50)
    .text(billTo.address || company.address || "", 50)
    .text(`GST: ${billTo.gstNumber || company.gstNumber || "N/A"}`, 50);

  doc.moveDown();
}

// Helper function for merged companies section
function generateMergedCompaniesSection(doc, invoice) {
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Companies Included:", 50, doc.y);

  doc.moveDown(0.5);

  const companies = invoice.mergedCompanies || [];
  if (companies.length > 0) {
    companies.forEach((company, index) => {
      const companyName = typeof company === "object" ? company.name : company;
      doc.fontSize(10).font("Helvetica").text(`${index + 1}. ${companyName}`, 60);
    });
  } else {
    doc.fontSize(10).font("Helvetica").text("N/A", 60);
  }

  doc.moveDown();
}

// Helper function to generate source invoices summary
function generateSourceInvoicesSummary(doc, sourceInvoices) {
  if (!sourceInvoices || sourceInvoices.length === 0) return;

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Source Invoices Summary:", 50, doc.y);

  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 150;
  const col3 = 300;
  const col4 = 450;

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("Invoice #", col1, tableTop)
    .text("Company", col2, tableTop)
    .text("Date", col3, tableTop)
    .text("Amount", col4, tableTop);

  doc
    .moveTo(50, tableTop + 12)
    .lineTo(545, tableTop + 12)
    .stroke();

  let y = tableTop + 18;

  sourceInvoices.forEach((inv) => {
    const companyName = typeof inv.companyId === "object"
      ? inv.companyId.name
      : "N/A";
    const amount = inv.billDetails?.totalAmount || 0;

    doc
      .fontSize(9)
      .font("Helvetica")
      .text(inv.invoiceNumber || "N/A", col1, y)
      .text(truncateText(companyName, 25), col2, y)
      .text(formatDate(inv.createdAt), col3, y)
      .text(formatCurrency(amount), col4, y);

    y += 15;

    // Add new page if needed
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  });

  doc.y = y + 10;
  doc.moveDown();
}

// Helper function to generate employee table
function generateEmployeeTable(doc, invoice) {
  const employees = invoice.processedData?.extractedEmployees || [];
  if (employees.length === 0) return;

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Employee Attendance Details:", 50, doc.y);

  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 180;
  const col3 = 260;
  const col4 = 340;
  const col5 = 420;
  const col6 = 480;

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("S.No", col1, tableTop)
    .text("Employee Name", col1 + 30, tableTop)
    .text("Present", col2, tableTop)
    .text("Regular", col3, tableTop)
    .text("OT Days", col4, tableTop)
    .text("Total", col5, tableTop)
    .text("Salary", col6, tableTop);

  doc
    .moveTo(50, tableTop + 12)
    .lineTo(545, tableTop + 12)
    .stroke();

  let y = tableTop + 18;

  employees.slice(0, 30).forEach((emp, index) => {
    doc
      .fontSize(8)
      .font("Helvetica")
      .text((index + 1).toString(), col1, y)
      .text(truncateText(emp.name || "N/A", 20), col1 + 30, y)
      .text((emp.presentDays || 0).toString(), col2, y)
      .text((emp.regularDays || emp.presentDays || 0).toString(), col3, y)
      .text((emp.overtimeDays || 0).toString(), col4, y)
      .text((emp.totalDays || emp.presentDays || 0).toString(), col5, y)
      .text(formatCurrency(emp.salary || 0), col6, y);

    y += 12;

    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  });

  if (employees.length > 30) {
    doc.fontSize(8).font("Helvetica-Oblique").text(`... and ${employees.length - 30} more employees`, 50, y);
    y += 15;
  }

  doc.y = y + 10;
  doc.moveDown();
}

// Helper function to generate merged employee table (with company info)
function generateMergedEmployeeTable(doc, invoice) {
  const employees = invoice.processedData?.extractedEmployees || [];
  if (employees.length === 0) return;

  // Check if we need a new page
  if (doc.y > 500) {
    doc.addPage();
  }

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Combined Employee Details:", 50, doc.y);

  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 170;
  const col3 = 280;
  const col4 = 350;
  const col5 = 420;
  const col6 = 490;

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("Employee Name", col1, tableTop)
    .text("Company", col2, tableTop)
    .text("Present", col3, tableTop)
    .text("OT Days", col4, tableTop)
    .text("Total", col5, tableTop)
    .text("Salary", col6, tableTop);

  doc
    .moveTo(50, tableTop + 12)
    .lineTo(545, tableTop + 12)
    .stroke();

  let y = tableTop + 18;

  employees.slice(0, 25).forEach((emp) => {
    doc
      .fontSize(7)
      .font("Helvetica")
      .text(truncateText(emp.name || "N/A", 18), col1, y)
      .text(truncateText(emp.sourceCompany || "N/A", 15), col2, y)
      .text((emp.presentDays || 0).toString(), col3, y)
      .text((emp.overtimeDays || 0).toString(), col4, y)
      .text((emp.totalDays || emp.presentDays || 0).toString(), col5, y)
      .text(formatCurrency(emp.salary || 0), col6, y);

    y += 11;

    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  });

  if (employees.length > 25) {
    doc.fontSize(8).font("Helvetica-Oblique").text(`... and ${employees.length - 25} more employees`, 50, y);
    y += 15;
  }

  doc.y = y + 10;
  doc.moveDown();
}

// Helper function to generate bill details
function generateBillDetails(doc, invoice) {
  const billDetails = invoice.billDetails || {};

  // Check if we need a new page
  if (doc.y > 600) {
    doc.addPage();
  }

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Bill Summary:", 50, doc.y);

  doc.moveDown(0.5);

  const startY = doc.y;
  const labelX = 350;
  const valueX = 480;

  const items = [
    { label: "Base Amount:", value: billDetails.baseAmount || 0 },
    { label: "Overtime Amount:", value: billDetails.overtimeAmount || 0 },
    { label: "PF Amount:", value: billDetails.pfAmount || 0 },
    { label: "ESIC Amount:", value: billDetails.esicAmount || 0 },
    { label: "Bonus Amount:", value: billDetails.bonusAmount || 0 },
    { label: "Service Charge:", value: billDetails.serviceCharge || 0 },
    { label: "GST Amount:", value: billDetails.gstAmount || 0 },
  ];

  let y = startY;
  items.forEach((item) => {
    if (item.value > 0) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(item.label, labelX, y)
        .text(formatCurrency(item.value), valueX, y, { align: "right", width: 65 });
      y += 15;
    }
  });

  // Total line
  doc
    .moveTo(labelX, y)
    .lineTo(545, y)
    .stroke();

  y += 5;

  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("TOTAL AMOUNT:", labelX, y)
    .text(formatCurrency(billDetails.totalAmount || 0), valueX, y, { align: "right", width: 65 });

  doc.y = y + 30;
}

// Helper for merged bill details
function generateMergedBillDetails(doc, invoice) {
  generateBillDetails(doc, invoice);
}

// Helper function to generate footer
function generateFooter(doc, invoice) {
  const pageHeight = doc.page.height;

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#666")
    .text(
      "This is a computer-generated invoice.",
      50,
      pageHeight - 80,
      { align: "center" }
    )
    .text(
      `Generated on: ${formatDate(new Date())}`,
      50,
      pageHeight - 65,
      { align: "center" }
    );

  if (invoice.isMerged) {
    doc.text(
      `Source Invoices: ${invoice.sourceInvoices?.length || 0}`,
      50,
      pageHeight - 50,
      { align: "center" }
    );
  }

  doc.fillColor("#000");
}

// ============================================
// NEW MERGED INVOICE FUNCTIONS (Matching Sample Invoice Style)
// ============================================

/**
 * Generate merged invoice header with company letterhead image
 */
function generateMergedHeader(doc) {
  const pageWidth = doc.page.width;
  const margin = 30;

  // Use the header image from assets folder
  const headerImagePath = path.join(__dirname, "../..", "assets", "invoice_header.jpeg");

  try {
    // Check if image exists and embed it
    if (fs.existsSync(headerImagePath)) {
      // Add header image - scale to fit page width with margins
      const imageWidth = pageWidth - 2 * margin;
      doc.image(headerImagePath, margin, 15, {
        width: imageWidth,
        align: "center"
      });
      // Set Y position after the image (approximate height based on aspect ratio)
      doc.y = 95;
    } else {
      // Fallback to text-based header if image not found
      console.warn("Header image not found at:", headerImagePath);
      generateTextBasedHeader(doc, pageWidth, margin);
    }
  } catch (error) {
    console.error("Error loading header image:", error);
    // Fallback to text-based header
    generateTextBasedHeader(doc, pageWidth, margin);
  }

  doc.y = 110;
}

/**
 * Fallback text-based header if image is not available
 */
function generateTextBasedHeader(doc, pageWidth, margin) {
  // Left side - Company name and logo area
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor("#1e3a5f")
    .text("ASHAPURI", margin, 25);

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#c41e3a")
    .text("SECURITY", margin, 45);

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#1e3a5f")
    .text("SERVICES", margin, 62);

  // Right side - Company contact details
  const rightX = 300;
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#000")
    .text(COMPANY_INFO.address, rightX, 25, { align: "right", width: pageWidth - rightX - margin })
    .text(COMPANY_INFO.address2, rightX, 35, { align: "right", width: pageWidth - rightX - margin })
    .text(COMPANY_INFO.tel, rightX, 45, { align: "right", width: pageWidth - rightX - margin })
    .text(COMPANY_INFO.mobile, rightX, 55, { align: "right", width: pageWidth - rightX - margin })
    .text(COMPANY_INFO.email, rightX, 65, { align: "right", width: pageWidth - rightX - margin });

  // INVOICE title bar
  doc
    .rect(margin, 82, pageWidth - 2 * margin, 20)
    .fill("#e8e8e8");

  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .fillColor("#000")
    .text("INVOICE", margin, 87, { align: "center", width: pageWidth - 2 * margin });
}

/**
 * Generate Bill To section (left) and Invoice Info box (right)
 */
function generateMergedBillToAndInvoiceInfo(doc, invoice, sourceInvoices) {
  const margin = 30;
  const pageWidth = doc.page.width;
  const startY = doc.y;

  // Get bill to info from merged invoice or first source invoice
  const billTo = invoice.billTo || {};
  const companyNames = invoice.mergedCompanies?.map(c =>
    typeof c === "object" ? c.name : c
  ) || [];

  // Left side - Bill To
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor("#000")
    .text("Bill To (Company Name) *", margin, startY);

  doc
    .fontSize(9)
    .font("Helvetica")
    .text(billTo.name || companyNames.join(" + ") || "N/A", margin, startY + 12);

  // Add order number if available
  if (billTo.address) {
    doc.text(billTo.address, margin, startY + 24);
  }

  // Add GST number
  if (billTo.gstNumber) {
    doc.text(`GSTIN NO ${billTo.gstNumber}`, margin, startY + 48);
  }

  // Right side - Invoice Info Box
  const boxX = 370;
  const boxWidth = pageWidth - boxX - margin;
  const boxY = startY;

  // Draw table for invoice info
  const rowHeight = 18;

  // Header row - INVOICE NO.
  doc.rect(boxX, boxY, boxWidth * 0.5, rowHeight).stroke();
  doc.rect(boxX + boxWidth * 0.5, boxY, boxWidth * 0.5, rowHeight).stroke();
  doc.fontSize(8).font("Helvetica-Bold").text("INVOICE NO.", boxX + 5, boxY + 5);
  doc.fontSize(8).font("Helvetica").text(invoice.invoiceNumber || "N/A", boxX + boxWidth * 0.5 + 5, boxY + 5);

  // DATE row
  doc.rect(boxX, boxY + rowHeight, boxWidth * 0.5, rowHeight).stroke();
  doc.rect(boxX + boxWidth * 0.5, boxY + rowHeight, boxWidth * 0.5, rowHeight).stroke();
  doc.fontSize(8).font("Helvetica-Bold").text("DATE", boxX + 5, boxY + rowHeight + 5);
  doc.fontSize(8).font("Helvetica").text(formatDateShort(invoice.createdAt), boxX + boxWidth * 0.5 + 5, boxY + rowHeight + 5);

  // MONTH OF row
  doc.rect(boxX, boxY + rowHeight * 2, boxWidth * 0.5, rowHeight).stroke();
  doc.rect(boxX + boxWidth * 0.5, boxY + rowHeight * 2, boxWidth * 0.5, rowHeight).stroke();
  doc.fontSize(8).font("Helvetica-Bold").text("MONTH OF", boxX + 5, boxY + rowHeight * 2 + 5);
  doc.fontSize(8).font("Helvetica").text(getMonthYear(invoice.createdAt), boxX + boxWidth * 0.5 + 5, boxY + rowHeight * 2 + 5);

  doc.y = startY + 75;
}

/**
 * Generate items table with company names and invoice numbers
 */
function generateMergedItemsTable(doc, invoice, sourceInvoices) {
  const margin = 30;
  const pageWidth = doc.page.width;
  const tableWidth = pageWidth - 2 * margin;
  const startY = doc.y + 10;

  // Column widths
  const cols = {
    sno: 35,
    desc: 200,
    sac: 60,
    days: 80,
    rate: 60,
    amount: tableWidth - 35 - 200 - 60 - 80 - 60
  };

  // Table header
  let x = margin;
  const headerY = startY;
  const headerHeight = 28;

  // Draw header cells with borders
  doc.rect(x, headerY, cols.sno, headerHeight).stroke();
  doc.rect(x + cols.sno, headerY, cols.desc, headerHeight).stroke();
  doc.rect(x + cols.sno + cols.desc, headerY, cols.sac, headerHeight).stroke();
  doc.rect(x + cols.sno + cols.desc + cols.sac, headerY, cols.days, headerHeight).stroke();
  doc.rect(x + cols.sno + cols.desc + cols.sac + cols.days, headerY, cols.rate, headerHeight).stroke();
  doc.rect(x + cols.sno + cols.desc + cols.sac + cols.days + cols.rate, headerY, cols.amount, headerHeight).stroke();

  // Header text
  doc.fontSize(8).font("Helvetica-Bold");
  doc.text("S. NO.", x + 5, headerY + 10);
  doc.text("DESCRIPTION", x + cols.sno + 5, headerY + 10);
  doc.text("SAC", x + cols.sno + cols.desc + 5, headerY + 10);
  doc.text("NO. OF MAN", x + cols.sno + cols.desc + cols.sac + 5, headerY + 5);
  doc.text("DAYS/MONTH", x + cols.sno + cols.desc + cols.sac + 5, headerY + 15);
  doc.text("RATE", x + cols.sno + cols.desc + cols.sac + cols.days + 5, headerY + 10);
  doc.text("AMOUNT", x + cols.sno + cols.desc + cols.sac + cols.days + cols.rate + 5, headerY + 10);

  // Category row (UNARMED GUARD)
  let y = headerY + headerHeight;
  const categoryHeight = 18;
  doc.rect(margin, y, tableWidth, categoryHeight).stroke();
  doc.fontSize(8).font("Helvetica-Bold").text("UNARMED GUARD (unskilled)", margin + 5, y + 5);
  y += categoryHeight;

  // Data rows - Each source invoice as a line item
  let totalManDays = 0;
  let totalAmount = 0;
  let sno = 1;

  sourceInvoices.forEach((srcInvoice) => {
    const companyName = typeof srcInvoice.companyId === "object"
      ? srcInvoice.companyId.name
      : "N/A";
    const invoiceNum = srcInvoice.invoiceNumber || "N/A";
    const description = `${companyName} (${invoiceNum})`;
    const manDays = srcInvoice.attendanceData?.totalPresentDays || 0;
    const perDayRate = srcInvoice.attendanceData?.perDayRate || 466;
    const baseAmount = srcInvoice.billDetails?.baseAmount || 0;

    totalManDays += manDays;
    totalAmount += baseAmount;

    const rowHeight = 16;

    // Draw row cells
    doc.rect(margin, y, cols.sno, rowHeight).stroke();
    doc.rect(margin + cols.sno, y, cols.desc, rowHeight).stroke();
    doc.rect(margin + cols.sno + cols.desc, y, cols.sac, rowHeight).stroke();
    doc.rect(margin + cols.sno + cols.desc + cols.sac, y, cols.days, rowHeight).stroke();
    doc.rect(margin + cols.sno + cols.desc + cols.sac + cols.days, y, cols.rate, rowHeight).stroke();
    doc.rect(margin + cols.sno + cols.desc + cols.sac + cols.days + cols.rate, y, cols.amount, rowHeight).stroke();

    // Row data
    doc.fontSize(8).font("Helvetica");
    doc.text(sno.toString(), margin + 5, y + 4);
    doc.text(truncateText(description, 35), margin + cols.sno + 5, y + 4);
    doc.text("998514", margin + cols.sno + cols.desc + 5, y + 4);
    doc.text(manDays.toString(), margin + cols.sno + cols.desc + cols.sac + 25, y + 4);
    doc.text(formatNumber(perDayRate), margin + cols.sno + cols.desc + cols.sac + cols.days + 5, y + 4);
    doc.text(formatNumber(baseAmount), margin + cols.sno + cols.desc + cols.sac + cols.days + cols.rate + 5, y + 4);

    y += rowHeight;
    sno++;

    // Check for page break
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  });

  // TOTAL row
  const totalRowHeight = 18;
  doc.rect(margin, y, tableWidth - cols.amount, totalRowHeight).stroke();
  doc.rect(margin + tableWidth - cols.amount, y, cols.amount, totalRowHeight).stroke();
  doc.fontSize(8).font("Helvetica-Bold").text("TOTAL", margin + tableWidth - cols.amount - 50, y + 5);
  doc.text(formatNumber(totalAmount), margin + tableWidth - cols.amount + 5, y + 5);

  doc.y = y + totalRowHeight;

  // Store total for later use
  doc._mergedTotalManDays = totalManDays;
  doc._mergedBaseTotal = totalAmount;
}

/**
 * Generate totals section with PF, ESIC, Service Charge, GST
 */
function generateMergedTotalsSection(doc, invoice) {
  const margin = 30;
  const pageWidth = doc.page.width;
  const rightColX = pageWidth - margin - 150;
  const amountX = pageWidth - margin - 70;
  let y = doc.y + 5;

  const billDetails = invoice.billDetails || {};

  // PF @13%
  doc.fontSize(9).font("Helvetica").text("PF @13%", margin, y);
  doc.text(formatNumber(billDetails.pfAmount || 0), amountX, y, { align: "right", width: 60 });
  y += 14;

  // ESIC @3.25%
  doc.text("ESIC @3.25%", margin, y);
  doc.text(formatNumber(billDetails.esicAmount || 0), amountX, y, { align: "right", width: 60 });
  y += 18;

  // Draw line
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
  y += 5;

  // SUB TOTAL
  const subTotal = (billDetails.baseAmount || 0) + (billDetails.pfAmount || 0) +
                   (billDetails.esicAmount || 0) + (billDetails.overtimeAmount || 0) +
                   (billDetails.bonusAmount || 0);
  doc.fontSize(9).font("Helvetica-Bold").text("SUB TOTAL", margin, y);
  doc.text(formatNumber(subTotal), amountX, y, { align: "right", width: 60 });
  y += 14;

  // Service charge @7%
  const serviceChargeRate = invoice.serviceChargeRate || 7;
  doc.fontSize(9).font("Helvetica").text(`Service charge @${serviceChargeRate}%`, margin, y);
  doc.text(formatNumber(billDetails.serviceCharge || 0), amountX, y, { align: "right", width: 60 });
  y += 18;

  // Draw line
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
  y += 5;

  // TOTAL (before GST)
  const totalBeforeGst = subTotal + (billDetails.serviceCharge || 0);
  doc.fontSize(9).font("Helvetica-Bold").text("TOTAL", margin, y);
  doc.text(formatNumber(totalBeforeGst), amountX, y, { align: "right", width: 60 });
  y += 14;

  // CGST @9%
  const cgst = (billDetails.gstAmount || 0) / 2;
  doc.fontSize(9).font("Helvetica").text("CGST @9%", margin, y);
  doc.text(formatNumber(cgst), amountX, y, { align: "right", width: 60 });
  y += 14;

  // SGST @9%
  doc.text("SGST @9%", margin, y);
  doc.text(formatNumber(cgst), amountX, y, { align: "right", width: 60 });
  y += 18;

  // GST Note box
  doc.rect(margin, y, pageWidth - 2 * margin, 30).stroke();
  doc.fontSize(8).font("Helvetica")
    .text("Note:- As per Notification no. 29/2018 dated 31.12.2018", margin + 5, y + 5)
    .text("100% GST paid directly by you (CGST & SGST excluded from Grand Total)", margin + 5, y + 17);
  y += 35;

  doc.y = y;
}

/**
 * Generate bank details and footer section
 */
function generateMergedBankAndFooter(doc, invoice) {
  const margin = 30;
  const pageWidth = doc.page.width;
  let y = doc.y + 5;

  const billDetails = invoice.billDetails || {};

  // Bank details box
  doc.rect(margin, y, (pageWidth - 2 * margin) * 0.6, 55).stroke();
  doc.fontSize(8).font("Helvetica-Bold").text(COMPANY_INFO.bank.name, margin + 5, y + 5);
  doc.fontSize(8).font("Helvetica")
    .text(`Pls Transfer Payment C/A ${COMPANY_INFO.bank.account}`, margin + 5, y + 17)
    .text(`IFSC CODE : ${COMPANY_INFO.bank.ifsc}`, margin + 5, y + 29)
    .text(COMPANY_INFO.bank.branch, margin + 5, y + 41);

  // Grand Total box
  const gtBoxX = margin + (pageWidth - 2 * margin) * 0.6;
  const gtBoxWidth = (pageWidth - 2 * margin) * 0.4;
  doc.rect(gtBoxX, y, gtBoxWidth, 55).stroke();

  doc.fontSize(10).font("Helvetica-Bold").text("Grand Total", gtBoxX + 10, y + 10);
  doc.fontSize(12).font("Helvetica-Bold").text(
    formatNumber(billDetails.totalAmount || 0),
    gtBoxX + 10,
    y + 28
  );

  y += 60;

  // Amount in words
  doc.rect(margin, y, pageWidth - 2 * margin, 25).stroke();
  doc.fontSize(9).font("Helvetica-Bold").text(
    numberToWords(billDetails.totalAmount || 0).toUpperCase() + " ONLY",
    margin + 5,
    y + 8
  );
  y += 30;

  // GSTIN and PAN
  doc.fontSize(8).font("Helvetica")
    .text(`GSTIN. NO. :${COMPANY_INFO.gstin} PAN NO. : ${COMPANY_INFO.pan}`, margin, y);
  y += 15;

  // Disclaimer text
  const disclaimer = "*Monthly Includes Reliever engaged for providing weekly off and leaves allowed for .... Nos. Mandays during the period. It is to be certified under oath that I have completed the above mentioned work as per terms & conditions given in the order. I have completed the statutory requirements viz.payments of minimum wages deposit of EPF and ESIC as mandated in transport rules under ACL payment sheet.the payment of wages made to employees,deposit of employees contribution deducted from salary and deposit of contribution of employer (both)for EPF and ESIC as given in the payment sheet enclosed for M/o ..... has been deposited in the account of employees. I have not claimed above bill previously. In case any information given above is found false/ incorrect the MPPTCL may take any action as deem fit and may also recover any excess amount so paid from me with interest and/or otherwise adjust from any amount due to me";

  doc.fontSize(6).font("Helvetica").text(disclaimer, margin, y, {
    width: pageWidth - 2 * margin,
    align: "justify"
  });

  y = doc.y + 15;

  // Signature line
  doc.fontSize(9).font("Helvetica-Bold").text("FOR ASHAPURI SECURITY SERVICES", margin, y, {
    align: "right",
    width: pageWidth - 2 * margin
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDateShort(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getMonthYear(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatNumber(num) {
  if (num === null || num === undefined) return "0.00";
  return parseFloat(num).toFixed(2);
}

function numberToWords(num) {
  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
                "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
                "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  num = Math.round(num);

  if (num === 0) return "ZERO RUPEES";

  function convertHundreds(n) {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " HUNDRED ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + " ";
    }
    return str;
  }

  let result = "";

  if (num >= 10000000) {
    result += convertHundreds(Math.floor(num / 10000000)) + "CRORE ";
    num %= 10000000;
  }

  if (num >= 100000) {
    result += convertHundreds(Math.floor(num / 100000)) + "LAKH ";
    num %= 100000;
  }

  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + "THOUSAND ";
    num %= 1000;
  }

  if (num >= 100) {
    result += convertHundreds(Math.floor(num / 100) * 100);
    num %= 100;
  }

  if (num > 0) {
    result += convertHundreds(num);
  }

  return result.trim() + " RUPEES";
}

// Utility functions
function formatDate(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function truncateText(text, maxLength) {
  if (!text) return "N/A";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

module.exports = {
  generateInvoicePDF,
  generateMergedInvoicePDF,
};
