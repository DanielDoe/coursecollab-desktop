"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Target, TrendingUp, Code, Brain, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StudentHeader } from "@/components/student-header";
import { getStudentData, studentApiFetch } from "@/lib/auth";
import { motion } from "framer-motion";

interface Topic {
  name: string;
  questionCount: number;
  difficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
  questionTypes: {
    [key: string]: number;
  };
  sampleQuestions: string[];
  detailedInstructions?: string[];
}

interface StudyGuide {
  totalQuestions: number;
  topics: Topic[];
  questionTypeBreakdown: {
    [key: string]: number;
  };
  difficultyBreakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export default function FinalExamStudyGuidePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [studyGuide, setStudyGuide] = useState<StudyGuide | null>(null);
  const [studentData, setStudentData] = useState<any>(null);

  useEffect(() => {
    const data = getStudentData();
    if (!data) {
      router.push("/student/login");
      return;
    }
    setStudentData(data);
    fetchStudyGuide(data.section);
  }, [router]);

  const fetchStudyGuide = async (section: string) => {
    try {
      setLoading(true);
      const response = await studentApiFetch(`/api/student/finals/study-guide?session=${section}`);
      if (!response.ok) {
        throw new Error("Failed to fetch study guide");
      }
      const data = await response.json();
      setStudyGuide(data.studyGuide);
    } catch (error) {
      console.error("Failed to fetch study guide:", error);
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      mcq: "Multiple Choice",
      true_false: "True/False",
      select_all: "Select All That Apply",
      code_output: "Code Output",
      code_debug: "Code Debugging",
      fill_code: "Fill in the Code",
      trace_logic: "Trace Logic",
      scenario_match: "Scenario Matching",
      code_reorder: "Code Reordering",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <StudentHeader />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Generating study guide...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!studyGuide || studyGuide.totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <StudentHeader />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-muted-foreground mb-4">Study Guide Not Available</h3>
              <p className="text-lg text-muted-foreground mb-6">
                The final exam questions are not yet available for analysis. Please check back later.
              </p>
              <Button onClick={() => router.push("/student/final-exams")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Final Exams
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <StudentHeader />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl">
                <BookOpen className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-5xl font-bold text-slate-800 dark:text-slate-200">
                  Final Exam Study Guide
                </h1>
                <p className="text-xl text-muted-foreground mt-2">
                  Comprehensive preparation guide based on exam content
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push("/student/final-exams")}
              variant="outline"
              className="rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Finals
            </Button>
          </div>
        </motion.div>

        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Card className="border-2 border-blue-200 dark:border-blue-800 bg-white/85 dark:bg-slate-800/85">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Questions</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {studyGuide.totalQuestions}
                  </p>
                </div>
                <Target className="h-12 w-12 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 dark:border-purple-800 bg-white/85 dark:bg-slate-800/85">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Topics Covered</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {studyGuide.topics.length}
                  </p>
                </div>
                <Brain className="h-12 w-12 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-white/85 dark:bg-slate-800/85">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Question Types</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {Object.keys(studyGuide.questionTypeBreakdown).length}
                  </p>
                </div>
                <Code className="h-12 w-12 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Question Type Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card className="border-2 border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                Question Type Distribution
              </CardTitle>
              <CardDescription>
                Understanding the types of questions you'll encounter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(studyGuide.questionTypeBreakdown).map(([type, count]) => {
                  const percentage = (count / studyGuide.totalQuestions) * 100;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {getQuestionTypeLabel(type)}
                        </span>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Topics Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <Card className="border-2 border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-800/85">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <Target className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                Key Topics & Focus Areas
              </CardTitle>
              <CardDescription>
                Topics organized by importance and question count
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {studyGuide.topics
                  .sort((a, b) => b.questionCount - a.questionCount)
                  .map((topic, index) => {
                    const topicPercentage = (topic.questionCount / studyGuide.totalQuestions) * 100;
                    return (
                      <motion.div
                        key={topic.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                              {topic.name}
                            </h3>
                            <div className="flex items-center gap-4 mb-3">
                              <Badge variant="outline" className="px-3 py-1">
                                {topic.questionCount} Question{topic.questionCount !== 1 ? 's' : ''}
                              </Badge>
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                {topicPercentage.toFixed(1)}% of exam
                              </span>
                            </div>
                            <Progress value={topicPercentage} className="h-2 mb-4" />
                          </div>
                        </div>

                        {/* Difficulty Breakdown */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Easy</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {topic.difficulty.easy}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
                            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">Medium</p>
                            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                              {topic.difficulty.medium}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                            <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Hard</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">
                              {topic.difficulty.hard}
                            </p>
                          </div>
                        </div>

                        {/* Question Types in Topic */}
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Question Types in this Topic:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(topic.questionTypes).map(([type, count]) => (
                              <Badge key={type} variant="secondary" className="px-2 py-1">
                                {getQuestionTypeLabel(type)}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Detailed Study Instructions */}
                        {topic.detailedInstructions && topic.detailedInstructions.length > 0 && (
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-start gap-3 mb-4">
                              <Lightbulb className="h-6 w-6 text-amber-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
                                  Detailed Study Instructions & Examples
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Comprehensive explanations with code examples for this topic
                                </p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              {topic.detailedInstructions.map((instruction, idx) => {
                                // Check if instruction has bold text (marked with **)
                                const parts = instruction.split(/(\*\*.*?\*\*)/g);
                                return (
                                  <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="p-4 rounded-lg bg-white dark:bg-slate-800 border-l-4 border-blue-500 dark:border-blue-400 shadow-sm hover:shadow-md transition-shadow"
                                  >
                                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {parts.map((part, partIdx) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                          const boldText = part.slice(2, -2);
                                          return (
                                            <span key={partIdx} className="font-bold text-blue-700 dark:text-blue-300">
                                              {boldText}
                                            </span>
                                          );
                                        }
                                        // Check for code-like patterns (backticks or code snippets)
                                        if (part.includes('`') || part.match(/[a-zA-Z_][a-zA-Z0-9_]*\(/)) {
                                          // Split by backticks to handle inline code
                                          const codeParts = part.split(/(`[^`]+`)/g);
                                          return (
                                            <span key={partIdx}>
                                              {codeParts.map((codePart, codeIdx) => {
                                                if (codePart.startsWith('`') && codePart.endsWith('`')) {
                                                  const code = codePart.slice(1, -1);
                                                  return (
                                                    <code key={codeIdx} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded text-xs font-mono">
                                                      {code}
                                                    </code>
                                                  );
                                                }
                                                return <span key={codeIdx}>{codePart}</span>;
                                              })}
                                            </span>
                                          );
                                        }
                                        return <span key={partIdx}>{part}</span>;
                                      })}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* General Study Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                General Study Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Time Management</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Allocate study time based on topic weight. Focus more on topics with higher question counts.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Practice Coding</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {Object.keys(studyGuide.questionTypeBreakdown).some(t => t.includes('code')) 
                      ? "Since coding questions appear, practice writing and debugging code regularly."
                      : "Review code examples from lectures and practice tracing through execution."}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Concept Understanding</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Focus on understanding why concepts work, not just memorizing facts. This helps with application questions.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Review Materials</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Go through all lecture slides, practice problems, and homework assignments related to the topics above.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

