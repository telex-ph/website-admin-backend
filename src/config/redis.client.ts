// import { createClient } from "redis";

// console.log("hello");

// export const redisClient = createClient({
//   url: process.env.REDIS_URL || "redis://localhost:6379",
// });

// redisClient.on("error", (err) => console.error("Redis Client Error", err));

// await redisClient.connect();

import { createClient } from "redis";

export const redis = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PW,
  socket: {
    host: process.env.REDIS_SOCKET_HOST,
    port: process.env.REDIS_SOCKET_PORT,
  },
});

redis.on("error", (err) => console.log("Redis Client Error", err));

await redis.connect();
