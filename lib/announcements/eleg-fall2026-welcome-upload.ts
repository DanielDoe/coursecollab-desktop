export const ELEG_FALL2026_WELCOME_TITLE =
  "Welcome to CourseCollab — Fall 2026 ELEG sign-in & getting started"

export function elegFall2026WelcomeAnnouncementHtml(opts: {
  authUniversityUrl: string
  membershipUrl: string
  lecturesUrl: string
  syllabusUrl: string
}): string {
  const authUniversityUrl = opts.authUniversityUrl.replace(/"/g, "&quot;")
  const membershipUrl = opts.membershipUrl.replace(/"/g, "&quot;")
  const lecturesUrl = opts.lecturesUrl.replace(/"/g, "&quot;")
  const syllabusUrl = opts.syllabusUrl.replace(/"/g, "&quot;")

  return `<p>Welcome to <strong>CourseCollab</strong> for Fall 2026 ELEG!</p>

<p>We use CourseCollab for lectures, practice, homework, quizzes, groups, projects, and your syllabus — everything in one place.</p>

<h3 style="margin:20px 0 10px;font-size:16px;">How to sign in</h3>
<ol>
  <li>Open the <a href="${authUniversityUrl}"><strong>university sign-in page</strong></a> and select <strong>Prairie View A&amp;M University</strong>.</li>
  <li>Sign in with your <strong>Student ID</strong> or <strong>@pvamu.edu email</strong>.</li>
  <li>First time? Use the temporary password from your welcome email (<strong>ELEG2026!</strong>) and set a new password when prompted.</li>
</ol>

<h3 style="margin:20px 0 10px;font-size:16px;">Get started</h3>
<ul>
  <li><a href="${lecturesUrl}"><strong>Lectures &amp; sample practice</strong></a></li>
  <li><a href="${syllabusUrl}"><strong>Syllabus &amp; course policies</strong></a></li>
  <li><strong>Assessments</strong> — homework and quizzes after you sign in</li>
  <li><strong>Practice Hub, flashcards, Cora AI, and CodeBench</strong></li>
</ul>

<p>For the best semester experience — full Cora AI, unlimited Playground, extra quiz attempts, save-and-finish-later, and priority support — we recommend <strong>Trailblazer</strong>. <a href="${membershipUrl}"><strong>View membership plans</strong></a>.</p>

<p>Questions? Reply here or email <a href="mailto:dmdoe@pvamu.edu">dmdoe@pvamu.edu</a>.</p>

<p>See you in class!<br/>Daniel Doe</p>`
}
