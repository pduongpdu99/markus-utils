import { Handler } from "@netlify/functions";
import { BrevoClient } from "@getbrevo/brevo";

type MailPayload = {
  to?: string | string[];
  subject?: string;
  message?: string;
  textContent?: string;
  htmlContent?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
};

const buildRecipients = (value: string | string[] | undefined) => {
  if (!value) {
    return [];
  }

  const items = Array.isArray(value) ? value : [value];
  return items
    .map((email) => String(email).trim())
    .filter(Boolean)
    .map((email) => ({ email }));
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Method Not Allowed" }),
    };
  }

  const apiKey = process.env.BREVO_API;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: "Missing BREVO_API environment variable",
      }),
    };
  }

  let payload: MailPayload = {};

  try {
    payload = event.body ? (JSON.parse(event.body) as MailPayload) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Invalid JSON payload" }),
    };
  }

  const recipients = buildRecipients(payload.to);

  if (!recipients.length) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: "Missing 'to' recipient email address",
      }),
    };
  }

  const subject = payload.subject ?? "New message";
  const textContent = payload.textContent ?? payload.message ?? "";
  const htmlContent = payload.htmlContent ?? (textContent ? `<p>${textContent.replace(/\n/g, "<br />")}</p>` : "");

  try {
    const brevo = new BrevoClient({ apiKey });

    const response = await brevo.transactionalEmails.sendTransacEmail({
      subject,
      sender: {
        name: payload.fromName ?? "Markus Utils",
        email: payload.fromEmail ?? "no-reply@markus-eco.com",
      },
      to: recipients,
      replyTo: payload.replyTo ? { email: payload.replyTo } : undefined,
      textContent,
      htmlContent: htmlContent || undefined,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        messageId: response?.messageId ?? null,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message }),
    };
  }
};