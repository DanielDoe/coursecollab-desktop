export const ELEG_FALL2026_LOGIN_REMINDER_TITLE =
  "Please sign in to CourseCollab before our next class"

export function elegFall2026LoginReminderAnnouncementHtml(authUniversityUrl: string): string {
  const signIn = authUniversityUrl.replace(/"/g, "&quot;")
  return `<p>Good evening everyone,</p>

<p>I want to apologize for the schedule confusion and conflicts today, as well as my absence from class. I appreciate your patience and understanding as we work through the scheduling adjustments at the beginning of the semester.</p>

<p>I am looking forward to seeing everyone at our next class meeting and getting us fully underway for the semester.</p>

<p>If you have <strong>not yet signed into CourseCollab</strong>, please do so before our next class. We will use CourseCollab regularly for course materials, lectures, assignments, programming activities, announcements, and other class activities.</p>

<p><a href="${signIn}"><strong>Sign in to CourseCollab</strong></a> — start at the university sign-in page, select <strong>Prairie View A&amp;M University</strong>, then log in with your Student ID or @pvamu.edu email. If this is your first time, use the temporary password from your welcome email (<strong>ELEG2026!</strong>) and set a new password when prompted.</p>

<p>Thank you again for your patience, and I look forward to seeing everyone at our next class.</p>

<p>Best,<br/>Daniel Doe</p>`
}
