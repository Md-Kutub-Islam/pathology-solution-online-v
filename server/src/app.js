import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import useragent from "express-useragent";
import authRouters from "./routes/user.auth.routes.js";
import adminAuthRouters from "./routes/admin.auth.routes.js";
import userAddressRoutes from "./routes/user.address.routes.js";
import adminAddessRoutes from "./routes/admin.address.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import testRoutes from "./routes/test.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import searchRoutes from "./routes/search.routes.js";
import { BASEPATH } from "./constants.js";

const app = express();

// middlewares
// app.use(
//   cors({
//     origin: process.env.CORS_ORIGIN || "http://localhost:5173",
//     credentials: true,
//   })
// );

// middlewares
const allowedOrigins = [
  process.env.CORS_ORIGIN ||
    "https:pathology-solution-online-v.vercel.app",
  "https://pathology-solution-online-v-server.vercel.app/api/v1",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Allow OPTIONS
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Test route
// /api/v1/healthcheck
// app.get(`${BASEPATH}/healthcheck`, (_, res) => {
//     try {
//       return res.status(200).json(new ApiResponse(200, {}, 'ok'));
//     } catch (error) {
//       console.log(error);
//       throw new ApiError(500, error.message);
//     }
//   });

// Auth & User Routes
app.use(`${BASEPATH}/auth`, authRouters);
// Auth & Admin Routes
app.use(`${BASEPATH}/auth-admin`, adminAuthRouters);
// User Address Routes
app.use(`${BASEPATH}/user-address`, userAddressRoutes);
// User Address Routes
app.use(`${BASEPATH}/admin-address`, adminAddessRoutes);
// Category Routes
app.use(`${BASEPATH}/category`, categoryRoutes);
// Tests Routes
app.use(`${BASEPATH}/test`, testRoutes);
// search Routes
app.use(`${BASEPATH}/search`, searchRoutes);
// Carts Routes
app.use(`${BASEPATH}/cart`, cartRoutes);
// Orders Routes
app.use(`${BASEPATH}/order`, orderRoutes);
// Payment Routes
app.use(`${BASEPATH}/payment`, paymentRoutes);

export default app;
