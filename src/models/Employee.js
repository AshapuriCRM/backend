const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Employee name is required"],
      trim: true,
      maxlength: [100, "Employee name cannot be more than 100 characters"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.[a-zA-Z]{2,})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[+]?[\d\s-()]{10,15}$/, "Please enter a valid phone number"],
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: "India", trim: true },
    },
    category: {
      type: String,
      required: [true, "Job category is required"],
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCategory",
    },
    dateJoined: {
      type: Date,
      required: [true, "Date joined is required"],
      default: Date.now,
    },
    salary: {
      type: Number,
      required: [true, "Salary is required"],
      min: [0, "Salary cannot be negative"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "terminated", "on-leave"],
      default: "active",
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
    },
    documents: {
      aadhar: { type: String, trim: true },
      pan: { type: String, trim: true, uppercase: true },
      bankAccount: {
        accountNumber: {
          type: String,
          trim: true,
          required: [true, "Account number is required"],
        },
        ifscCode: {
          type: String,
          trim: true,
          uppercase: true,
          required: [true, "IFSC code is required"],
        },
        bankName: {
          type: String,
          trim: true,
          required: [true, "Bank name is required"],
        },
      },
      photo: { type: String, trim: true },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    workSchedule: {
      shiftType: {
        type: String,
        enum: ["day", "night", "rotating"],
        default: "day",
      },
      workingDays: { type: Number, default: 26, min: 1, max: 31 },
      workingHours: { type: Number, default: 8, min: 1, max: 24 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for years of service
employeeSchema.virtual("yearsOfService").get(function () {
  const now = new Date();
  const joined = this.dateJoined;
  return Math.floor((now - joined) / (365.25 * 24 * 60 * 60 * 1000));
});

// Indexes for better query performance
employeeSchema.index({ companyId: 1, status: 1 });
employeeSchema.index({ email: 1 }, { unique: true });
employeeSchema.index({ category: 1 });
employeeSchema.index({ dateJoined: 1 });
employeeSchema.index({ name: "text", email: "text" });

// Pre-save middleware to update company employee count
employeeSchema.post("save", async function () {
  const Company = mongoose.model("Company");
  const count = await mongoose.model("Employee").countDocuments({
    companyId: this.companyId,
    status: "active",
  });
  await Company.findByIdAndUpdate(this.companyId, { employeeCount: count });
});

// Post-remove middleware to update company employee count
employeeSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    const Company = mongoose.model("Company");
    const count = await mongoose.model("Employee").countDocuments({
      companyId: doc.companyId,
      status: "active",
    });
    await Company.findByIdAndUpdate(doc.companyId, { employeeCount: count });
  }
});

module.exports = mongoose.model("Employee", employeeSchema);
