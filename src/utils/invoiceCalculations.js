// Tax and charge rates
const TAX_RATES = {
  SERVICE_CHARGE_RATE: 0.07, // 7%
  PF_RATE: 0.13, // 13%
  ESIC_RATE: 0.0325, // 3.25%
  CGST_RATE: 0.09, // 9%
  SGST_RATE: 0.09, // 9%
  IGST_RATE: 0.18, // 18% (for inter-state)
};

/**
 * Calculate salary breakdown for individual employee
 * @param {number} presentDays - Number of days present
 * @param {number} wagesPerDay - Daily wage rate
 * @returns {object} Salary breakdown
 */
const calculateSalary = (presentDays, wagesPerDay = 466) => {
  const gross = presentDays * wagesPerDay;
  const epf = gross * 0.12; // 12% EPF
  const esic = gross * 0.0075; // 0.75% ESIC
  const net = gross - (epf + esic);
  
  return {
    gross: parseFloat(gross.toFixed(2)),
    epf: parseFloat(epf.toFixed(2)),
    esic: parseFloat(esic.toFixed(2)),
    net: parseFloat(net.toFixed(2)),
  };
};

/**
 * Calculate invoice totals based on attendance data
 * @param {number} totalPresentDays - Total present days across all employees
 * @param {number} perDayRate - Rate per day
 * @param {string} taxType - 'gst' or 'igst'
 * @returns {object} Invoice calculations
 */
const calculateInvoiceTotals = (totalPresentDays, perDayRate, taxType = 'gst') => {
  // Base calculations
  const baseTotal = Number(totalPresentDays) * Number(perDayRate);
  const serviceCharge = baseTotal * TAX_RATES.SERVICE_CHARGE_RATE;
  const pf = baseTotal * TAX_RATES.PF_RATE;
  const esic = baseTotal * TAX_RATES.ESIC_RATE;
  
  // Subtotal before rounding
  const subTotal = baseTotal + pf + esic;
  const roundOffSubTotal = Math.round(subTotal);
  const roundOffDiff = parseFloat((roundOffSubTotal - subTotal).toFixed(2));
  
  // Total before tax
  const totalBeforeTax = roundOffSubTotal + serviceCharge;
  
  // Tax calculations
  let taxBreakdown = {};
  if (taxType === 'gst') {
    taxBreakdown = {
      cgst: totalBeforeTax * TAX_RATES.CGST_RATE,
      sgst: totalBeforeTax * TAX_RATES.SGST_RATE,
      totalTax: totalBeforeTax * (TAX_RATES.CGST_RATE + TAX_RATES.SGST_RATE)
    };
  } else if (taxType === 'igst') {
    taxBreakdown = {
      igst: totalBeforeTax * TAX_RATES.IGST_RATE,
      totalTax: totalBeforeTax * TAX_RATES.IGST_RATE
    };
  }
  
  const grandTotal = Math.round(totalBeforeTax + taxBreakdown.totalTax);
  
  return {
    baseAmount: parseFloat(baseTotal.toFixed(2)),
    serviceCharge: parseFloat(serviceCharge.toFixed(2)),
    pfAmount: parseFloat(pf.toFixed(2)),
    esicAmount: parseFloat(esic.toFixed(2)),
    subTotal: parseFloat(subTotal.toFixed(2)),
    roundOffAmount: roundOffSubTotal,
    roundOffDifference: roundOffDiff,
    totalBeforeTax: parseFloat(totalBeforeTax.toFixed(2)),
    taxBreakdown,
    grandTotal,
    grandTotalInWords: numberToWords(grandTotal)
  };
};

/**
 * Generate invoice number
 * @returns {string} Invoice number in format INV-YYYY-MM-DD-XXX
 */
const generateInvoiceNumber = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const random = Math.floor(100 + Math.random() * 900);
  
  return `INV-${year}-${month}-${day}-${random}`;
};

/**
 * Convert number to words (Indian numbering system)
 * @param {number} num - Number to convert
 * @returns {string} Number in words
 */
const numberToWords = (num) => {
  const units = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"
  ];
  const teens = [
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", 
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", 
    "Sixty", "Seventy", "Eighty", "Ninety"
  ];
  const thousands = ["", "Thousand", "Lakh", "Crore"];

  if (num === 0) return "Zero Rupees Only";

  const convertLessThanThousand = (n) => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
    return `${units[Math.floor(n / 100)]} Hundred ${convertLessThanThousand(n % 100)}`.trim();
  };

  let result = "";
  let place = 0;
  
  while (num > 0) {
    if (num % 1000 !== 0) {
      let part = convertLessThanThousand(num % 1000);
      if (place > 0) part += ` ${thousands[place]}`;
      result = `${part} ${result}`.trim();
    }
    num = Math.floor(num / 1000);
    place++;
  }
  
  return `${result} Rupees Only`.toUpperCase();
};

/**
 * Format date for invoice
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
const formatInvoiceDate = (date = new Date()) => {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric",
  });
};

/**
 * Get month/year string for invoice
 * @param {Date} date - Date to format
 * @returns {string} Month and year in uppercase
 */
const getInvoiceMonth = (date = new Date()) => {
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  }).toUpperCase();
};

/**
 * Calculate total statistics from parsed attendance data
 * @param {Array} parsedData - Array of employee attendance data
 * @param {number} perDayRate - Rate per day
 * @returns {object} Total statistics
 */
const getTotalStats = (parsedData, perDayRate) => {
  if (!parsedData.length) {
    return {
      totalEmployees: 0,
      totalGross: 0,
      totalNet: 0,
      totalPresentDays: 0,
    };
  }

  return parsedData.reduce(
    (acc, entry) => {
      const { gross, net } = calculateSalary(entry.present_day || entry.presentDays, perDayRate);
      return {
        totalEmployees: acc.totalEmployees + 1,
        totalGross: acc.totalGross + gross,
        totalNet: acc.totalNet + net,
        totalPresentDays: acc.totalPresentDays + (entry.present_day || entry.presentDays || 0),
      };
    },
    { totalEmployees: 0, totalGross: 0, totalNet: 0, totalPresentDays: 0 }
  );
};

module.exports = {
  TAX_RATES,
  calculateSalary,
  calculateInvoiceTotals,
  generateInvoiceNumber,
  numberToWords,
  formatInvoiceDate,
  getInvoiceMonth,
  getTotalStats
};