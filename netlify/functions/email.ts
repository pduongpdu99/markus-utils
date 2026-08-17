import { HandlerEvent } from "@netlify/functions";
import { BrevoClient } from "@getbrevo/brevo";
import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";

type MailPayload = {
  to?: string | string[];
  subject?: string;
  message?: string;
  textContent?: string;
  htmlContent?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  template?: string;
  templateContext?: Record<string, unknown>;
  name?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  budget?: string;
  projectType?: string;
  projectGoal?: string;
  projectDescription?: string;
  timeline?: string;
  notes?: string;
  source?: string;
  submittedAt?: string;
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
  const subject = payload.subject ?? "New message";

  const templateName =
    payload.template ??
    (
      payload.projectDescription ||
        payload.budget ||
        payload.projectType
        ? "support-request"
        : undefined
    );

  const templateContext = {
    subject: payload.subject ?? "Yêu cầu hỗ trợ",
    customerName:
      payload.customerName ??
      payload.name ??
      "Khách hàng",
    email: payload.email ?? "",
    phone: payload.phone ?? "",
    budget: payload.budget ?? "",
    projectType: payload.projectType ?? "",
    projectGoal: payload.projectGoal ?? "",
    projectDescription:
      payload.projectDescription ??
      payload.message ??
      "",
    timeline: payload.timeline ?? "",
    notes: payload.notes ?? "",
    source: payload.source ?? "chatbox",
    submittedAt:
      payload.submittedAt ??
      new Date().toISOString().slice(0, 10),
    ...(payload.templateContext ?? {}),
  };

  // ==========================================
  // TEXT CONTENT
  // ==========================================
  const fallbackTextContent = [
    `Chủ đề: ${templateContext.subject}`,
    `Khách hàng: ${templateContext.customerName}`,
    ...(templateContext.email
      ? [`Email: ${templateContext.email}`]
      : []),
    ...(templateContext.phone
      ? [`Điện thoại: ${templateContext.phone}`]
      : []),
    ...(templateContext.budget
      ? [`Ngân sách: ${templateContext.budget}`]
      : []),
    ...(templateContext.projectType
      ? [`Loại dự án: ${templateContext.projectType}`]
      : []),
    ...(templateContext.projectGoal
      ? [`Mục tiêu: ${templateContext.projectGoal}`]
      : []),
    ...(templateContext.projectDescription
      ? [`Mô tả: ${templateContext.projectDescription}`]
      : []),
    ...(templateContext.timeline
      ? [`Thời gian: ${templateContext.timeline}`]
      : []),
    ...(templateContext.notes
      ? [`Ghi chú: ${templateContext.notes}`]
      : []),
  ].join("\n");

  const textContent =
    payload.textContent?.trim() ||
    payload.message?.trim() ||
    fallbackTextContent ||
    "No message provided";

  // ==========================================
  // HTML CONTENT
  // ==========================================
  let htmlContent = payload.htmlContent ?? "";

  if (!htmlContent && templateName) {
    try {
      const templatePath = path.join(
        process.cwd(),
        "templates",
        `${templateName}.hbs`,
      );

      const templateSource = fs.readFileSync(
        templatePath,
        "utf8",
      );

      const template = Handlebars.compile(templateSource);

      htmlContent = template(templateContext);
    } catch {
      htmlContent = textContent
        ? `<p>${textContent.replace(/\n/g, "<br />")}</p>`
        : "";
    }
  }

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
        subject,

        sender: {
          name: "Markus Utils",
          email: "pduongpdu99@gmail.com",
        },

        to: recipients,

        replyTo: payload.replyTo
          ? {
            email: payload.replyTo,
          }
          : undefined,

        textContent,

        htmlContent: htmlContent || undefined,
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