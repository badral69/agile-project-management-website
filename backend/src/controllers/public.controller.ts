import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { sendContactMessageEmail } from "../utils/mailer";

export const submitContactMessage = async (request: Request, response: Response) => {
  const { name, email, company, teamSize, message } = request.body as {
    name: string;
    email: string;
    company?: string;
    teamSize?: string;
    message: string;
  };

  await sendContactMessageEmail({
    senderName: name,
    senderEmail: email,
    company,
    teamSize,
    message,
  });

  response.status(StatusCodes.CREATED).json({
    message: "Your message has been sent. We will get back to you soon.",
  });
};
