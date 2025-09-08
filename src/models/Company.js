const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot be more than 100 characters']
  },
  logo: {
    type: String,
    default: 'https://images.pexels.com/photos/416405/pexels-photo-416405.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
    maxlength: [200, 'Location cannot be more than 200 characters']
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true }
  },
  contactInfo: {
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    website: { type: String, trim: true }
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
  },
  panNumber: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
  },
  employeeCount: {
    type: Number,
    default: 0,
    min: [0, 'Employee count cannot be negative']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  contractInfo: {
    startDate: { type: Date },
    endDate: { type: Date },
    contractValue: { type: Number, min: 0 },
    paymentTerms: { type: String, trim: true }
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

// Virtual for employee count from Employee collection
companySchema.virtual('actualEmployeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'companyId',
  count: true
});

// Index for better query performance
companySchema.index({ name: 1, status: 1 });
companySchema.index({ createdBy: 1 });
companySchema.index({ 'contactInfo.email': 1 });

// Pre-save middleware to update employee count
companySchema.pre('save', function(next) {
  if (this.isNew) {
    this.employeeCount = 0;
  }
  next();
});

module.exports = mongoose.model('Company', companySchema);