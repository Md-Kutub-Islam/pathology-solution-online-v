import {
  EMAIL_VERIFY_PAGE,
  cookieOptions,
  RESET_PASS_PAGE,
} from "../constants.js";
import Admin from "../models/admin.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SendEmail } from "../utils/SendMail.js";
import moment from "moment-timezone";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { adminInfo } from "../utils/pipeline/adminInfo.js";

const ignoreFields =
  "-password -refreshToken -emailVerificationExpiry -emailVerificationToken -createdAt";

const findAdmin = async (email) => {
  try {
    return await Admin.findOne({ email });
  } catch (error) {
    throw new ApiError(500, `Something went wrong error - ${error}`);
  }
};

const generateToken = async (newAmin) => {
  try {
    const verificationToken = await newAmin.generateTemporaryToken();
    const { unHashedToken, hashedToken, tokenExpiry } = verificationToken;

    const now = new Date();
    const addTime = 20 * 60 * 1000;
    const expiry = new Date(now.getTime() + addTime);

    return { unHashedToken, hashedToken, tokenExpiry, expiry };
  } catch (error) {
    throw new ApiError(500, `Something went wrong error - ${error}`);
  }
};

export const registerAdmin = asyncHandler(async (req, res) => {
  const { labname, description, email, password } = await req.body;

  if (!labname || !description || !email || !password) {
    throw new ApiError(400, "missing required fields");
  }

  const existingAdmin = await findAdmin(email);

  if (existingAdmin) {
    if (existingAdmin.email === email) {
      throw new ApiError(409, "email already exists");
    }
  }

  const data = {
    labname: labname,
    description: description,
    email: email,
    password: password,
  };

  const newAdmin = await Admin.create(data);

  if (!newAdmin) {
    throw new ApiError(500, "something went worng");
  }

  const token = await generateToken(newAdmin);
  const newAdminInfo = await Admin.findByIdAndUpdate(
    newAdmin._id,
    {
      $set: {
        emailVerificationToken: token.hashedToken,
        emailVerificationExpiry: token.expiry,
      },
    },
    { new: true }
  ).select(ignoreFields);

  const basePath = process.env.CORS_ORIGIN;
  const emailData = {
    email: newAdminInfo.email,
    template: "ConfirmEmail",
    url: `${basePath}${EMAIL_VERIFY_PAGE}?token=${token.unHashedToken}`,
    subject: "Email Verification",
  };
  await SendEmail(emailData);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { adminInfo: newAdminInfo },
        "Admin registered successfully"
      )
    );
});

export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = await req.body;

  if (!email) {
    throw new ApiError(400, "missing required fields");
  }

  if (!password) {
    throw new ApiError(400, "missing required fields");
  }

  const admin = await findAdmin(email);

  if (!admin) {
    throw new ApiError(404, "admin not found");
  }

  const isPasswordValid = await admin.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(500, "invalid credentials");
  }

  if (!admin.isEmailVerified) {
    const currentDate = new Date();
    const tokenExpired = admin?.emailVerificationExpiry < currentDate;

    if (!tokenExpired) {
      throw new ApiError(
        310,
        "your email has not been verified. A verification link already sent to your email address"
      );
    }

    const token = await generateToken(admin);
    const basePath = process.env.CORS_ORIGIN;
    const emailData = {
      email: admin.email,
      template: "ConfirmEmail",
      url: `${basePath}${EMAIL_VERIFY_PAGE}?token=${token.unHashedToken}`,
      subject: "Email Verification",
    };

    await SendEmail(emailData);

    await Admin.findByIdAndUpdate(
      admin._id,
      {
        $set: {
          emailVerificationToken: token.hashedToken,
          emailVerificationExpiry: token.expiry,
        },
      },
      { new: true }
    );

    throw new ApiError(
      310,
      "your email has not been verified. A verification link has been sent to your email address"
    );
  }

  const refreshToken = await admin.generateRefreshToken();
  const accessToken = await admin.generateAccessToken();

  const loggedInAdminInfo = await Admin.findByIdAndUpdate(
    admin?._id,
    { $set: { refreshToken: refreshToken } },
    { new: true }
  ).select(ignoreFields);

  if (!loggedInAdminInfo) {
    throw new ApiError(500, "something went worng");
  }

  // const formattedDate = moment(loggedInUserInfo.updatedAt)
  //   .tz("Asia/Kolkata")
  //   .format("MMMM D, YYYY [at] h:mm A");
  // await Notification.create({
  //   user: loggedInUserInfo._id,
  //   notification: `Your account logged in from ${deviceInfo.os} (${deviceInfo.browser}) on ${formattedDate}`,
  // });

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { adminInfo: loggedInAdminInfo },
        "admin login successfully"
      )
    );
});

export const logoutAdmin = asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(
    req.admin?._id,
    {
      $unset: {
        refreshToken: 1,
        emailVerificationToken: 1,
        emailVerificationExpiry: 1,
        forgotPasswordToken: 1,
        forgotPasswordExpiry: 1,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, "admin logged out"));
});

export const getCurrentAdmin = asyncHandler(async (req, res) => {
  const admin = await req.admin;
  return res
    .status(200)
    .json(
      new ApiResponse(200, { adminInfo: admin }, "admin fetched successfully")
    );
});

export const getOneAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;

  if (!adminId) {
    throw new ApiError(400, "missing required fields");
  }

  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new ApiError(404, "admin not found");
  }

  const adminDetails = await adminInfo(admin._id);
  if (!adminDetails) {
    throw new ApiError(
      500,
      "Failed to retrieve admin data or no address found"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { adminInfo: adminDetails }, "Admin data retrieved")
    );
});

export const getAllAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find({}).sort({ createdAt: -1 });

  const allAdmins = await Promise.all(
    admins.map((data) => adminInfo(data._id))
  );

  if (!allAdmins) {
    throw new ApiError(
      500,
      "Failed to retrieve admin data or no address found"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { userInfo: allAdmins }, "user fetched successfully")
    );
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  const admin = await req.admin;

  let deleteAdmin = admin;
  const findAdmin = await Admin.findById(adminId);

  if (!findAdmin) {
    throw new ApiError(404, "admin not found");
  }
  deleteAdmin = findAdmin;

  if (adminId == admin._id) {
    deleteAdmin = admin;
  }

  if (adminId != admin._id) {
    throw new ApiError(500, "you don't have access");
  }

  const deletedAdmin = await Admin.findByIdAndDelete(deleteAdmin?._id);
  if (!deletedAdmin) {
    throw new ApiError(500, "something went worng");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "admin deleted successfully"));
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const { labname, description, email, password, newPassword } = req.body;
  const { adminId } = req.params;
  const admin = req.admin;

  if (!labname && !description && !email && !newPassword) {
    throw new ApiError(404, "no update data provided");
  }

  const findAdmin = await Admin.findById(adminId);
  if (!findAdmin) {
    throw new ApiError(404, "admin not found");
  }
  const updateAdmin = findAdmin;

  if (adminId != admin._id) {
    throw new ApiError(500, "you don't have access");
  }

  if (password) {
    const isPasswordCorrect = await findAdmin.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
      throw new ApiError(401, "worng password");
    }
  }

  const updateData = {};

  if (labname) {
    updateData.labname = labname;
  }

  if (description) {
    updateData.description = description;
  }

  if (email) {
    const token = await generateToken(admin);
    const basePath = process.env.CORS_ORIGIN;
    const emailData = {
      email: admin.email,
      template: "ConfirmEmail",
      url: `${basePath}${EMAIL_VERIFY_PAGE}?token=${token.unHashedToken}`,
      subject: "Email Verification",
    };
    await SendEmail(emailData);

    updateData.email = email;
    updateData.isEmailVerified = false;
    updateData.emailVerificationToken = token.hashedToken;
    updateData.emailVerificationExpiry = token.expiry;
  }

  if (newPassword) {
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  const adminInfo = await Admin.findByIdAndUpdate(
    updateAdmin._id,
    { $set: updateData },
    { new: true }
  ).select(ignoreFields);

  const message = `details updated. ${
    email ? "email verification link sent to your new email" : ""
  }`;
  return res
    .status(200)
    .json(new ApiResponse(200, { adminInfo: adminInfo }, message));
});

export const forgotPasswordLink = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "missing required fields");
  }

  const admin = await Admin.findOne({
    $or: { email: email },
  });

  if (!admin) {
    throw new ApiError(404, "user not found");
  }

  const token = await generateToken(admin);
  const basePath = process.env.CORS_ORIGIN;
  const emailData = {
    email: admin.email,
    template: "ForgotPassword",
    url: `${basePath}${RESET_PASS_PAGE}?token=${token.unHashedToken}`,
    subject: "Reset Your Password",
  };

  await SendEmail(emailData);
  await Admin.findByIdAndUpdate(
    user._id,
    {
      $set: {
        forgotPasswordToken: token.hashedToken,
        forgotPasswordExpiry: token.expiry,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { adminInfo: admin.email },
        "A Password Reset link has been sent to your email address"
      )
    );
});

export const refreshUserToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    throw new ApiError(401, "unauthorized request");
  }

  const decodedToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  const admin = await Admin.findById(decodedToken._id);

  if (!admin) {
    await Admin.findByIdAndUpdate(
      req.admin?._id,
      {
        $unset: {
          refreshToken: 1,
          emailVerificationToken: 1,
          emailVerificationExpiry: 1,
          forgotPasswordToken: 1,
          forgotPasswordExpiry: 1,
        },
      },
      { new: true }
    );

    return res
      .status(200)
      .clearCookie("accessToken", cookieOptions)
      .clearCookie("refreshToken", cookieOptions)
      .json(new ApiResponse(200, "admin logged out"));
  }

  const newRefreshToken = await admin.generateRefreshToken();
  const newAccessToken = await admin.generateAccessToken();

  await Admin.findByIdAndUpdate(
    req.admin?._id,
    {
      $set: {
        refreshToken: newRefreshToken,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .cookie("accessToken", newAccessToken, cookieOptions)
    .cookie("refreshToken", newRefreshToken, cookieOptions)
    .json(new ApiResponse(200, { adminInfo: admin }, "access token refreshed"));
});

export const emailVerify = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new ApiError(404, "token not found");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  console.log(hashedToken);

  const admin = await Admin.findOne({
    emailVerificationToken: hashedToken,
  });

  if (!admin) {
    throw new ApiError(404, "admin not found");
  }

  const currentDate = new Date();
  const tokenExpired = admin.emailVerificationExpiry < currentDate;

  if (tokenExpired) {
    throw new ApiError(500, "token has expired");
  }

  await Admin.findByIdAndUpdate(
    admin._id,
    {
      $set: {
        isEmailVerified: true,
      },
      $unset: {
        emailVerificationToken: 1,
        emailVerificationExpiry: 1,
      },
    },
    { new: true }
  );

  return res.status(200).json(200, "admin verified successfully");
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const uploadedFile = await req.file;
  const { id } = req.params;
  const admin = await req.admin;
  let changeAvatarAdmin;

  const findAdmin = await Admin.findById(id);
  if (!findAdmin) {
    throw new ApiError(404, "user not found");
  }
  changeAvatarAdmin = findAdmin;

  if (id != admin._id) {
    throw new ApiError(500, "you don't have access");
  }

  if (!uploadedFile) {
    throw new ApiError(400, "no file uploaded");
  }

  const uploadOptions = {
    folder: "avatar",
    // gravity: 'faces',
    width: 200,
    height: 200,
    crop: "fit",
  };

  const img = await uploadOnCloudinary(uploadedFile.path, uploadOptions);
  if (!img) {
    throw new ApiError(500, `something went worng error`);
  }

  if (img.http_code === 400) {
    throw new ApiError(500, `error uploading image: ${img?.message}`);
  }

  const avatarData = {
    url: img.url,
    public_id: img.public_id,
    secure_url: img.secure_url,
    width: img.width,
    height: img.height,
    format: img.format,
  };

  const updatedAdmin = await Admin.findByIdAndUpdate(
    changeAvatarAdmin._id,
    {
      $set: {
        avatar: avatarData,
      },
    },
    { new: true }
  ).select(ignoreFields);

  if (!updatedAdmin) {
    throw new ApiError(500, "something went worng");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { userInfo: updatedAdmin }, "image uploaded"));
});

export const deleteAvatar = asyncHandler(async (req, res) => {
  const admin = await req.admin;
  const { id } = await req.params;

  let deleteAvatarAdmin = admin;
  if (id != admin._id) {
    const findAdmin = await Admin.findById(id);

    if (!findAdmin) {
      throw new ApiError(404, "user not found");
    }
    deleteAvatarAdmin = findAdmin;
  }

  if (id != admin._id) {
    throw new ApiError(500, "you don't have access");
  }

  const deleteAvatarOnCloud = await deleteFromCloudinary(
    deleteAvatarAdmin.avatar?.public_id
  );

  if (!deleteAvatarOnCloud) {
    throw new ApiError(500, `something went worng error`);
  }

  if (deleteAvatarOnCloud.http_code === 400) {
    throw new ApiError(
      500,
      `error deleting image: ${deleteAvatarOnCloud?.message}`
    );
  }

  const updatedAdmin = await Admin.findByIdAndUpdate(
    deleteAvatarAdmin._id,
    {
      $unset: {
        avatar: 1,
      },
    },
    { new: true }
  ).select(ignoreFields);

  return res
    .status(200)
    .json(new ApiResponse(200, { userInfo: updatedAdmin }, "image deleted"));
});
