/* eslint-disable @typescript-eslint/no-require-imports */
const nodemailer = require("nodemailer") as typeof import("nodemailer")

/**
 * Nodemailer transporter for CourseCollab
 * Configured via environment variables
 */
export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})
