/** Guest Cora tools — isolated from Student/Faculty Cora registries. */

export type GuestCoraToolName =
  | "get_guest_profile"
  | "get_guest_career_context"
  | "refresh_guest_career_context"
  | "update_guest_career_profile"
  | "list_guest_recommendations"
  | "get_guest_recommendation_detail"
  | "list_guest_recommendation_attachments"
  | "get_guest_recommendation_brief"
  | "save_guest_recommendation_brief_fields"
  | "generate_guest_recommendation_brief"
  | "list_guest_applications"
  | "get_guest_application_detail"
  | "get_guest_master_resume"
  | "get_guest_cover_letter"
  | "run_guest_resume_match"
  | "generate_guest_cover_letter"
  | "review_guest_resume"
  | "prepare_guest_interview"
  | "draft_guest_statement"
  | "propose_guest_application_plan"

export const GUEST_CORA_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "get_guest_career_context" as const,
      description:
        "Load the full guest career snapshot: résumé status, applications, match scores, recommendation requests, goals, and focus topics.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "refresh_guest_career_context" as const,
      description: "Re-sync guest career context after saving materials or completing a scan.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_guest_career_profile" as const,
      description:
        "Persist what Cora learned about the guest: goals, target roles, career summary, or focus topics.",
      parameters: {
        type: "object",
        properties: {
          goals: { type: "string" },
          career_summary: { type: "string" },
          target_roles: { type: "array", items: { type: "string" } },
          focus_topics: { type: "array", items: { type: "string" } },
          note_key: { type: "string", description: "Optional key for a short remembered fact" },
          note_value: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_guest_applications" as const,
      description: "List application workspaces with match scores and cover letter status.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max rows (default 10)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_guest_application_detail" as const,
      description: "Load one application workspace: opportunity, match score, statuses.",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "number" },
        },
        required: ["application_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_guest_master_resume" as const,
      description: "Read the guest master résumé text and parsed profile summary.",
      parameters: {
        type: "object",
        properties: {
          max_chars: { type: "number", description: "Truncate parsed text (default 4000)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_guest_cover_letter" as const,
      description: "Read a saved cover letter draft for an application.",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "number" },
        },
        required: ["application_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_guest_resume_match" as const,
      description:
        "Run résumé match against an opportunity. Uses saved master résumé when parsed_text is omitted; pass parsed_text only when updating résumé.",
      parameters: {
        type: "object",
        properties: {
          parsed_text: {
            type: "string",
            description: "Optional — paste to update master résumé; omit to use saved résumé",
          },
          opportunity_description: { type: "string" },
        },
        required: ["opportunity_description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_guest_cover_letter" as const,
      description:
        "Generate a cover letter from saved master résumé + opportunity. Pass parsed_text only when updating résumé.",
      parameters: {
        type: "object",
        properties: {
          parsed_text: {
            type: "string",
            description: "Optional — paste to update master résumé; omit to use saved résumé",
          },
          opportunity_description: { type: "string" },
          tone: { type: "string", enum: ["professional", "warm"] },
        },
        required: ["opportunity_description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_guest_profile" as const,
      description:
        "Load the guest profile: name, organization, plan, Cora Credits balance, and onboarding purpose.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_guest_recommendations" as const,
      description: "List the guest's own recommendation requests (status, purpose, deadline, instructor).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max rows (default 10, max 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_guest_recommendation_detail" as const,
      description:
        "Load one recommendation request the guest owns: questionnaire fields, status, deadline, delivery mode.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number", description: "Recommendation request id" },
        },
        required: ["request_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_guest_recommendation_attachments" as const,
      description: "List uploaded supporting materials for a recommendation request (résumé, statement, etc.).",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number" },
        },
        required: ["request_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_guest_recommendation_brief" as const,
      description: "Read the recommendation preparation brief for a request.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number" },
        },
        required: ["request_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_guest_recommendation_brief_fields" as const,
      description:
        "Save brief metadata fields (opportunity title, program, highlights, relationship context) without regenerating AI text.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number" },
          opportunity_title: { type: "string" },
          program_name: { type: "string" },
          highlight_topics: { type: "string" },
          relationship_context: { type: "string" },
        },
        required: ["request_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_guest_recommendation_brief" as const,
      description:
        "Generate or refresh the recommendation preparation brief from questionnaire + materials. Not a recommendation letter.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number" },
          opportunity_title: { type: "string" },
          program_name: { type: "string" },
          highlight_topics: { type: "string" },
          relationship_context: { type: "string" },
        },
        required: ["request_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "review_guest_resume" as const,
      description:
        "Analyze résumé/CV content from authorized recommendation attachments and suggest improvements.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number", description: "Request whose résumé attachment to review" },
          focus: { type: "string", description: "Optional focus area (e.g. graduate school, internship)" },
        },
        required: ["request_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_guest_interview" as const,
      description:
        "Create interview preparation: talking points, likely questions, and practice prompts using authorized materials.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number" },
          company_or_program: { type: "string" },
          role_or_degree: { type: "string" },
          interview_date: { type: "string" },
          job_description: { type: "string" },
        },
        required: ["request_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_guest_statement" as const,
      description:
        "Help draft or improve a personal statement, SOP, or research statement using authorized materials.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "number" },
          statement_type: {
            type: "string",
            enum: ["personal_statement", "sop", "research_statement", "scholarship_essay"],
          },
          prompt: { type: "string", description: "Program requirements or user direction" },
        },
        required: ["request_id", "statement_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_guest_application_plan" as const,
      description:
        "Build an application checklist with tasks and timeline for a program, job, or scholarship.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          deadline: { type: "string" },
          opportunity_type: {
            type: "string",
            enum: ["graduate_school", "internship", "job", "scholarship", "other"],
          },
          notes: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
] as const

export function guestOpenAiToolsForNames(names: readonly GuestCoraToolName[]) {
  const allow = new Set(names)
  return GUEST_CORA_TOOL_DEFS.filter((t) => allow.has(t.function.name as GuestCoraToolName))
}
