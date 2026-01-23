import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse, UploadApiOptions } from "cloudinary";
import streamifier from "streamifier";

type CloudinaryUploadFn = (
  buffer: Buffer,
  options?: UploadApiOptions,
) => Promise<UploadApiResponse>;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !key || !secret) {
  throw new Error("Cloudinary .env variables not set");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: key,
  api_secret: secret,
});

const cloudinaryUpload: CloudinaryUploadFn = (buffer, options) => {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      if (!result)
        return reject(new Error("Cloudinary upload returned no result"));

      resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export default cloudinaryUpload;
