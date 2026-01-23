import cloudinaryUpload from "../../common/configs/cloudinary.ts";

const uploadFile = async (file: Express.Multer.File) => {
  const result = await cloudinaryUpload(file.buffer, {
    folder: `telex-admin/blog-cover`,
    resource_type: "auto",
  });

  return result.url;
};

export default uploadFile;
