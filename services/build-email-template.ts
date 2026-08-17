import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";

interface IStudentPayload {
  to: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  phone: string;
  projectType: string;
  projectGoal: string;
  projectDescription: string;
  timeline: string;
  notes: string;
  source: string;
  submittedAt: string;
  email: string;
}

interface IContactPayload {
  to: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  phone: string;
  budget: string;
  projectType: string;
  projectGoal: "business" | "other" | "startup" | "student";
  projectDescription: string;
  timeline: string;
  notes: string;
  source: string;
  submittedAt: string;
  email: string;
}

export const studentTemplate = (payload: IStudentPayload) => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "services",
    "student.hbs",
  );

  const templateSource = fs.readFileSync(templatePath, "utf8");

  const template = Handlebars.compile(templateSource);

  return template(payload);
};



const templatePath = path.join(
  process.cwd(),
  "src/services/contact.html",
);

const templateSource = fs.readFileSync(templatePath, "utf8");

const template = Handlebars.compile(templateSource);

export const contactTemplate = (payload: IContactPayload) => {
  return template({
    ...payload,
    projectGoal:
      {
        business: "Doanh nghiệp",
        startup: "Startup",
        student: "Sinh viên",
        other: "Khác",
      }[payload.projectGoal],
  });
};