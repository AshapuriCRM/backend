const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
  {
    folder_name: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    soft_delete: { type: Boolean, default: false },
    files: [
      {
        name: { type: String, required: true },
        size: { type: String },
        file_type: { type: String, required: true },
        created_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        file_url: { type: String, required: true },
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanyFolder", folderSchema);
