"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  HelpCircle, 
  Search, 
  BookOpen,
  MessageCircle,
  Send,
  Plus,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { FacultyHelpCenterHub } from "@/components/instructor/help/FacultyHelpCenterHub"

interface HelpContent {
  id: number
  category: string
  title: string
  content: string
  sections: Array<{
    title: string
    content: string
  }>
}

interface FAQ {
  id: number
  question: string
  answer: string
}

interface HelpData {
  helpContent: HelpContent[]
  faqs: FAQ[]
  categories: string[]
  lastUpdated: string
}

const cardBase = "border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] rounded-xl shadow-sm"

export function InstructorHelpCenterContent({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  if (embedInDashboard) {
    return <FacultyHelpCenterHub />
  }

  const fp = getFacultyModuleTheme("help-center").page

  const [helpData, setHelpData] = useState<HelpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [supportRequest, setSupportRequest] = useState({
    question: "",
    description: "",
    priority: "medium"
  })
  const [isSupportDialogOpen, setIsSupportDialogOpen] = useState(false)
  const [submittingSupport, setSubmittingSupport] = useState(false)

  useEffect(() => {
    fetchHelpContent()
  }, [selectedCategory])

  const fetchHelpContent = async () => {
    try {
      setLoading(true)
      const response = await instructorApiFetch(`/api/instructor/help-center?category=${selectedCategory}`)
      if (response.ok) {
        const data = await response.json()
        setHelpData(data)
      }
    } catch (error) {
      console.error("Error fetching help content:", error)
    } finally {
      setLoading(false)
    }
  }

  const submitSupportRequest = async () => {
    try {
      setSubmittingSupport(true)
      const response = await instructorApiFetch("/api/instructor/help-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(supportRequest)
      })
      
      if (response.ok) {
        setIsSupportDialogOpen(false)
        setSupportRequest({ question: "", description: "", priority: "medium" })
        // Show success message
      }
    } catch (error) {
      console.error("Error submitting support request:", error)
    } finally {
      setSubmittingSupport(false)
    }
  }

  const filteredContent = helpData?.helpContent.filter(content => 
    content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    content.content.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const filteredFAQs = helpData?.faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedInDashboard ? "min-h-[300px]" : "min-h-[400px]"}`}>
        <div className="text-center">
          <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4 ${embedInDashboard ? fp.border : fp.border}`} />
          <p className="text-slate-600 dark:text-slate-400">Loading help...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={embedInDashboard ? "space-y-4" : "space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {!embedInDashboard && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Help Center</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Find answers and get support</p>
          </div>
        )}
        <div className={`flex items-center gap-3 ${embedInDashboard ? "ml-auto" : ""}`}>
          <Dialog open={isSupportDialogOpen} onOpenChange={setIsSupportDialogOpen}>
            <DialogTrigger asChild>
              <Button className={embedInDashboard ? "bg-teal-600 hover:bg-teal-700 h-9" : ""}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Submit Support Request</DialogTitle>
                <DialogDescription>
                  Describe your issue and we'll get back to you as soon as possible.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Question/Issue
                  </label>
                  <Input
                    placeholder="Brief description of your issue"
                    value={supportRequest.question}
                    onChange={(e) => setSupportRequest(prev => ({ ...prev, question: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Detailed Description
                  </label>
                  <Textarea
                    placeholder="Provide more details about your issue..."
                    value={supportRequest.description}
                    onChange={(e) => setSupportRequest(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Priority
                  </label>
                  <Select value={supportRequest.priority} onValueChange={(value) => setSupportRequest(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
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
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsSupportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={submitSupportRequest} disabled={submittingSupport}>
                    {submittingSupport ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search help articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {helpData?.categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quick Help Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {helpData?.categories.map((category, index) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className={`cursor-pointer transition-all ${embedInDashboard ? cardBase + " hover:bg-teal-50/50 dark:hover:bg-teal-500/5" : "hover:shadow-lg"}`} onClick={() => setSelectedCategory(category)}>
              <CardContent className="p-4 sm:p-6 text-center">
                <div className={`p-3 rounded-lg w-fit mx-auto mb-3 ${embedInDashboard ? "bg-teal-500/10 dark:bg-teal-500/20" : "bg-blue-100 dark:bg-blue-900"}`}>
                  <BookOpen className={`w-6 h-6 ${embedInDashboard ? "text-teal-600 dark:text-teal-400" : "text-blue-600"}`} />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {category}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {helpData.helpContent.filter(content => content.category === category).length} articles
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Help Content */}
      <Tabs defaultValue="articles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="articles">Help Articles</TabsTrigger>
          <TabsTrigger value="faq">Frequently Asked Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4">
          {filteredContent.map((content, index) => (
            <motion.div
              key={content.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className={embedInDashboard ? cardBase : ""}>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`capitalize ${embedInDashboard ? "border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-300" : ""}`}>
                      {content.category}
                    </Badge>
                  </div>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className={`w-5 h-5 ${embedInDashboard ? "text-teal-600 dark:text-teal-400" : "text-blue-500"}`} />
                    {content.title}
                  </CardTitle>
                  <CardDescription>
                    {content.content}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {content.sections.map((section, sectionIndex) => (
                      <div key={sectionIndex} className={`border-l-4 pl-4 ${embedInDashboard ? "border-teal-300 dark:border-teal-500/30" : "border-blue-200 dark:border-blue-800"}`}>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          {section.title}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="faq" className="space-y-4">
          {filteredFAQs.map((faq, index) => (
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className={embedInDashboard ? cardBase : ""}>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-start gap-2">
                      <Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${embedInDashboard ? "text-teal-600 dark:text-teal-400" : "text-blue-500"}`} />
                      {faq.question}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">
                      {faq.answer}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>

      {/* No Content State */}
      {(filteredContent.length === 0 && filteredFAQs.length === 0) && (
        <div className="text-center py-10 sm:py-12">
          <HelpCircle className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 ${embedInDashboard ? cn(fp.iconText, "opacity-50") : "text-slate-400"}`} />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            No Help Content Found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            {searchTerm ? "No content matches your search criteria." : "No help content available for the selected category."}
          </p>
        </div>
      )}
    </div>
  )
}

export default function InstructorHelpCenterPage() {
  return <InstructorHelpCenterContent />
}