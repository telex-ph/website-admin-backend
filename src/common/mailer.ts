// src/common/mailer.ts
// Sends email via Microsoft Graph API (App-only auth)

interface MailRecipient {
  name: string;
  email: string;
}

interface SendMailOptions {
  to: MailRecipient;
  subject: string;
  html: string;
}

async function getAccessToken(): Promise<string> {
  const tenantId     = process.env.AZURE_TENANT_ID;
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure credentials in environment variables.');
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'https://graph.microsoft.com/.default',
  });

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure token error: ${err}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const sender = process.env.MAIL_SENDER;
  if (!sender) throw new Error('MAIL_SENDER is not set in environment variables.');

  const token = await getAccessToken();

  const payload = {
    message: {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content:     options.html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: options.to.email,
            name:    options.to.name,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
    {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph sendMail error: ${err}`);
  }
}
