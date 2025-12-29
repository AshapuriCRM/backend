const cloudinary = require("../config/cloudinary");
const fs = require("fs");

async function uploadEmployeePhotoToCloudinary(localPath, options = {}) {
  const folder = options.folder || "employee-photos";
  console.log(`[Cloudinary] Starting upload. path=${localPath}, folder=${folder}`);
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder,
      resource_type: "image",
      overwrite: true,
      unique_filename: true,
      transformation: options.transformation || [{ quality: "auto:good" }],
    });
    console.log(`[Cloudinary] Upload success. public_id=${result.public_id}`);
    return result; // includes secure_url, public_id, etc.
  } finally {
    // Always attempt to cleanup local file
    try {
      if (localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      console.log(`[Cloudinary] Cleaned up local file ${localPath}`);
    } catch (e) {
      // swallow cleanup errors
      console.warn("[Cloudinary] Could not cleanup temp photo:", localPath, e?.message);
    }
  }
}

module.exports = { uploadEmployeePhotoToCloudinary };
