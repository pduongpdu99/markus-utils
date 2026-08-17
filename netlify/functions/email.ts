import { Handler } from "@netlify/functions";
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

  const templateName = payload.template ?? (
    payload.projectDescription || payload.budget || payload.projectType ? "support-request" : undefined
  );

  const templateContext = {
    subject: payload.subject ?? "Yêu cầu hỗ trợ",
    customerName: payload.customerName ?? payload.name ?? "Khách hàng",
    email: payload.email ?? "",
    phone: payload.phone ?? "",
    budget: payload.budget ?? "",
    projectType: payload.projectType ?? "",
    projectGoal: payload.projectGoal ?? "",
    projectDescription: payload.projectDescription ?? payload.message ?? "",
    timeline: payload.timeline ?? "",
    notes: payload.notes ?? "",
    source: payload.source ?? "chatbox",
    submittedAt: payload.submittedAt ?? new Date().toISOString().slice(0, 10),
    ...(payload.templateContext ?? {}),
  };

  const fallbackTextContent = [
    `Chủ đề: ${templateContext.subject}`,
    `Khách hàng: ${templateContext.customerName}`,
    ...(templateContext.email ? [`Email: ${templateContext.email}`] : []),
    ...(templateContext.phone ? [`Điện thoại: ${templateContext.phone}`] : []),
    ...(templateContext.budget ? [`Ngân sách: ${templateContext.budget}`] : []),
    ...(templateContext.projectType ? [`Loại dự án: ${templateContext.projectType}`] : []),
    ...(templateContext.projectGoal ? [`Mục tiêu: ${templateContext.projectGoal}`] : []),
    ...(templateContext.projectDescription ? [`Mô tả: ${templateContext.projectDescription}`] : []),
    ...(templateContext.timeline ? [`Thời gian: ${templateContext.timeline}`] : []),
    ...(templateContext.notes ? [`Ghi chú: ${templateContext.notes}`] : []),
  ].join("\n");

  const textContent = payload.textContent?.trim() || payload.message?.trim() || fallbackTextContent || "No message provided";

  let htmlContent = payload.htmlContent ?? "";

  if (!htmlContent && templateName) {
    try {
      const templatePath = path.join(process.cwd(), "templates", `${templateName}.hbs`);
      const templateSource = fs.readFileSync(templatePath, "utf8");
      const template = Handlebars.compile(templateSource);
      htmlContent = template(templateContext);
    } catch {
      htmlContent = textContent ? `<p>${textContent.replace(/\n/g, "<br />")}</p>` : "";
    }
  }

  if (!htmlContent && textContent) {
    htmlContent = `<p>${textContent.replace(/\n/g, "<br />")}</p>`;
  }

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