import express from "express";
import type { Request, Response } from "express";

const app = express();
const port = process.env.PORT;

app.get("/", (req: Request, res: Response) => {
  res.send("Test!");
});

app.listen(port, () => {
  console.log(
    `Server is running on [http://localhost:${port}](http://localhost:3000/)`
  );
});
