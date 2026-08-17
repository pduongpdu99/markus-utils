import { HandlerEvent } from "@netlify/functions";
import { BrevoClient } from "@getbrevo/brevo";
import { contactTemplate, studentTemplate } from "../../services/build-email-template";

type MailPayload = {
  subject?: string;
  senderName?: string;
  senderEmail?: string;
  to?: string | string[];
  replyTo?: string;
  textContent?: string;
  htmlContent?: string;
  info?: any
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

// IMPORTANT:
// Origin không có "/" cuối.
const allowedOrigins = new Set([
  "http://localhost:3000",
  "https://markus-support.vercel.app",
]);

const getCorsHeaders = (origin?: string) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

const jsonResponse = (
  statusCode: number,
  body: unknown,
  corsHeaders: Record<string, string>,
) => ({
  statusCode,
  headers: {
    ...corsHeaders,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

export const handler = async (event: HandlerEvent) => {
  const origin = event.headers.origin ?? event.headers.Origin;
  const corsHeaders = getCorsHeaders(origin);

  // ==========================================
  // CORS PREFLIGHT
  // ==========================================
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // ==========================================
  // METHOD
  // ==========================================
  if (event.httpMethod !== "POST") {
    return jsonResponse(
      405,
      {
        success: false,
        message: "Method Not Allowed",
      },
      corsHeaders,
    );
  }

  // ==========================================
  // API KEY
  // ==========================================
  const apiKey = process.env.BREVO_API;

  if (!apiKey) {
    return jsonResponse(
      500,
      {
        success: false,
        message: "Missing BREVO_API environment variable",
      },
      corsHeaders,
    );
  }

  // ==========================================
  // PARSE BODY
  // ==========================================
  let payload: MailPayload = {};

  try {
    payload = event.body
      ? (JSON.parse(event.body) as MailPayload)
      : {};
  } catch {
    return jsonResponse(
      400,
      {
        success: false,
        message: "Invalid JSON payload",
      },
      corsHeaders,
    );
  }

  // ==========================================
  // RECIPIENTS
  // ==========================================
  const recipients = buildRecipients(payload.to);

  if (!recipients.length) {
    return jsonResponse(
      400,
      {
        success: false,
        message: "Missing 'to' recipient email address",
      },
      corsHeaders,
    );
  }

  // ==========================================
  // TEMPLATE
  // ==========================================

  const textContent =
    payload.textContent?.trim() ||
    "No message provided";

  // ==========================================
  // HTML CONTENT
  // ==========================================
  let htmlContent = payload.htmlContent ?? "";

  if (!htmlContent && textContent) {
    htmlContent = `<p>${textContent.replace(/\n/g, "<br />")}</p>`;
  }

  // ==========================================
  // SEND EMAIL
  // ==========================================
  try {
    const brevo = new BrevoClient({
      apiKey,
    });

    const response =
      await brevo.transactionalEmails.sendTransacEmail({
        subject: payload.subject,

        sender: {
          name: payload.senderName,
          email: payload.senderEmail,
        },
        to: recipients,
        replyTo: payload.replyTo
          ? {
            email: payload.replyTo,
          }
          : undefined,
        textContent: payload.textContent,
        htmlContent: payload.info.projectGoal === "student" ? studentTemplate(payload.info) : contactTemplate(payload.info),
      });

    return jsonResponse(
      201,
      {
        success: true,
        messageId: response?.messageId ?? null,
      },
      corsHeaders,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to send email";

    return jsonResponse(
      500,
      {
        success: false,
        message,
      },
      corsHeaders,
    );
  }
};