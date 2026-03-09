import { ServerClient } from "postmark";

export async function sendMail(msg: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}) {
  const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_KEY!);
  return postmarkClient.sendEmail({
    From: msg.from,
    To: msg.to,
    Subject: msg.subject,
    TextBody: msg.text,
    HtmlBody: msg.html,
    MessageStream: "outbound",
  });
}

export async function sendLoginCodeEmail(email: string, code: string) {
  return sendMail({
    to: email,
    from: process.env.AUTH_EMAIL!,
    subject: "Your Login Code",
    text: `Your login code is ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 40px; margin: 20px 0; }
          h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; text-align: center; }
          .code-container { background-color: #f0f4ff; border: 2px solid #4f46e5; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center; }
          .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; margin: 0; font-family: 'Courier New', monospace; }
          .info { text-align: center; color: #6b7280; font-size: 14px; margin: 20px 0; }
          .warning { background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin: 20px 0; font-size: 14px; color: #92400e; text-align: center; }
          .footer { color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>Your Login Code</h1>
            <p style="text-align: center; color: #6b7280;">Enter this code to complete your login:</p>
            <div class="code-container">
              <p class="code">${code}</p>
            </div>
            <div class="warning"><strong>This code expires in 10 minutes</strong></div>
            <p class="info">For security reasons, this code can only be used once.</p>
            <div class="footer">
              <p>If you didn't request this code, you can safely ignore this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}
