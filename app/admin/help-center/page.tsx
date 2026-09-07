"use client"

import { useState } from "react"
import { AdminHeader } from "@/components/admin-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  HelpCircle, 
  Search, 
  BookOpen, 
  Video, 
  MessageSquare, 
  ExternalLink,
  ChevronRight,
  Lightbulb,
  Settings,
  Users,
  BarChart3,
  FileText,
  Zap,
  Shield,
  Mail
} from "lucide-react"
import { motion } from "framer-motion"

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  tags: string[]
}

interface TutorialItem {
  id: string
  title: string
  description: string
  type: "video" | "article" | "guide"
  duration?: string
  difficulty: "beginner" | "intermediate" | "advanced"
  url?: string
}

export default function AdminHelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const faqItems: FAQItem[] = [
    {
      id: "1",
      question: "How do I create a new quiz?",
      answer: "Navigate to the Quizzes module, click 'Create New Quiz', fill in the quiz details, add questions from the question bank or create new ones, set time limits and availability, then publish.",
      category: "quizzes",
      tags: ["quiz", "creation", "questions"]
    },
    {
      id: "2",
      question: "How do I manage student groups?",
      answer: "Go to the Groups module, create new groups or edit existing ones, assign students to groups, set group leaders, and monitor group activities and progress.",
      category: "groups",
      tags: ["groups", "students", "management"]
    },
    {
      id: "3",
      question: "How do I view student performance analytics?",
      answer: "Access the Results module to see detailed analytics, export data, view performance trends, and analyze student progress across different assessments.",
      category: "analytics",
      tags: ["analytics", "performance", "results"]
    },
    {
      id: "4",
      question: "How do I configure AI evaluation settings?",
      answer: "Navigate to AI Evaluation module, select evaluation models, set grading criteria, configure accuracy thresholds, and monitor AI scoring performance.",
      category: "ai",
      tags: ["ai", "evaluation", "grading"]
    },
    {
      id: "5",
      question: "How do I manage course sessions?",
      answer: "Go to Sessions module, create new academic sessions, assign students to sections, set session parameters, and manage session-specific settings.",
      category: "sessions",
      tags: ["sessions", "courses", "management"]
    }
  ]

  const tutorials: TutorialItem[] = [
    {
      id: "1",
      title: "Getting Started with CourseCollab Admin",
      description: "Complete walkthrough of the admin dashboard and core features",
      type: "video",
      duration: "15 min",
      difficulty: "beginner",
      url: "#"
    },
    {
      id: "2",
      title: "Creating Effective Quizzes",
      description: "Best practices for quiz creation and question bank management",
      type: "article",
      difficulty: "intermediate",
      url: "#"
    },
    {
      id: "3",
      title: "Advanced Analytics and Reporting",
      description: "Deep dive into analytics features and custom reporting",
      type: "guide",
      difficulty: "advanced",
      url: "#"
    },
    {
      id: "4",
      title: "AI Evaluation Setup Guide",
      description: "Step-by-step guide to configuring AI grading systems",
      type: "video",
      duration: "20 min",
      difficulty: "intermediate",
      url: "#"
    }
  ]

  const quickLinks = [
    { title: "Quiz Management", icon: FileText, href: "/admin/quizzes", color: "text-blue-600 bg-blue-100" },
    { title: "Student Management", icon: Users, href: "/admin/students", color: "text-green-600 bg-green-100" },
    { title: "Analytics Dashboard", icon: BarChart3, href: "/admin/analytics", color: "text-purple-600 bg-purple-100" },
    { title: "System Settings", icon: Settings, href: "/admin/settings", color: "text-orange-600 bg-orange-100" },
    { title: "AI Evaluation", icon: Zap, href: "/admin/ai-evaluation", color: "text-pink-600 bg-pink-100" },
    { title: "Security Center", icon: Shield, href: "/admin/security", color: "text-red-600 bg-red-100" }
  ]

  const filteredFAQs = faqItems.filter(item => {
    const matchesSearch = searchQuery === "" || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const categories = [
    { id: "all", name: "All Topics", icon: HelpCircle },
    { id: "quizzes", name: "Quizzes", icon: FileText },
    { id: "groups", name: "Groups", icon: Users },
    { id: "analytics", name: "Analytics", icon: BarChart3 },
    { id: "ai", name: "AI Evaluation", icon: Zap },
    { id: "sessions", name: "Sessions", icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <HelpCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Help Center</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Find answers, tutorials, and support resources</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 p-1">
              <TabsTrigger value="overview" className="rounded-lg px-6">Overview</TabsTrigger>
              <TabsTrigger value="faq" className="rounded-lg px-6">FAQ</TabsTrigger>
              <TabsTrigger value="tutorials" className="rounded-lg px-6">Tutorials</TabsTrigger>
              <TabsTrigger value="contact" className="rounded-lg px-6">Contact Support</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Search */}
              <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20">
                <CardContent className="p-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="Search help articles, FAQs, and tutorials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 pr-4 py-3 text-lg border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Quick Links</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quickLinks.map((link, index) => (
                    <motion.div
                      key={link.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group hover:-translate-y-1">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${link.color}`}>
                              <link.icon className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {link.title}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Access module</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Recent Updates */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Recent Updates</h2>
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Lightbulb className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">New AI Evaluation Features</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Enhanced AI grading with improved accuracy and new evaluation criteria options.</p>
                          <span className="text-xs text-gray-500">2 days ago</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Analytics Dashboard Improvements</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">New visualization options and export capabilities for better data analysis.</p>
                          <span className="text-xs text-gray-500">1 week ago</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="faq" className="space-y-6">
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`rounded-lg ${
                      selectedCategory === category.id 
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white" 
                        : "hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                    }`}
                  >
                    <category.icon className="h-4 w-4 mr-2" />
                    {category.name}
                  </Button>
                ))}
              </div>

              {/* FAQ Items */}
              <div className="space-y-4">
                {filteredFAQs.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                              {item.question}
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            {item.answer}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tutorials" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {tutorials.map((tutorial, index) => (
                  <motion.div
                    key={tutorial.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group hover:-translate-y-1">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                              {tutorial.type === "video" ? (
                                <Video className="h-5 w-5 text-indigo-600" />
                              ) : tutorial.type === "article" ? (
                                <BookOpen className="h-5 w-5 text-indigo-600" />
                              ) : (
                                <FileText className="h-5 w-5 text-indigo-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {tutorial.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {tutorial.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={tutorial.difficulty === "beginner" ? "default" : tutorial.difficulty === "intermediate" ? "secondary" : "destructive"}
                                className="text-xs"
                              >
                                {tutorial.difficulty}
                              </Badge>
                              {tutorial.duration && (
                                <span className="text-xs text-gray-500">{tutorial.duration}</span>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" className="group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Contact Support
                  </CardTitle>
                  <CardDescription>Get help from our support team</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Support Channels</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                          <Mail className="h-5 w-5 text-indigo-600" />
                          <div>
                            <p className="font-medium">Email Support</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">support@coursecollab.com</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                          <MessageSquare className="h-5 w-5 text-indigo-600" />
                          <div>
                            <p className="font-medium">Live Chat</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Available 24/7</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Response Times</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Email Support:</span>
                          <span className="text-gray-600 dark:text-gray-400">Within 24 hours</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Live Chat:</span>
                          <span className="text-gray-600 dark:text-gray-400">Immediate</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Priority Issues:</span>
                          <span className="text-gray-600 dark:text-gray-400">Within 4 hours</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  )
}

