"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  HelpCircle,
  Search,
  MessageSquare,
  Mail,
  Phone,
  Clock,
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Users,
  Settings,
  Bug,
  Lightbulb,
  Star,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Send,
  FileText,
  Video,
  Download,
  ExternalLink,
  Heart,
  Zap,
  Shield,
  Target,
  Rocket,
  Brain,
  Award,
} from "lucide-react"
import Link from "next/link"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  tags: string[]
}

interface SupportTicket {
  id: string
  subject: string
  description: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "open" | "in_progress" | "resolved" | "closed"
  createdAt: string
  updatedAt: string
}

export default function HelpSupportPage() {
  const router = useRouter()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    category: "general",
  })
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([])

  const faqData: FAQ[] = [
    {
      id: "1",
      question: "How do I reset my password?",
      answer: "To reset your password, go to your profile settings and click on 'Reset Password'. You'll need to enter your current password and create a new one that meets our security requirements.",
      category: "account",
      tags: ["password", "security", "account"],
    },
    {
      id: "2",
      question: "How can I upgrade my membership?",
      answer: "You can upgrade your membership by going to the Membership page in your profile dropdown. Choose from our Basic, Pro, or Premium plans and follow the upgrade process.",
      category: "billing",
      tags: ["membership", "upgrade", "billing"],
    },
    {
      id: "3",
      question: "How do I submit a quiz?",
      answer: "Navigate to the quiz you want to take, read the instructions carefully, answer all questions, and click 'Submit Quiz' when you're ready. Make sure to review your answers before submitting.",
      category: "quizzes",
      tags: ["quiz", "submission", "assessment"],
    },
    {
      id: "4",
      question: "Can I retake a quiz?",
      answer: "Yes, depending on your membership level and the quiz settings. Basic members have limited retakes, while Pro and Premium members have more retake opportunities.",
      category: "quizzes",
      tags: ["quiz", "retake", "attempts"],
    },
    {
      id: "5",
      question: "How do I access lecture materials?",
      answer: "Go to the Lectures section from your dashboard. Click on any lecture to view slides, materials, and participate in discussions. Some materials may require a higher membership tier.",
      category: "lectures",
      tags: ["lectures", "materials", "slides"],
    },
    {
      id: "6",
      question: "How does the AI tutor work?",
      answer: "The AI tutor provides personalized learning assistance. You can ask questions, get explanations, practice coding, and receive study recommendations based on your progress.",
      category: "ai-tutor",
      tags: ["ai", "tutor", "assistance"],
    },
    {
      id: "7",
      question: "How do I join a study group?",
      answer: "Navigate to the Groups section and browse available study groups. You can request to join groups or create your own. Group leaders will approve your membership.",
      category: "groups",
      tags: ["groups", "study", "collaboration"],
    },
    {
      id: "8",
      question: "What are the system requirements?",
      answer: "CourseCollab works on all modern browsers (Chrome, Firefox, Safari, Edge). We recommend using the latest version of your browser for the best experience.",
      category: "technical",
      tags: ["browser", "requirements", "compatibility"],
    },
  ]

  const categories = [
    { id: "all", name: "All Topics", icon: <BookOpen className="h-4 w-4" /> },
    { id: "account", name: "Account", icon: <Users className="h-4 w-4" /> },
    { id: "billing", name: "Billing", icon: <Settings className="h-4 w-4" /> },
    { id: "quizzes", name: "Quizzes", icon: <Target className="h-4 w-4" /> },
    { id: "lectures", name: "Lectures", icon: <Video className="h-4 w-4" /> },
    { id: "ai-tutor", name: "AI Tutor", icon: <Brain className="h-4 w-4" /> },
    { id: "groups", name: "Groups", icon: <Users className="h-4 w-4" /> },
    { id: "technical", name: "Technical", icon: <Settings className="h-4 w-4" /> },
  ]

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentDatabaseId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    fetchUserTickets()
  }, [])

  const fetchUserTickets = async () => {
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch(`/api/student/support-tickets?studentId=${studentId}`)
      
      if (response.ok) {
        const data = await response.json()
        setUserTickets(data.tickets || [])
      }
    } catch (error) {
      console.error("Failed to fetch support tickets:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!ticketForm.subject || !ticketForm.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setSubmittingTicket(true)
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch("/api/student/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId!),
          ...ticketForm,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Support ticket submitted successfully!",
        })
        setTicketForm({
          subject: "",
          description: "",
          priority: "medium",
          category: "general",
        })
        fetchUserTickets()
      } else {
        throw new Error("Failed to submit ticket")
      }
    } catch (error) {
      console.error("Failed to submit ticket:", error)
      toast({
        title: "Error",
        description: "Failed to submit support ticket",
        variant: "destructive",
      })
    } finally {
      setSubmittingTicket(false)
    }
  }

  const filteredFAQs = faqData.filter(faq => {
    const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory
    const matchesSearch = searchQuery === "" || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500 text-white"
      case "high": return "bg-orange-500 text-white"
      case "medium": return "bg-yellow-500 text-white"
      case "low": return "bg-green-500 text-white"
      default: return "bg-slate-500 text-white"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500 text-white"
      case "in_progress": return "bg-yellow-500 text-white"
      case "resolved": return "bg-green-500 text-white"
      case "closed": return "bg-slate-500 text-white"
      default: return "bg-slate-500 text-white"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <HelpCircle className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading help center...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href={homeLink} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CourseCollab</h1>
            </Link>
            <StudentProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.push(homeLink)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white"
          >
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <HelpCircle className="h-8 w-8 text-white" />
                    </div>
          <div>
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                        Help & Support Center
                      </h1>
                      <p className="text-blue-100 text-lg">
                        Get help, find answers, and connect with our support team
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm">
                      24/7 Support Available
                    </Badge>
                    <Badge className="bg-yellow-400/20 text-yellow-100 border-yellow-300/30 px-4 py-2 text-sm">
                      Average Response: 2 hours
                    </Badge>
          </div>
                </div>
                <div className="hidden lg:block">
                  <div className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <Heart className="h-16 w-16 text-white/80" />
              </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-3 gap-6"
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Live Chat</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  Chat with our support team in real-time
                </p>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-xl">
                  Start Chat
                </Button>
            </CardContent>
          </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Email Support</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  Send us an email and we'll respond within 24 hours
                </p>
                <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl">
                  Send Email
                </Button>
            </CardContent>
          </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Phone Support</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  Call us for immediate assistance
                </p>
                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl">
                  Call Now
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="faq" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
              <TabsTrigger value="faq" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <BookOpen className="h-4 w-4 mr-2" />
                FAQ
              </TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <FileText className="h-4 w-4 mr-2" />
                My Tickets
              </TabsTrigger>
              <TabsTrigger value="contact" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Send className="h-4 w-4 mr-2" />
                Contact Us
              </TabsTrigger>
            </TabsList>

            {/* FAQ Tab */}
            <TabsContent value="faq" className="space-y-6">
              {/* Search and Filters */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        placeholder="Search FAQs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 rounded-xl bg-white/50 dark:bg-slate-700/50"
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center gap-2">
                              {category.icon}
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* FAQ List */}
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredFAQs.map((faq, index) => (
                    <motion.div
                      key={faq.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                        <CardContent className="p-6">
                          <div
                            className="cursor-pointer"
                            onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-slate-800 dark:text-white pr-4">
                                {faq.question}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {categories.find(c => c.id === faq.category)?.name}
                                </Badge>
                                {expandedFAQ === faq.id ? (
                                  <ChevronDown className="h-5 w-5 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-slate-500" />
                                )}
                              </div>
                            </div>
              </div>

                          <AnimatePresence>
                            {expandedFAQ === faq.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700"
                              >
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                                  {faq.answer}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {faq.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </TabsContent>

            {/* My Tickets Tab */}
            <TabsContent value="tickets" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Support Tickets</h2>
                <Badge variant="outline" className="text-sm">
                  {userTickets.length} tickets
                </Badge>
              </div>

              <div className="space-y-4">
                {userTickets.length > 0 ? (
                  userTickets.map((ticket, index) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                                {ticket.subject}
                              </h3>
                              <p className="text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                                {ticket.description}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>Created {new Date(ticket.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>Updated {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                                {ticket.priority}
                              </Badge>
                              <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                                {ticket.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                ) : (
                  <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                    <CardContent className="p-12 text-center">
                      <FileText className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
                        No support tickets yet
                </h3>
                      <p className="text-slate-500 dark:text-slate-400">
                        Submit a ticket if you need help with anything
                </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Contact Us Tab */}
            <TabsContent value="contact" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Contact Form */}
                <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Send className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">Submit Support Ticket</CardTitle>
                        <CardDescription>We'll get back to you as soon as possible</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleSubmitTicket} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="subject" className="text-sm font-semibold">
                          Subject *
                        </Label>
                        <Input
                          id="subject"
                          value={ticketForm.subject}
                          onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                          className="rounded-xl"
                          placeholder="Brief description of your issue"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-sm font-semibold">
                          Category
                        </Label>
                        <Select value={ticketForm.category} onValueChange={(value) => setTicketForm({ ...ticketForm, category: value })}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="technical">Technical Issue</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="feature">Feature Request</SelectItem>
                            <SelectItem value="bug">Bug Report</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority" className="text-sm font-semibold">
                          Priority
                        </Label>
                        <Select value={ticketForm.priority} onValueChange={(value: "low" | "medium" | "high" | "urgent") => setTicketForm({ ...ticketForm, priority: value })}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-sm font-semibold">
                          Description *
                        </Label>
                        <Textarea
                          id="description"
                          value={ticketForm.description}
                          onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                          className="rounded-xl min-h-[120px]"
                          placeholder="Please provide detailed information about your issue..."
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={submittingTicket}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl"
                      >
                        {submittingTicket ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Ticket
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <div className="space-y-6">
                  <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                    <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">Support Hours</CardTitle>
                          <CardDescription>When we're available to help</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-300">Live Chat</span>
                          <span className="text-sm font-semibold text-green-600">24/7</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-300">Email Support</span>
                          <span className="text-sm font-semibold text-green-600">24/7</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-300">Phone Support</span>
                          <span className="text-sm font-semibold text-green-600">9 AM - 6 PM EST</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                    <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">Contact Information</CardTitle>
                          <CardDescription>Get in touch with us</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-slate-500" />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-white">Email</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">support@coursecollab.com</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-slate-500" />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-white">Phone</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">+1 (555) 123-4567</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-5 w-5 text-slate-500" />
              <div>
                            <p className="font-semibold text-slate-800 dark:text-white">Live Chat</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">Available 24/7</p>
                          </div>
                        </div>
              </div>
            </CardContent>
          </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}