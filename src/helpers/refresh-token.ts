// import * as jose from "jose";

// const privatePEM = process.env.PRIVATE_KEY;
// const publicPEM = process.env.PUBLIC_KEY;

// // Manual token expiration
// const ACCESS_TOKEN_EXPIRATION = "15m";
// const REFRESH_TOKEN_EXPIRATION = "30d";

// // This value should be in milliseconds
// const ACCESS_TOKEN_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes
// const REFRESH_TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// const SESSION_TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// export const createNewToken = async (req, res) => {
//   if (!privatePEM) throw new Error("Private key required");
//   if (!publicPEM) throw new Error("Private key required");

//   const refreshToken = req.cookies?.refreshTokne;

//   if (!refreshToken) {
//     return res.status(401).json({ message: "No refresh token found" });
//   }

//   try {
//     const publicKey = await jose.importSPKI(publicPEM, "RS256");

//     const { payload: user } = await jose.jwtVerify(refreshToken, publicKey);

//     const privateKey = await jose.importPKCS8(privatePEM, "RS256");

//     const accessToken = await new jose.SignJWT(user)
//       .setProtectedHeader({ alg: "RS256" })
//       .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
//       .sign(privateKey);

//     // Setting cookies as httpOnly (not accessible by JavaScript)
//     res.cookie("accessToken", accessToken, {
//       httpOnly: true,
//       secure: true,
//       sameSite: "None",
//       path: "/",
//       maxAge: ACCESS_TOKEN_EXPIRATION_MS,
//     });
//     return res.json({ message: "New access token created" });
//   } catch (error) {
//     if (error.code === "ERR_JWT_EXPIRED") {
//       return res.status(401).json({
//         code: "REFRESH_TOKEN_EXPIRED",
//         message: "Refresh token expired",
//       });
//     }
//     console.error("Error: ", error.code);
//   }
// };
