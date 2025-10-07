const mongoose = require("mongoose");

const salarySlipSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
    },
    employeeName: {
      type: String,
      required: [true, "Employee name is required"],
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
    },
    month: {
      type: String,
      required: [true, "Month is required"],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
      min: [2020, "Year must be 2020 or later"],
      max: [2050, "Year cannot be more than 2050"],
    },
    payPeriod: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    attendance: {
      totalWorkingDays: {
        type: Number,
        required: [true, "Total working days is required"],
        min: [1, "Total working days must be at least 1"],
        max: [31, "Total working days cannot exceed 31"],
      },
      daysPresent: {
        type: Number,
        required: [true, "Days present is required"],
        min: [0, "Days present cannot be negative"],
      },
      daysAbsent: {
        type: Number,
        required: [true, "Days absent is required"],
        min: [0, "Days absent cannot be negative"],
      },
      overtimeHours: {
        type: Number,
        default: 0,
        min: [0, "Overtime hours cannot be negative"],
      },
      leavesTaken: {
        casual: { type: Number, default: 0, min: 0 },
        sick: { type: Number, default: 0, min: 0 },
        earned: { type: Number, default: 0, min: 0 },
      },
    },
    salary: {
      basicSalary: {
        type: Number,
        required: [true, "Basic salary is required"],
        min: [0, "Basic salary cannot be negative"],
      },
      allowances: {
        hra: { type: Number, default: 0, min: 0 },
        transport: { type: Number, default: 0, min: 0 },
        medical: { type: Number, default: 0, min: 0 },
        special: { type: Number, default: 0, min: 0 },
        overtime: { type: Number, default: 0, min: 0 },
      },
      grossSalary: {
        type: Number,
        required: [true, "Gross salary is required"],
        min: [0, "Gross salary cannot be negative"],
      },
    },
    deductions: {
      pf: {
        employeeContribution: { type: Number, default: 0, min: 0 },
        employerContribution: { type: Number, default: 0, min: 0 },
      },
      esic: {
        employeeContribution: { type: Number, default: 0, min: 0 },
        employerContribution: { type: Number, default: 0, min: 0 },
      },
      tax: {
        tds: { type: Number, default: 0, min: 0 },
        professionalTax: { type: Number, default: 0, min: 0 },
      },
      other: {
        advance: { type: Number, default: 0, min: 0 },
        loan: { type: Number, default: 0, min: 0 },
        penalty: { type: Number, default: 0, min: 0 },
      },
      totalDeductions: {
        type: Number,
        default: 0,
        min: [0, "Total deductions cannot be negative"],
      },
    },
    bonus: {
      type: Number,
      default: 0,
      min: [0, "Bonus cannot be negative"],
    },
    totalSalary: {
      type: Number,
      required: [true, "Total salary is required"],
      min: [0, "Total salary cannot be negative"],
    },
    paymentInfo: {
      paymentDate: { type: Date },
      paymentMethod: {
        type: String,
        enum: ["bank-transfer", "cash", "cheque", "upi"],
        default: "bank-transfer",
      },
      bankDetails: {
        accountNumber: { type: String, trim: true },
        ifscCode: { type: String, trim: true },
        bankName: { type: String, trim: true },
      },
      transactionId: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ["draft", "approved", "paid", "cancelled"],
      default: "draft",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot be more than 500 characters"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    xlsxFile: {
      public_id: { type: String },
      url: { type: String },
      secure_url: { type: String },
      original_filename: { type: String },
      uploadedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for attendance percentage
salarySlipSchema.virtual("attendancePercentage").get(function () {
  return Math.round(
    (this.attendance.daysPresent / this.attendance.totalWorkingDays) * 100
  );
});

// Virtual for net salary (total salary after all calculations)
salarySlipSchema.virtual("netSalary").get(function () {
  return this.salary.grossSalary - this.deductions.totalDeductions + this.bonus;
});

// Indexes for better query performance
salarySlipSchema.index({ employeeId: 1, year: 1, month: 1 }, { unique: true });
salarySlipSchema.index({ companyId: 1, year: 1, month: 1 });
salarySlipSchema.index({ status: 1 });
salarySlipSchema.index({ "payPeriod.startDate": 1, "payPeriod.endDate": 1 });

// Pre-validate middleware to calculate total deductions
salarySlipSchema.pre("validate", function (next) {
  const deductions = this.deductions || {};
  const pf = deductions.pf || {};
  const esic = deductions.esic || {};
  const tax = deductions.tax || {};
  const other = deductions.other || {};

  const totalDeductions =
    Number(pf.employeeContribution || 0) +
    Number(esic.employeeContribution || 0) +
    Number(tax.tds || 0) +
    Number(tax.professionalTax || 0) +
    Number(other.advance || 0) +
    Number(other.loan || 0) +
    Number(other.penalty || 0);

  this.deductions.totalDeductions = totalDeductions;

  const gross = Number(this.salary?.grossSalary || 0);
  const bonus = Number(this.bonus || 0);
  this.totalSalary = Math.max(0, gross - totalDeductions + bonus);

  next();
});

// Pre-validate middleware to ensure attendance consistency
salarySlipSchema.pre("validate", function (next) {
  if (
    this.attendance &&
    this.attendance.daysPresent + this.attendance.daysAbsent >
      this.attendance.totalWorkingDays
  ) {
    return next(
      new Error("Days present + days absent cannot exceed total working days")
    );
  }
  next();
});

// Pre-validate middleware to set employee name from Employee document
salarySlipSchema.pre("validate", async function (next) {
  if (!this.employeeName || this.isNew || this.isModified("employeeId")) {
    try {
      const Employee = mongoose.model("Employee");
      const employee = await Employee.findById(this.employeeId).select("name");
      if (employee) {
        this.employeeName = employee.name;
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("SalarySlip", salarySlipSchema);
