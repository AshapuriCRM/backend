const ExcelJS = require("exceljs");

/**
 * Generate salary slip XLSX for one or multiple employees
 * @param {Object[]} employees - Array of employee objects (with salary slip info)
 * @param {Object} options - { month, year, companyName, generatedDate }
 * @returns {Promise<Buffer>} - XLSX file buffer
 */
async function generateSalarySlipXlsx(employees, options) {
  const { month, year, companyName, generatedDate } = options;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Salary Slips");

  // 1. Heading row (merged)
  sheet.mergeCells("A1", "F1");
  sheet.getCell("A1").value = "ASHAPURI SECURITY SERVICE";
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getCell("A1").font = { size: 16, bold: true };

  // 2. Subheading row (merged)
  const subheading = `MONTH OF ${month.toUpperCase()} - ${year} | ${companyName} | ${generatedDate}`;
  sheet.mergeCells("A2", "F2");
  sheet.getCell("A2").value = subheading;
  sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getCell("A2").font = { size: 12, bold: true };

  // 3. Table header
  sheet.addRow([
    "ASHAPURI A/C NO.",
    "IFSC CODE",
    "A/C CODE",
    "A/C NUMBER",
    "NAME OF EMPLOYEE",
    "SALARY",
  ]);
  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };

  // 4. Data rows
  employees.forEach((emp) => {
    sheet.addRow([
      "07881010001960",
      emp.ifscCode || emp.documents?.bankAccount?.ifscCode || "",
      "", // A/C CODE (not provided in model)
      emp.accountNumber || emp.documents?.bankAccount?.accountNumber || "",
      emp.name || emp.employeeName || "",
      emp.netSalary || emp.totalSalary || "",
    ]);
  });

  // Set column widths
  [20, 15, 12, 20, 25, 15].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateSalarySlipXlsx };
