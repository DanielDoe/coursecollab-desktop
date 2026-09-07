/**
 * Submit Cora-generated code fixes as GitHub pull requests.
 * Uses GitHub REST (Contents + Pulls). Requires GITHUB_TOKEN + repo config.
 */

export type CoraGithubFixFile = {
  path: string
  content: string
}

export type CoraGithubFixInput = {
  title: string
  description: string
  files: CoraGithubFixFile[]
  branchName?: string
  labels?: string[]
  linkedIssue?: number
}

export type CoraGithubFixResult = {
  success: boolean
  message: string
  pullRequestUrl?: string
  pullRequestNumber?: number
  branchName?: string
}

function githubConfig() {
  const token = process.env.CORA_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  const owner =
    process.env.CORA_GITHUB_OWNER ||
    process.env.GITHUB_OWNER ||
    process.env.GITHUB_REPOSITORY?.split("/")[0]
  const repo =
    process.env.CORA_GITHUB_REPO ||
    process.env.GITHUB_REPO ||
    process.env.GITHUB_REPOSITORY?.split("/")[1]
  const baseBranch = process.env.CORA_GITHUB_BASE_BRANCH || process.env.GITHUB_BASE_BRANCH || "main"
  return { token, owner, repo, baseBranch }
}

export function isCoraGithubEnabled(): boolean {
  const { token, owner, repo } = githubConfig()
  return Boolean(token && owner && repo)
}

async function githubFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T; raw: string }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  const raw = await res.text()
  let data = {} as T
  if (raw) {
    try {
      data = JSON.parse(raw) as T
    } catch {
      data = { message: raw } as T
    }
  }
  return { ok: res.ok, status: res.status, data, raw }
}

function sanitizeBranchName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\.\./g, "")
}

export async function submitCoraGithubFix(input: CoraGithubFixInput): Promise<CoraGithubFixResult> {
  const { token, owner, repo, baseBranch } = githubConfig()
  if (!token || !owner || !repo) {
    return {
      success: false,
      message:
        "GitHub fix submission is not configured. Set GITHUB_TOKEN (or CORA_GITHUB_TOKEN) plus CORA_GITHUB_OWNER and CORA_GITHUB_REPO.",
    }
  }

  const title = input.title?.trim()
  const files = (input.files ?? [])
    .map((f) => ({ path: normalizePath(String(f.path ?? "")), content: String(f.content ?? "") }))
    .filter((f) => f.path && f.content.length > 0)

  if (!title) return { success: false, message: "title is required" }
  if (!files.length) return { success: false, message: "At least one file is required" }

  const branchName =
    sanitizeBranchName(input.branchName || `cora/fix-${Date.now().toString(36)}`) ||
    `cora/fix-${Date.now().toString(36)}`

  const refRes = await githubFetch<{ object?: { sha?: string }; message?: string }>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    token,
  )
  if (!refRes.ok || !refRes.data.object?.sha) {
    return {
      success: false,
      message: `Could not read base branch "${baseBranch}": ${refRes.data.message || refRes.raw}`,
    }
  }
  const baseSha = refRes.data.object.sha

  const createRef = await githubFetch<{ ref?: string; message?: string }>(
    `/repos/${owner}/${repo}/git/refs`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    },
  )
  if (!createRef.ok) {
    return {
      success: false,
      message: `Could not create branch: ${createRef.data.message || createRef.raw}`,
    }
  }

  for (const file of files) {
    const existing = await githubFetch<{ sha?: string }>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branchName)}`,
      token,
    )

    const put = await githubFetch<{ content?: { path?: string }; message?: string }>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path).replace(/%2F/g, "/")}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `fix(cora): update ${file.path}`,
          content: Buffer.from(file.content, "utf8").toString("base64"),
          branch: branchName,
          ...(existing.ok && existing.data.sha ? { sha: existing.data.sha } : {}),
        }),
      },
    )
    if (!put.ok) {
      return {
        success: false,
        message: `Failed to write ${file.path}: ${put.data.message || put.raw}`,
        branchName,
      }
    }
  }

  const bodyParts = [
    input.description?.trim() || "Cora Copilot proposed this fix for review.",
    "",
    "_Submitted via CourseCollab Cora Copilot._",
  ]
  if (input.linkedIssue != null) bodyParts.unshift(`Closes #${input.linkedIssue}`, "")

  const pr = await githubFetch<{ html_url?: string; number?: number; message?: string }>(
    `/repos/${owner}/${repo}/pulls`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        head: branchName,
        base: baseBranch,
        body: bodyParts.join("\n"),
      }),
    },
  )

  if (!pr.ok || !pr.data.html_url) {
    return {
      success: false,
      message: `Branch created but PR failed: ${pr.data.message || pr.raw}`,
      branchName,
    }
  }

  if (input.labels?.length && pr.data.number) {
    await githubFetch(`/repos/${owner}/${repo}/issues/${pr.data.number}/labels`, token, {
      method: "POST",
      body: JSON.stringify({ labels: input.labels }),
    }).catch(() => null)
  }

  return {
    success: true,
    message: `Pull request #${pr.data.number} opened for review.`,
    pullRequestUrl: pr.data.html_url,
    pullRequestNumber: pr.data.number,
    branchName,
  }
}
