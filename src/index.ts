import express from "express";
import mongoose from "mongoose";
import blogRouter from "./routes/blog.router.ts";

const app = express();
const port = process.env.PORT;

// MongoDB Connection Configuraton
const mongoUri: string = process.env.MONGO_URI || "";
mongoose.connect(mongoUri);

// Endpoints
app.use("/blog", blogRouter);

app.listen(port, () => {
  console.log(`Server is running on [http://localhost:${port}]`);
});
