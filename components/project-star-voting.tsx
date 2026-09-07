"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Users, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/app-toast";
import { motion, AnimatePresence } from "framer-motion";
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes";
import { cn } from "@/lib/utils";

interface ProjectStarVotingProps {
  projectId: number;
  voterId: number;
  voterType: "student" | "instructor";
  onVoteUpdate?: () => void;
}

interface ScoreData {
  studentVotes: number;
  instructorVotes: number;
  studentAvgRating: number;
  instructorAvgRating: number;
  studentPoints: number;
  instructorPoints: number;
  totalScore: number;
}

interface UserVote {
  rating: number;
  comment: string | null;
}

export function ProjectStarVoting({
  projectId,
  voterId,
  voterType,
  onVoteUpdate,
}: ProjectStarVotingProps) {
  const [scoreInput, setScoreInput] = useState<string>("");
  const [comment, setComment] = useState("");
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);

  // Max points based on voter type
  const maxPoints = voterType === "instructor" ? 20 : 30;
  const pointsPerStar = voterType === "instructor" ? 4 : 6;

  useEffect(() => {
    fetchVoteData();
  }, [projectId, voterId, voterType]);

  const fetchVoteData = async () => {
    try {
      const response = await fetch(
        `/api/projects/vote-stars?projectId=${projectId}&voterId=${voterId}&voterType=${voterType}`
      );
      if (response.ok) {
        const data = await response.json();
        setScoreData(data.score);
        if (data.userVote) {
          setUserVote(data.userVote);
          // Convert stars back to points for display
          const points = data.userVote.rating * pointsPerStar;
          setScoreInput(points.toString());
          setComment(data.userVote.comment || "");
        }
      }
    } catch (error) {
      console.error("Error fetching vote data:", error);
    }
  };

  const submitVote = async () => {
    const score = parseFloat(scoreInput);
    
    if (isNaN(score) || score < 0 || score > maxPoints) {
      toast.error(`Please enter a score between 0 and ${maxPoints}`);
      return;
    }

    // Store exact decimal to preserve precise scores
    // Instructor: 18 pts → 4.5 stars (exact, no rounding)
    // Student: 1 (not used in calculation anymore)
    const rating = voterType === "instructor" ? score / pointsPerStar : 1;

    setLoading(true);
    try {
      const response = await fetch("/api/projects/vote-stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          voterId,
          voterType,
          rating: rating, // Exact decimal for instructor, 1 for student
          comment: comment.trim() || null,
        }),
      });

      if (response.ok) {
        await fetchVoteData();
        onVoteUpdate?.();
        toast.success(
          userVote ? "Score updated successfully!" : "Score submitted successfully!"
        );
        setShowCommentBox(false);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to submit score");
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      toast.error("Failed to submit score");
    } finally {
      setLoading(false);
    }
  };

  const removeVote = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/vote-stars?projectId=${projectId}&voterId=${voterId}&voterType=${voterType}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setScoreInput("");
        setComment("");
        setUserVote(null);
        setShowCommentBox(false);
        await fetchVoteData();
        onVoteUpdate?.();
        toast.success("Score removed");
      } else {
        toast.error("Failed to remove score");
      }
    } catch (error) {
      console.error("Error removing vote:", error);
      toast.error("Failed to remove score");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={cn("flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
            <Award className="h-4 w-4 text-[var(--cc-accent)]" />
            Score this project
          </h3>
          <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
            {voterType === "instructor"
              ? "Your score contributes 0–20 points (40% of the project grade)."
              : "Student scores collectively contribute 0–30 points (60% of the project grade)."}
          </p>
        </div>
        {scoreData ? (
          <div className="shrink-0 text-right">
            <p className={cn("text-2xl font-semibold tabular-nums", PORTAL_TEXT)}>
              {scoreData.totalScore.toFixed(1)}
            </p>
            <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>/ 50 points</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <label className={cn("block text-sm font-semibold", PORTAL_TEXT)}>
          Enter score (0–{maxPoints} points)
        </label>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              type="number"
              min="0"
              max={maxPoints}
              step="0.5"
              value={scoreInput}
              onChange={(e) => {
                setScoreInput(e.target.value);
                setShowCommentBox(true);
              }}
              placeholder={`Enter 0–${maxPoints}`}
              className="h-14 text-center text-2xl font-semibold"
              disabled={loading}
            />
            <p className={cn("mt-1 text-center text-xs", PORTAL_TEXT_MUTED)}>
              {scoreInput && !isNaN(parseFloat(scoreInput))
                ? `Exact score: ${parseFloat(scoreInput).toFixed(1)} points`
                : voterType === "instructor"
                  ? "Max 20 points"
                  : "Max 30 points"}
            </p>
          </div>
          <div className="min-w-[72px] text-right">
            <p className={cn("text-3xl font-semibold tabular-nums", PORTAL_TEXT)}>{scoreInput || "0"}</p>
            <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>/ {maxPoints}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Poor", value: voterType === "instructor" ? "4" : "6" },
            { label: "Fair", value: voterType === "instructor" ? "8" : "12" },
            { label: "Good", value: voterType === "instructor" ? "12" : "18" },
            { label: "Very Good", value: voterType === "instructor" ? "16" : "24" },
            { label: "Excellent", value: maxPoints.toString() },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => {
                setScoreInput(preset.value);
                setShowCommentBox(true);
              }}
              className="h-8 rounded-lg text-xs"
              disabled={loading}
            >
              {preset.label} ({preset.value})
            </Button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showCommentBox && scoreInput ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <Textarea
              placeholder="Add a comment about your score (optional)…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
              disabled={loading}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={submitVote}
                disabled={loading || !scoreInput}
                className="rounded-lg bg-[var(--cc-accent)] text-[var(--cc-accent-foreground,#fff)] hover:opacity-90"
              >
                {loading ? "Submitting…" : userVote ? "Update score" : "Submit score"}
              </Button>
              {userVote ? (
                <Button
                  variant="outline"
                  onClick={removeVote}
                  disabled={loading}
                  className="rounded-lg text-[var(--cc-sem-danger)]"
                >
                  Remove
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => {
                  setShowCommentBox(false);
                  if (!userVote) {
                    setScoreInput("");
                    setComment("");
                  }
                }}
                disabled={loading}
                className="rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {scoreData ? (
        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          <h4 className={cn("flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
            <TrendingUp className="h-4 w-4 text-[var(--cc-accent)]" />
            Score breakdown
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={cn("inline-flex items-center gap-2", PORTAL_TEXT_MUTED)}>
                <Users className="h-4 w-4" />
                Students ({scoreData.studentVotes} votes)
              </span>
              <span className={cn("font-semibold tabular-nums", PORTAL_TEXT)}>
                {scoreData.studentPoints.toFixed(1)} / 30
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--cc-accent)]"
                style={{ width: `${Math.min(100, (scoreData.studentPoints / 30) * 100)}%` }}
              />
            </div>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {scoreData.studentAvgRating > 0
                ? `Avg ${scoreData.studentAvgRating.toFixed(2)} × 6 = ${scoreData.studentPoints.toFixed(1)} pts`
                : scoreData.studentVotes > 0
                  ? `${scoreData.studentVotes} vote${scoreData.studentVotes === 1 ? "" : "s"} recorded`
                  : "No student scores yet"}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={PORTAL_TEXT_MUTED}>Instructor</span>
              <span className={cn("font-semibold tabular-nums", PORTAL_TEXT)}>
                {scoreData.instructorPoints.toFixed(1)} / 20
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--cc-accent)]"
                style={{ width: `${Math.min(100, (scoreData.instructorPoints / 20) * 100)}%` }}
              />
            </div>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {scoreData.instructorPoints > 0
                ? `${scoreData.instructorPoints.toFixed(1)} pts from faculty`
                : "No instructor score yet"}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className={cn("text-sm font-semibold", PORTAL_TEXT)}>Total</span>
            <span className={cn("rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums", PORTAL_TEXT)}>
              {scoreData.totalScore.toFixed(1)} / 50
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

