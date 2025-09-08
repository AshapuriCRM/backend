const mongoose = require('mongoose');

const jobCategorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job category title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  baseWage: {
    type: Number,
    required: [true, 'Base wage is required'],
    min: [0, 'Base wage cannot be negative']
  },
  wageType: {
    type: String,
    enum: ['monthly', 'daily', 'hourly'],
    default: 'monthly'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required']
  },
  ratesApplied: {
    type: Boolean,
    default: true
  },
  taxRates: {
    gstRate: {
      type: Number,
      default: 18,
      min: [0, 'GST rate cannot be negative'],
      max: [100, 'GST rate cannot be more than 100%']
    },
    pfRate: {
      type: Number,
      default: 12,
      min: [0, 'PF rate cannot be negative'],
      max: [100, 'PF rate cannot be more than 100%']
    },
    esicRate: {
      type: Number,
      default: 3.25,
      min: [0, 'ESIC rate cannot be negative'],
      max: [100, 'ESIC rate cannot be more than 100%']
    },
    serviceChargeRate: {
      type: Number,
      default: 7,
      min: [0, 'Service charge rate cannot be negative'],
      max: [100, 'Service charge rate cannot be more than 100%']
    }
  },
  benefits: {
    medicalInsurance: { type: Boolean, default: false },
    lifeInsurance: { type: Boolean, default: false },
    providentFund: { type: Boolean, default: true },
    gratuity: { type: Boolean, default: false },
    bonus: { 
      type: Number, 
      default: 0,
      min: [0, 'Bonus cannot be negative'] 
    }
  },
  workingConditions: {
    workingHours: { 
      type: Number, 
      default: 8,
      min: [1, 'Working hours must be at least 1'],
      max: [24, 'Working hours cannot exceed 24']
    },
    workingDays: { 
      type: Number, 
      default: 26,
      min: [1, 'Working days must be at least 1'],
      max: [31, 'Working days cannot exceed 31']
    },
    overtimeRate: { 
      type: Number, 
      default: 1.5,
      min: [1, 'Overtime rate must be at least 1x']
    }
  },
  requirements: {
    minimumEducation: { type: String, trim: true },
    experience: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    certifications: [{ type: String, trim: true }]
  },
  isActive: {
    type: Boolean,
    default: true
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

// Virtual for employee count in this category
jobCategorySchema.virtual('employeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'categoryId',
  count: true
});

// Indexes for better query performance
jobCategorySchema.index({ companyId: 1, isActive: 1 });
jobCategorySchema.index({ title: 1, companyId: 1 }, { unique: true });
jobCategorySchema.index({ baseWage: 1 });

// Pre-save middleware to ensure unique title per company
jobCategorySchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('title')) {
    const existingCategory = await this.constructor.findOne({
      title: this.title,
      companyId: this.companyId,
      _id: { $ne: this._id }
    });
    
    if (existingCategory) {
      const error = new Error('Job category with this title already exists for this company');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('JobCategory', jobCategorySchema);