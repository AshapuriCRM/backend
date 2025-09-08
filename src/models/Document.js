const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Document name is required'],
    trim: true,
    maxlength: [200, 'Document name cannot be more than 200 characters']
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required'],
    trim: true
  },
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Document type is required'],
    trim: true
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    trim: true
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  url: {
    type: String,
    required: [true, 'Document URL is required'],
    trim: true
  },
  path: {
    type: String,
    required: [true, 'File path is required'],
    trim: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required']
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentFolder'
  },
  category: {
    type: String,
    enum: [
      'company-registration',
      'gst-certificate',
      'pan-card',
      'license',
      'contract',
      'invoice',
      'receipt',
      'employee-document',
      'attendance',
      'salary-slip',
      'other'
    ],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  accessLevel: {
    type: String,
    enum: ['private', 'company', 'public'],
    default: 'company'
  },
  permissions: {
    canView: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    canEdit: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    canDelete: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  metadata: {
    exifData: { type: mongoose.Schema.Types.Mixed },
    documentProperties: { type: mongoose.Schema.Types.Mixed },
    extractedText: { type: String },
    pageCount: { type: Number },
    duration: { type: Number } // for video/audio files
  },
  version: {
    type: Number,
    default: 1,
    min: [1, 'Version must be at least 1']
  },
  parentDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  versions: [{
    version: { type: Number },
    fileName: { type: String },
    size: { type: Number },
    uploadedAt: { type: Date },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changes: { type: String }
  }],
  downloadCount: {
    type: Number,
    default: 0,
    min: [0, 'Download count cannot be negative']
  },
  lastAccessed: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploaded by user is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for file size in human readable format
documentSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for file extension
documentSchema.virtual('extension').get(function() {
  return this.originalName.split('.').pop().toLowerCase();
});

// Virtual for days until expiry
documentSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const today = new Date();
  const timeDiff = this.expiryDate - today;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
documentSchema.index({ companyId: 1, category: 1 });
documentSchema.index({ employeeId: 1 });
documentSchema.index({ folderId: 1 });
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ name: 'text', description: 'text', tags: 'text' });
documentSchema.index({ expiryDate: 1 });
documentSchema.index({ isArchived: 1 });

// Pre-save middleware to generate unique file name
documentSchema.pre('save', function(next) {
  if (this.isNew && !this.fileName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const extension = this.originalName.split('.').pop();
    this.fileName = `${timestamp}_${random}.${extension}`;
  }
  next();
});

// Pre-save middleware to set archived date
documentSchema.pre('save', function(next) {
  if (this.isModified('isArchived') && this.isArchived && !this.archivedAt) {
    this.archivedAt = new Date();
  } else if (this.isModified('isArchived') && !this.isArchived) {
    this.archivedAt = undefined;
  }
  next();
});

// Method to increment download count
documentSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  this.lastAccessed = new Date();
  return this.save({ validateBeforeSave: false });
};

// Method to create new version
documentSchema.methods.createVersion = function(newFileData, changes, userId) {
  this.versions.push({
    version: this.version,
    fileName: this.fileName,
    size: this.size,
    uploadedAt: this.updatedAt || this.createdAt,
    uploadedBy: this.uploadedBy,
    changes: changes
  });
  
  // Update current document with new version data
  this.version += 1;
  this.fileName = newFileData.fileName;
  this.size = newFileData.size;
  this.url = newFileData.url;
  this.path = newFileData.path;
  this.uploadedBy = userId;
  
  return this.save();
};

module.exports = mongoose.model('Document', documentSchema);