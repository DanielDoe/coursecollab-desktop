"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  User, Search, Presentation, MessageSquare, Code, 
  CheckCircle2, AlertCircle, TrendingUp, Award, 
  ArrowRight, Loader2, Eye
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

interface LearningPathEvent {
  id: number
  timestamp: string
  type: 'lecture_view' | 'ai_question' | 'practice' | 'quiz' | 'mastery'
  module: string
  topic: string
  description: string
  success: boolean
  score?: number
}

interface StudentPath {
  student_id: number
  student_name: string
  student_code: string
  events: LearningPathEvent[]
  current_mastery: number
  weak_topics: string[]
}

export function StudentLearningPath() {
  const [students, setStudents] = useState<{id: number, name: string, code: string}[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [learningPath, setLearningPath] = useState<StudentPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [pathLoading, setPathLoading] = useState(false)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const response = await instructorApiFetch('/api/instructor/students', {
        headers: buildInstructorAuthorizedApiHeaders({
          "x-instructor-id": localStorage.getItem("instructorId") ?? "",
        }),
      })
      const data = await response.json()
      
      if (response.ok) {
        setStudents(data.students || [])
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLearningPath = async (studentId: number) => {
    setPathLoading(true)
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-tutor/learning-path?studentId=${studentId}`)
      const data = await response.json()
      
      if (response.ok) {
        setLearningPath(data.path)
      }
    } catch (error) {
      console.error('Failed to fetch learning path:', error)
    } finally {
      setPathLoading(false)
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'lecture_view': return Presentation
      case 'ai_question': return MessageSquare
      case 'practice': return Code
      case 'quiz': return CheckCircle2
      case 'mastery': return Award
      default: return Eye
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'lecture_view': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      case 'ai_question': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      case 'practice': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      case 'quiz': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
      case 'mastery': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Student Selector */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select 
            value={selectedStudentId?.toString() || ""} 
            onValueChange={(value) => {
              const id = parseInt(value)
              setSelectedStudentId(id)
              fetchLearningPath(id)
            }}
          >
            <SelectTrigger className="flex-1 rounded-full">
              <SelectValue placeholder="Select a student to view their learning path..." />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id.toString()}>
                  {student.name} ({student.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Learning Path Visualization */}
      {pathLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
        </div>
      ) : learningPath ? (
        <div className="space-y-6">
          {/* Student Overview */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">{learningPath.student_name}</h3>
                <div className="flex items-center gap-3">
                  <Badge className="bg-white/20 text-white border-white/30">
                    {learningPath.student_code}
                  </Badge>
                  <span className="text-indigo-100">
                    {learningPath.current_mastery}% Overall Mastery
                  </span>
                </div>
              </div>
              {learningPath.weak_topics.length > 0 && (
                <div>
                  <p className="text-sm text-indigo-100 mb-1">Weak Topics:</p>
                  <div className="flex flex-wrap gap-1">
                    {learningPath.weak_topics.map(topic => (
                      <Badge key={topic} className="bg-red-500 text-white text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Learning Timeline */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Learning Journey
            </h3>

            <ScrollArea className="h-[500px]">
              <div className="relative pr-4">
                {/* Timeline Line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

                {/* Events */}
                <div className="space-y-4">
                  {learningPath.events.map((event, index) => {
                    const Icon = getEventIcon(event.type)
                    const colorClass = getEventColor(event.type)
                    
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative flex items-start gap-4"
                      >
                        {/* Timeline Dot */}
                        <div className={cn(
                          "relative z-10 p-2 rounded-full border-4 border-white dark:border-slate-900",
                          colorClass
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Event Card */}
                        <div className="flex-1 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <Badge className={cn("text-xs mb-1", colorClass)}>
                                {event.module}
                              </Badge>
                              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                {event.topic}
                              </h4>
                            </div>
                            <div className="text-xs text-slate-500">
                              {event.timestamp}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {event.description}
                          </p>
                          {event.score !== undefined && (
                            <Badge variant={event.score >= 70 ? "default" : "destructive"} className="text-xs">
                              Score: {event.score}%
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="text-center py-16">
            <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              Select a Student
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Choose a student above to visualize their complete learning journey
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

