const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

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
        margin: 50,
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
        margin: 50,
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

      // Generate merged invoice content
      generateHeader(doc, mergedInvoice, true);
      generateMergedInvoiceInfo(doc, mergedInvoice, sourceInvoices);
      generateMergedCompaniesSection(doc, mergedInvoice);
      generateSourceInvoicesSummary(doc, sourceInvoices);
      generateMergedEmployeeTable(doc, mergedInvoice);
      generateMergedBillDetails(doc, mergedInvoice);
      generateFooter(doc, mergedInvoice);

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
