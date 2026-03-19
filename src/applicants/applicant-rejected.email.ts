// src/applicants/applicant-rejected.email.ts

export function buildRejectionEmail(opts: {
  firstName: string;
  lastName:  string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Application Update – TelexPH</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.07);">

        <!-- TOP ACCENT BAR -->
        <tr><td style="height:5px;background:linear-gradient(90deg,#374151,#6b7280);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- HEADER -->
        <tr>
          <td style="padding:44px 48px 32px;text-align:center;border-bottom:1px solid #f3f4f6;">
            <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">TelexPH Virtual Assistant Program</p>
            <div style="display:inline-block;width:64px;height:64px;background:#f9fafb;border-radius:50%;text-align:center;line-height:64px;font-size:28px;margin-bottom:20px;">📋</div>
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Application Status Update</h1>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">Thank you for your interest in joining the TelexPH<br/>Virtual Assistant network.</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:36px 48px;">

            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">Dear ${opts.firstName} ${opts.lastName},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.8;">
              We sincerely appreciate the time and effort you invested in applying to become a Virtual 
              Assistant with TelexPH. After careful consideration of your application, we regret to 
              inform you that we are unable to move forward with your candidacy at this time.
            </p>

            <!-- NOTICE BOX -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px 28px;">
                  <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;">Please Note</p>
                  <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.8;">
                    This decision was made after a thorough review of all applications received. 
                    It is not a reflection of your overall capabilities or potential. We receive a 
                    high volume of applications and are only able to proceed with a limited number 
                    of candidates whose profiles closely match our current requirements.
                  </p>
                </td>
              </tr>
            </table>

            <!-- ENCOURAGEMENT SECTION -->
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;">We Encourage You To</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              ${[
                ['Continue developing your skills',   'Consider pursuing certifications or training relevant to your desired role to strengthen future applications.'],
                ['Reapply in the future',              'We regularly open new positions. We encourage you to apply again when new opportunities become available.'],
                ['Explore other opportunities',        'Our website is updated regularly with new openings that may be a better fit for your skill set.'],
              ].map(([title, desc]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f9fafb;vertical-align:top;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:8px;height:8px;background:#d1d5db;border-radius:50%;vertical-align:middle;margin-top:4px;"></td>
                    <td style="padding-left:14px;vertical-align:top;">
                      <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#111827;">${title}</p>
                      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">${desc}</p>
                    </td>
                  </tr></table>
                </td>
              </tr>`).join('')}
            </table>

            <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.8;">
              We genuinely wish you all the best in your professional journey. Your enthusiasm and 
              dedication are commendable, and we hope you find an opportunity that is the perfect 
              fit for your talents.
            </p>

            <p style="margin:0;font-size:14px;color:#4b5563;">
              Thank you once again for considering TelexPH.<br/><br/>
              With respect,<br/>
              <strong style="color:#111827;">The TelexPH Recruitment Team</strong>
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