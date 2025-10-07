const cloudinary = require("../config/cloudinary");
const fs = require("fs");

/**
 * Uploads a buffer to Cloudinary as a raw file (XLSX)
 * @param {Buffer} buffer
 * @param {String} filename
 * @returns {Promise<Object>} Cloudinary upload result
 */
async function uploadXlsxToCloudinary(buffer, filename) {
  // Write buffer to temp file
  const tempPath = `/tmp/${Date.now()}-${filename}`;
  fs.writeFileSync(tempPath, buffer);
  try {
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      folder: "salary-slips",
      public_id: filename.replace(/\.xlsx$/, ""),
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });
    return result;
  } finally {
    fs.unlinkSync(tempPath);
  }
}

module.exports = { uploadXlsxToCloudinary };
