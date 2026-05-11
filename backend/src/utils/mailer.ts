import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

type TaskAssignmentMailParams = {
  assigneeEmail: string;
  assigneeName: string;
  assignerEmail: string;
  assignerName: string;
  projectKey: string;
  projectName: string;
  taskTitle: string;
  taskStatus: string;
  taskPriority: string;
  dueDate?: Date | null;
};

type ContactMessageMailParams = {
  senderName: string;
  senderEmail: string;
  company?: string;
  teamSize?: string;
  message: string;
};

type PasswordResetMailParams = {
  recipientEmail: string;
  recipientName: string;
  code: string;
};

let transporter: nodemailer.Transporter | null | undefined;

const getTransporter = () => {
  if (transporter !== undefined) {
    return transporter;
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  return transporter;
};

export const sendTaskAssignmentEmail = async ({
  assigneeEmail,
  assigneeName,
  assignerEmail,
  assignerName,
  projectKey,
  projectName,
  taskTitle,
  taskStatus,
  taskPriority,
  dueDate,
}: TaskAssignmentMailParams) => {
  const activeTransporter = getTransporter();
  const dueDateLabel = dueDate ? dueDate.toISOString().slice(0, 10) : "No deadline set";

  if (!activeTransporter) {
    logger.info(`[mail skipped] Task assignment for ${assigneeEmail}: ${taskTitle} in ${projectKey} by ${assignerEmail}. Configure SMTP_HOST to send real emails.`);
    return;
  }

  await activeTransporter.sendMail({
    from: env.MAIL_FROM,
    to: assigneeEmail,
    replyTo: assignerEmail,
    subject: `SprintFlow task assigned: ${taskTitle}`,
    text: [
      `Hello ${assigneeName},`,
      "",
      `${assignerName} assigned you a task in SprintFlow.`,
      `Project: ${projectName} (${projectKey})`,
      `Task: ${taskTitle}`,
      `Status: ${taskStatus}`,
      `Priority: ${taskPriority}`,
      `Due date: ${dueDateLabel}`,
      "",
      `Reply to this email to contact ${assignerName} at ${assignerEmail}.`,
    ].join("\n"),
    html: `
      <p>Hello ${assigneeName},</p>
      <p><strong>${assignerName}</strong> assigned you a task in SprintFlow.</p>
      <ul>
        <li><strong>Project:</strong> ${projectName} (${projectKey})</li>
        <li><strong>Task:</strong> ${taskTitle}</li>
        <li><strong>Status:</strong> ${taskStatus}</li>
        <li><strong>Priority:</strong> ${taskPriority}</li>
        <li><strong>Due date:</strong> ${dueDateLabel}</li>
      </ul>
      <p>Reply to this email to contact ${assignerName} at ${assignerEmail}.</p>
    `,
  });
};

export const sendContactMessageEmail = async ({ senderName, senderEmail, company, teamSize, message }: ContactMessageMailParams) => {
  const activeTransporter = getTransporter();
  const recipient = env.MAIL_FROM;

  if (!activeTransporter) {
    logger.info(`[mail skipped] Contact form from ${senderEmail} (${senderName}). Configure SMTP_HOST to send real emails.`);
    return;
  }

  await activeTransporter.sendMail({
    from: env.MAIL_FROM,
    to: recipient,
    replyTo: senderEmail,
    subject: `SprintFlow contact request from ${senderName}`,
    text: [
      `New SprintFlow contact request`,
      "",
      `Name: ${senderName}`,
      `Email: ${senderEmail}`,
      `Company: ${company || "Not provided"}`,
      `Team size: ${teamSize || "Not provided"}`,
      "",
      "Message:",
      message,
    ].join("\n"),
    html: `
      <p><strong>New SprintFlow contact request</strong></p>
      <ul>
        <li><strong>Name:</strong> ${senderName}</li>
        <li><strong>Email:</strong> ${senderEmail}</li>
        <li><strong>Company:</strong> ${company || "Not provided"}</li>
        <li><strong>Team size:</strong> ${teamSize || "Not provided"}</li>
      </ul>
      <p><strong>Message</strong></p>
      <p>${message.replace(/\n/g, "<br />")}</p>
    `,
  });
};

export const sendPasswordResetCodeEmail = async ({ recipientEmail, recipientName, code }: PasswordResetMailParams) => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    logger.info(`[mail skipped] Password reset code for ${recipientEmail}: ${code}. Configure SMTP_HOST to send real emails.`);
    return;
  }

  await activeTransporter.sendMail({
    from: env.MAIL_FROM,
    to: recipientEmail,
    subject: "SprintFlow password reset code",
    text: [
      `Hello ${recipientName},`,
      "",
      `We received a request to reset your SprintFlow password.`,
      `Your verification code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Hello ${recipientName},</p>
      <p>We received a request to reset your SprintFlow password.</p>
      <p><strong>Your verification code is: ${code}</strong></p>
      <p>This code expires in 15 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
};
