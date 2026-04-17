// src/applicants/applicant-approved.email.ts

export function buildApprovalEmail(opts: {
  firstName:      string;
  lastName:       string;
  activationUrl:  string;
  expiryHours:    number;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Application Approved – TelexPH</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.07);">

        <!-- TOP ACCENT BAR -->
        <tr><td style="height:5px;background:linear-gradient(90deg,#8B0000,#c0392b);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- HEADER -->
        <tr>
          <td style="padding:44px 48px 32px;text-align:center;border-bottom:1px solid #f3f4f6;">
            <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">TelexPH Virtual Assistant Program</p>
            <div style="display:inline-block;width:64px;height:64px;background:#fdf2f2;border-radius:50%;text-align:center;line-height:64px;font-size:28px;margin-bottom:20px;">🎉</div>
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Application Approved</h1>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">We are pleased to inform you that your application<br/>has been reviewed and approved.</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:36px 48px;">

            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">Dear ${opts.firstName} ${opts.lastName},</p>
            <p style="margin:0 0 28px;font-size:14px;color:#4b5563;line-height:1.8;">
              On behalf of the TelexPH team, we are delighted to welcome you as an official member of our 
              Virtual Assistant network. Your skills and experience stood out during our review process, 
              and we look forward to achieving great results together.
            </p>

            <!-- ACTIVATION BOX -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:20px;">
              <tr>
                <td style="padding:28px 32px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;">Activate Your Account</p>
                  <p style="margin:0 0 24px;font-size:13px;color:#4b5563;line-height:1.7;">
                    Click the button below to set your password and activate your VA account.<br/>
                    This link will expire in <strong style="color:#8B0000;">${opts.expiryHours} hours</strong>.
                  </p>
                  <a href="${opts.activationUrl}"
                    style="display:inline-block;background:#8B0000;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:15px 40px;border-radius:10px;letter-spacing:0.3px;">
                    Activate My Account &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- EXPIRY WARNING -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:32px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0;font-size:12px;color:#78350f;line-height:1.7;">
                    <strong>Important:</strong> This activation link is valid for ${opts.expiryHours} hours only and can be used once. 
                    If the link expires, please contact our support team for a new one.
                  </p>
                </td>
              </tr>
            </table>

            <!-- NEXT STEPS -->
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;">Next Steps</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              ${[
                ['Activate your account',      'Click the button above and set a strong password to access your VA portal.'],
                ['Complete your profile',       'Fill in any remaining details so clients can learn more about you.'],
                ['Await your onboarding brief', 'Our team will reach out within 1–2 business days with your first assignment.'],
              ].map(([title, desc], i) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f9fafb;vertical-align:top;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;height:28px;background:#fdf2f2;border-radius:50%;text-align:center;line-height:28px;font-size:11px;font-weight:700;color:#8B0000;vertical-align:middle;">${i + 1}</td>
                    <td style="padding-left:14px;vertical-align:top;">
                      <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#111827;">${title}</p>
                      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">${desc}</p>
                    </td>
                  </tr></table>
                </td>
              </tr>`).join('')}
            </table>

            <!-- FALLBACK LINK -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;">If the button above doesn't work, copy and paste this URL into your browser:</p>
                  <p style="margin:0;font-size:11px;color:#8B0000;word-break:break-all;">${opts.activationUrl}</p>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.8;">
              Should you have any questions, please do not hesitate to reach out to our support team.
            </p>
            <p style="margin:16px 0 0;font-size:14px;color:#4b5563;">
              Warm regards,<br/>
              <strong style="color:#111827;">The TelexPH Team</strong>
            </p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:24px 48px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#374151;">TelexPH</p>
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;">
              &copy; ${year} TelexPH. All rights reserved.<br/>
              This is an automated notification — please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
