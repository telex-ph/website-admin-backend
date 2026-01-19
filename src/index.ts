import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import blogRouter from "./blogs/blog.router.ts";
import authRouter from "./auth/auth.router.ts";
import userRouter from "./users/user.router.ts";

const app = express();
const port = process.env.PORT;

// MongoDB Connection Configuraton
const mongoUri: string = process.env.MONGO_URI || "";
mongoose.connect(mongoUri);

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Endpoints
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/blogs", blogRouter);

app.listen(port, () => {
  console.log(`Server is running on [http://localhost:${port}]`);
});
