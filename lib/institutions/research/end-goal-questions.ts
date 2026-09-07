/** Mission questions from the institution research spec. Client-safe catalog. */
export const END_GOAL_QUESTIONS = [
  { id: "ai_frequency", question: "How often are students using generative AI?" },
  { id: "ai_purpose", question: "What are they using it for?" },
  { id: "concepts_ai", question: "Which concepts generate the most AI assistance requests?" },
  { id: "attempt_before", question: "Do students attempt problems before requesting AI assistance?" },
  { id: "assistance_depth", question: "How much assistance is typically required before successful completion?" },
  { id: "persist_without_ai", question: "Does performance after AI assistance persist when AI is removed?" },
  { id: "strategies_independent", question: "Which assistance strategies are associated with stronger independent performance?" },
  { id: "hints_vs_solutions", question: "Do students who request hints behave differently from students who request worked solutions?" },
  { id: "usage_over_term", question: "How does AI usage change throughout the semester?" },
  { id: "near_deadlines", question: "Does AI usage increase near deadlines?" },
  { id: "intervention_who", question: "Which students engage with targeted interventions?" },
  { id: "intervention_after", question: "What happens after an intervention?" },
  { id: "hard_after_ai", question: "Which concepts remain difficult after AI support?" },
  { id: "time_to_feedback", question: "How quickly do students receive feedback?" },
  { id: "pathways_independent", question: "What learning pathways precede successful independent performance?" },
  { id: "vary_courses", question: "How do these relationships vary across courses and cohorts?" },
  { id: "export_evidence", question: "What evidence can investigators export for rigorous statistical analysis?" },
] as const

export type EndGoalQuestionId = (typeof END_GOAL_QUESTIONS)[number]["id"]
