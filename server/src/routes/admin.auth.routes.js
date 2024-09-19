import { Router } from "express";
import {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  getCurrentAdmin,
  updateAdmin,
  deleteAdmin,
  forgotPasswordLink,
  emailVerify,
  refreshUserToken,
} from "../controllers/admin.auth.controller.js";
import { verifyAdminJWT } from "../middlewares/admin.auth.middleware.js";

const router = Router();

router.route("/register").post(registerAdmin);
router.route("/login").post(loginAdmin);
router.route("/logout").post(verifyAdminJWT, logoutAdmin);

router.route("/admin").get(verifyAdminJWT, getCurrentAdmin);
router
  .route("/:id")
  .put(verifyAdminJWT, updateAdmin)
  .delete(verifyAdminJWT, deleteAdmin);

router.route("/refreshToken").post(refreshUserToken);

router.route("/forgotPassword").post(forgotPasswordLink);
router.route("/emailVerify").post(emailVerify);

export default router;
