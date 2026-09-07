import Image from "next/image"
import {
  BookOpen,
  Bot,
  Brain,
  ClipboardList,
  Code2,
  FlaskConical,
  GraduationCap,
  LifeBuoy,
  LineChart,
  MessageSquare,
  Presentation,
  Sparkles,
  Users,
} from "lucide-react"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { LicensingChartSlide, LicensingTableSlide } from "@/components/pitch/licensing-slides"
import { CoraCycle } from "@/components/pitch/cora-cycle"
import { FacultyCycle } from "@/components/pitch/faculty-cycle"
import { StudentCycle } from "@/components/pitch/student-cycle"
import { AdoptionSlide } from "@/components/pitch/adoption-slide"
import { CanvasSlide } from "@/components/pitch/canvas-slide"
import { TitleHero } from "@/components/pitch/title-hero"
import { WhatShowcase } from "@/components/pitch/what-showcase"
import { Card, Eyebrow, SlideShell, SlideTitle, Subhead, Thesis } from "@/components/pitch/pitch-ui"

export const SLIDE_TITLES = [
  "CourseCollab",
  "Why CourseCollab?",
  "What Is CourseCollab?",
  "The Student Experience",
  "The Faculty Experience",
  "Cora",
  "CourseCollab and Canvas",
  "Where It Can Be Used",
  "Why CourseCollab for PVAMU",
  "Licensing Cost & Savings",
  "Savings at Scale",
  "A Path Toward Adoption",
  "Questions & Discussion",
] as const

export function PitchSlide({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <TitleSlide />
    case 1:
      return <WhySlide />
    case 2:
      return <WhatSlide />
    case 3:
      return <StudentSlide />
    case 4:
      return <FacultySlide />
    case 5:
      return <CoraSlide />
    case 6:
      return <CanvasSlide />
    case 7:
      return <UseCasesSlide />
    case 8:
      return <PvamuSlide />
    case 9:
      return <LicensingTableSlide />
    case 10:
      return <LicensingChartSlide />
    case 11:
      return <AdoptionSlide />
    default:
      return <CloseSlide />
  }
}

function TitleSlide() {
  return (
    <SlideShell className="justify-start xl:justify-center">
      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-5 sm:gap-6 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] xl:items-center xl:gap-8">
        <div className="pitch-rise min-w-0">
          <CourseCollabLogo
            size="lg"
            withWordmark
            framed
            priority
            wordmarkClassName="text-[#fbf8ff] text-lg sm:text-2xl"
            frameClassName="border-white/20 bg-white/8"
          />
          <h1 className="mt-4 font-sans text-[2rem] font-extrabold leading-[1.05] tracking-tight text-[#fbf8ff] sm:mt-6 sm:text-5xl lg:text-[3.15rem] xl:text-[3.4rem]">
            CourseCollab
          </h1>
          <p className="mt-2 text-base font-medium text-[#F6D56A] sm:mt-3 sm:text-xl">
            AI Powered Teaching, Learning, and Student Success
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/82 sm:mt-4 sm:text-[17px] lg:text-[18px]">
            An integrated academic platform designed to connect course delivery, active
            learning, assessment, student support, and artificial intelligence.
          </p>
          <div className="mt-4 border-t border-white/15 pt-4 sm:mt-6 sm:pt-5">
            <p className="text-[15px] font-semibold text-[#fbf8ff] sm:text-[17px] lg:text-[18px]">
              Daniel Doe, Ph.D.
            </p>
            <p className="mt-0.5 text-[15px] text-white/70 sm:text-[17px] lg:text-[18px]">
              Assistant Professor, Electrical and Computer Engineering
            </p>
            <p className="text-[15px] text-white/70 sm:text-[17px] lg:text-[18px]">
              Prairie View A&M University
            </p>
            <p className="mt-2 text-[15px] font-medium text-[#F6D56A] sm:mt-3 sm:text-[17px] lg:text-[18px]">
              coursecollab.com
            </p>
          </div>
        </div>
        <div className="pitch-rise relative w-full min-w-0 xl:min-h-0" style={{ animationDelay: "90ms" }}>
          <TitleHero />
        </div>
      </div>
    </SlideShell>
  )
}

const FRAGMENTS = [
  { title: "Course Content", detail: "Lectures, notes, syllabus", icon: BookOpen },
  { title: "Assessments", detail: "Quizzes, homework, exams", icon: ClipboardList },
  { title: "AI Assistance", detail: "ChatGPT and other external tools", icon: Bot },
  { title: "Programming & Practice", detail: "IDEs, practice platforms", icon: Code2 },
  { title: "Communication", detail: "Email, discussions, groups", icon: MessageSquare },
  { title: "Student Support", detail: "Grades, analytics, office hours", icon: LifeBuoy },
] as const

function WhySlide() {
  return (
    <SlideShell>
      <Eyebrow>The problem</Eyebrow>
      <SlideTitle>Why CourseCollab?</SlideTitle>
      <Subhead>
        Students have more technology than ever, but the learning experience remains fragmented.
      </Subhead>
      <div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Today: six disconnected systems
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {FRAGMENTS.map((item, i) => (
              <Card
                key={item.title}
                className="pitch-rise p-3"
                style={{ animationDelay: `${60 + i * 50}ms` }}
              >
                <item.icon className="mb-2 h-4 w-4 text-[#EAAA00]" />
                <p className="text-[16px] font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[15px] leading-snug text-white/50">{item.detail}</p>
              </Card>
            ))}
          </div>
        </div>
        <div className="hidden flex-col items-center gap-2 text-[#EAAA00] lg:flex">
          <span className="h-16 w-px bg-gradient-to-b from-transparent via-[#EAAA00] to-transparent" />
          <span className="text-[14px] font-semibold tracking-[0.2em]">INTO</span>
          <span className="h-16 w-px bg-gradient-to-b from-transparent via-[#EAAA00] to-transparent" />
        </div>
        <Card className="flex flex-col items-center justify-center px-6 py-8 text-center">
          <CourseCollabLogo
            size="lg"
            framed
            frameClassName="border-white/15 bg-white/5"
          />
          <p className="mt-4 font-sans font-extrabold tracking-tight text-2xl text-white">
            One course environment
          </p>
          <p className="mt-2 max-w-xs text-[18px] leading-relaxed text-white/55">
            Learning, practice, assessment, AI, collaboration, and support — in the
            context of the same course.
          </p>
        </Card>
      </div>
      <Thesis>
        The result today is a collection of tools. CourseCollab is a connected learning
        environment.
      </Thesis>
    </SlideShell>
  )
}

function WhatSlide() {
  return <WhatShowcase />
}

function StudentSlide() {
  return <StudentCycle />
}

function FacultySlide() {
  return <FacultyCycle />
}

function CoraSlide() {
  return <CoraCycle />
}

const USE_CASES = [
  {
    n: "01",
    title: "Gateway STEM Courses",
    body: "Practice, personalized support, progress monitoring, and early assistance where students commonly struggle.",
    icon: GraduationCap,
  },
  {
    n: "02",
    title: "Programming & Engineering",
    body: "Instruction, Cora, CodeBench, practice, assessments, projects, and debugging support in one environment.",
    icon: Code2,
  },
  {
    n: "03",
    title: "Courses Across Disciplines",
    body: "Lectures, assessments, discussions, study tools, AI assistance, and engagement beyond engineering.",
    icon: BookOpen,
  },
  {
    n: "04",
    title: "Student Success",
    body: "Use learning interactions and progress information to identify where students may need additional support.",
    icon: LineChart,
  },
  {
    n: "05",
    title: "Faculty Productivity",
    body: "Reduce repetitive instructional work through AI-assisted content, assessment, communication, and feedback.",
    icon: Presentation,
  },
  {
    n: "06",
    title: "Research",
    body: "An experimental environment for generative AI in education, personalized learning, and agentic AI.",
    icon: FlaskConical,
  },
] as const

function UseCasesSlide() {
  return (
    <SlideShell>
      <Eyebrow>Use cases</Eyebrow>
      <SlideTitle>Where could CourseCollab be used?</SlideTitle>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((item, i) => (
          <Card
            key={item.n}
            className="pitch-rise flex flex-col"
            style={{ animationDelay: `${70 + i * 55}ms` }}
          >
            <div className="mb-3 flex items-center justify-between xl:mb-4">
              <item.icon className="h-4 w-4 text-[#EAAA00] sm:h-5 sm:w-5 xl:h-6 xl:w-6" />
              <span className="text-[14px] font-semibold tracking-[0.18em] text-white/35 xl:text-[15px] 2xl:text-[16px]">
                {item.n}
              </span>
            </div>
            <p className="text-base font-semibold text-white sm:text-[18px] xl:text-[21px] 2xl:text-[23px]">
              {item.title}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/58 sm:mt-2 sm:text-[18px] xl:text-[20px] 2xl:text-[22px]">
              {item.body}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          "Generative AI in Education",
          "Human–AI Collaboration",
          "Personalized Learning",
          "Adaptive AI Support",
          "Student Engagement",
          "Independent Problem Solving",
          "AI Assisted STEM Learning",
          "Agentic AI",
        ].map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 px-2.5 py-1 text-[14px] text-white/55 xl:px-3 xl:py-1.5 xl:text-[16px] 2xl:text-[17px]"
          >
            {tag}
          </span>
        ))}
      </div>
      <Thesis>
        CourseCollab can serve both as an instructional platform and as infrastructure
        for educational research.
      </Thesis>
    </SlideShell>
  )
}

const PVAMU_PILLARS = [
  {
    title: "Student Success",
    body: "More opportunities for practice, support, engagement, and personalized learning.",
    icon: GraduationCap,
  },
  {
    title: "Faculty Empowerment",
    body: "Integrated tools and AI assistance that support teaching rather than adding another disconnected technology.",
    icon: Users,
  },
  {
    title: "AI Leadership",
    body: "An opportunity to incorporate AI into teaching and learning — rather than leaving students to navigate general-purpose AI alone.",
    icon: Sparkles,
  },
  {
    title: "Research & Innovation",
    body: "A customizable platform for faculty research, interdisciplinary collaboration, educational experimentation, and funded projects.",
    icon: Brain,
  },
] as const

function PvamuSlide() {
  return (
    <SlideShell>
      <div className="mb-1 flex items-center justify-between gap-4">
        <Eyebrow>Institutional value</Eyebrow>
        <Image
          src="/landing/pvamu-p-mark.png"
          alt="Prairie View A&M University"
          width={72}
          height={72}
          className="h-10 w-auto sm:h-12"
        />
      </div>
      <SlideTitle>Why CourseCollab for PVAMU?</SlideTitle>
      <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {PVAMU_PILLARS.map((pillar, i) => (
          <Card
            key={pillar.title}
            className="pitch-rise flex flex-col justify-center p-5 xl:p-6 2xl:p-7"
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <pillar.icon className="mb-3 h-5 w-5 text-[#EAAA00] xl:mb-4 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7" />
            <p className="text-[14px] font-semibold uppercase tracking-[0.2em] text-[#EAAA00] xl:text-[15px] 2xl:text-[16px]">
              {pillar.title}
            </p>
            <p className="mt-2 text-[18px] leading-relaxed text-white/75 xl:text-[21px] 2xl:text-[23px]">
              {pillar.body}
            </p>
          </Card>
        ))}
      </div>
      <p className="mt-auto pt-5 text-center font-sans text-xl font-extrabold tracking-tight text-white sm:text-2xl xl:text-3xl 2xl:text-[2.1rem]">
        Built from our classroom experience.
        <span className="text-[#F6D56A]"> Customizable to our needs. </span>
        Supported directly within our academic community.
      </p>
    </SlideShell>
  )
}

function CloseSlide() {
  return (
    <SlideShell className="items-center justify-center text-center">
      <CourseCollabLogo
        size="lg"
        framed
        frameClassName="border-white/15 bg-white/5"
      />
      <p className="mt-6 text-[14px] uppercase tracking-[0.28em] text-white/40">CourseCollab</p>
      <h2 className="mt-3 max-w-3xl font-sans font-extrabold tracking-tight text-4xl leading-[1.1] text-white sm:text-5xl">
        From managing courses
        <br />
        <span className="text-[#F6D56A]">to supporting learning.</span>
      </h2>
      <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        <CloseCol
          title="Students"
          items={["Learn", "Practice", "Build", "Collaborate", "Improve"]}
        />
        <CloseCol
          title="Faculty"
          items={["Teach", "Assess", "Understand", "Support", "Automate"]}
        />
        <CloseCol
          title="Institution"
          items={["Innovate", "Research", "Evaluate", "Scale"]}
        />
      </div>
      <p className="mt-10 font-sans font-extrabold tracking-tight text-2xl text-white">
        Questions & Discussion
      </p>
      <p className="mt-2 text-[18px] font-medium text-[#EAAA00]">coursecollab.com</p>
    </SlideShell>
  )
}

function CloseCol({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-4 text-left">
      <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[#EAAA00]">{title}</p>
      <p className="mt-2 text-[18px] leading-relaxed text-white/70">{items.join(" · ")}</p>
    </Card>
  )
}
