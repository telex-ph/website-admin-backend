// Sa loob ng src/common/utils/error-page.ts
export const getUnauthorizedHTML = (message: string) => {
    return `
        <html>
            <body style="background:#121212; color:white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <div style="text-align:center; border:1px solid #333; padding:50px; border-radius:15px;">
                    <h1 style="color:#ff4444;">401 - Unauthorized</h1>
                    <p>${message}</p>
                    <a href="/login" style="color:#0088ff; text-decoration:none; border:1px solid #0088ff; padding:10px 20px; border-radius:5px;">Go to Login Page</a>
                </div>
            </body>
        </html>
    `;
};
