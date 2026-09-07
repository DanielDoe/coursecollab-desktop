export interface ProjectGroup {
  id: number
  name: string
  session: string
  status: "pending" | "approved" | "rejected"
  pending_changes: any
  created_by: number
}

export interface ProjectLeader {
  id: number
  full_name: string
  student_id: string
}

export interface ProjectMember {
  id: number
  student_id: string
  full_name: string
}

export interface Milestone {
  id: string
  title: string
  deadline: string
}

export interface Project {
  id: number
  group_id: number
  title: string
  summary: string | null
  deliverables: string | null
  target_platform: string | null
  project_link: string | null
  status: "pending" | "approved" | "rejected" | "pending_update" | "pending_delete"
  rejection_reason: string | null
  created_at: string
  updated_at: string
  group: ProjectGroup
  leader: ProjectLeader
  members: ProjectMember[]
  timeline: Milestone[]
}
