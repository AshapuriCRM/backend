const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    trim: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required']
  },
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  fileType: {
    type: String,
    required: [true, 'File type is required'],
    enum: ['pdf', 'excel', 'image', 'unknown'],
    default: 'unknown'
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required'],
    trim: true
  },
  fileSize: {
    type: Number,
    min: [0, 'File size cannot be negative']
  },
  taxType: {
    type: String,
    enum: ['gst', 'igst'],
    required: [true, 'Tax type is required']
  },
  paymentMethod: {
    type: String,
    enum: ['paid-by-us', 'paid-by-principal'],
    required: [true, 'Payment method is required']
  },
  gstPaidBy: {
    type: String,
    enum: ['principal-employer', 'ashapuri'],
    default: 'principal-employer'
  },
  serviceChargeRate: {
    type: Number,
    default: 7,
    min: [0, 'Service charge rate cannot be negative'],
    max: [100, 'Service charge rate cannot exceed 100%']
  },
  billDetails: {
    baseAmount: {
      type: Number,
      required: [true, 'Base amount is required'],
      min: [0, 'Base amount cannot be negative']
    },
    serviceCharge: {
      type: Number,
      default: 0,
      min: [0, 'Service charge cannot be negative']
    },
    pfAmount: {
      type: Number,
      default: 0,
      min: [0, 'PF amount cannot be negative']
    },
    esicAmount: {
      type: Number,
      default: 0,
      min: [0, 'ESIC amount cannot be negative']
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: [0, 'GST amount cannot be negative']
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative']
    }
  },
  attendanceData: {
    totalEmployees: { type: Number, min: 0 },
    totalPresentDays: { type: Number, min: 0 },
    perDayRate: { type: Number, min: 0 },
    workingDays: { type: Number, min: 0 }
  },
  processedData: {
    extractedEmployees: [{
      name: { type: String, trim: true },
      presentDays: { type: Number, min: 0 },
      totalDays: { type: Number, min: 0 },
      salary: { type: Number, min: 0 }
    }],
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    processingDate: { type: Date },
    errorMessage: { type: String, trim: true }
  },
  billTo: {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    contactInfo: { type: String, trim: true }
  },
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'failed'],
    default: 'pending'
  },
  paymentDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for days until due
invoiceSchema.virtual('daysToDue').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const timeDiff = this.dueDate - today;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
});

// Virtual for invoice age
invoiceSchema.virtual('invoiceAge').get(function() {
  const today = new Date();
  const timeDiff = today - this.createdAt;
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
invoiceSchema.index({ companyId: 1, status: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ paymentStatus: 1 });

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Pre-save middleware to set due date if not provided
invoiceSchema.pre('save', function(next) {
  if (this.isNew && !this.dueDate) {
    this.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);