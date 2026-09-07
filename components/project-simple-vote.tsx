"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, Users, Award, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/app-toast";
import { motion } from "framer-motion";

interface ProjectSimpleVoteProps {
  projectId: number;
  studentId: number;
  onVoteUpdate?: () => void;
}

interface ScoreData {
  studentVotes: number;
  studentPoints: number;
  instructorPoints: number;
  totalScore: number;
}

export function ProjectSimpleVote({
  projectId,
  studentId,
  onVoteUpdate,
}: ProjectSimpleVoteProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVoteData();
  }, [projectId, studentId]);

  const fetchVoteData = async () => {
    try {
      const response = await fetch(
        `/api/projects/vote-stars?projectId=${projectId}&voterId=${studentId}&voterType=student`
      );
      if (response.ok) {
        const data = await response.json();
        setScoreData(data.score);
        setHasVoted(!!data.userVote);
      }
    } catch (error) {
      console.error("Error fetching vote data:", error);
    }
  };

  const handleVote = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/projects/vote-stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          voterId: studentId,
          voterType: "student",
          rating: 1, // Simple vote, rating doesn't matter for students anymore
          comment: "",
        }),
      });

      if (response.ok) {
        toast.success("Vote submitted successfully!");
        setHasVoted(true);
        fetchVoteData();
        if (onVoteUpdate) onVoteUpdate();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to submit vote");
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      toast.error("An error occurred while voting");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVote = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/vote-stars?projectId=${projectId}&voterId=${studentId}&voterType=student`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Vote removed");
        setHasVoted(false);
        fetchVoteData();
        if (onVoteUpdate) onVoteUpdate();
      } else {
        toast.error("Failed to remove vote");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Voting Button */}
      <div className="flex items-center gap-3">
        {hasVoted ? (
          <Button
            onClick={handleRemoveVote}
            disabled={loading}
            variant="outline"
            className="flex-1 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            You Voted
          </Button>
        ) : (
          <Button
            onClick={handleVote}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            {loading ? "Voting..." : "Vote for this Project"}
          </Button>
        )}
      </div>

      {/* Score Display */}
      {scoreData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>Student Votes</span>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {scoreData.studentVotes} votes = {scoreData.studentPoints}/30 pts
            </Badge>
          </div>

          {scoreData.instructorPoints > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Award className="h-4 w-4" />
                <span>Instructor Score</span>
              </div>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                {scoreData.instructorPoints}/20 pts
              </Badge>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Total Score</span>
              <span className="text-lg text-indigo-600 dark:text-indigo-400">
                {scoreData.totalScore}/50 pts
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            {30 - scoreData.studentVotes > 0 && (
              <span>Need {30 - scoreData.studentVotes} more votes to reach 30 points</span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

