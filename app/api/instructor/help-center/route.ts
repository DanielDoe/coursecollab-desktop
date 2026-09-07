import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || 'all'

    let helpContent: any[] = []

    // General help topics
    if (category === 'all' || category === 'general') {
      helpContent.push({
        id: 1,
        category: 'general',
        title: 'Getting Started',
        content: 'Welcome to the Instructor Portal! This guide will help you navigate through all the features and tools available to manage your courses effectively.',
        sections: [
          {
            title: 'Dashboard Overview',
            content: 'The dashboard provides a comprehensive overview of your course statistics, recent activity, and quick access to all modules.'
          },
          {
            title: 'Navigation',
            content: 'Use the sidebar to navigate between different modules. Each module is designed to help you manage specific aspects of your course.'
          }
        ]
      })
    }

    // Quiz management help
    if (category === 'all' || category === 'quizzes') {
      helpContent.push({
        id: 2,
        category: 'quizzes',
        title: 'Managing Quizzes',
        content: 'Learn how to create, edit, and manage quizzes for your students.',
        sections: [
          {
            title: 'Creating Quizzes',
            content: 'Navigate to the Quizzes module and click "Create New Quiz" to start building your assessment.'
          },
          {
            title: 'Question Bank',
            content: 'Use the Question Bank to store and organize questions that can be reused across multiple quizzes.'
          },
          {
            title: 'Quiz Settings',
            content: 'Configure time limits, attempts, and other settings to customize the quiz experience for your students.'
          }
        ]
      })
    }

    // Student management help
    if (category === 'all' || category === 'students') {
      helpContent.push({
        id: 3,
        category: 'students',
        title: 'Student Management',
        content: 'Manage student accounts, track progress, and handle administrative tasks.',
        sections: [
          {
            title: 'Viewing Student Progress',
            content: 'Access detailed analytics and progress reports for each student in your course.'
          },
          {
            title: 'Password Reset Requests',
            content: 'Students can request password resets, which you can approve or deny from the Students module.'
          },
          {
            title: 'Student Communication',
            content: 'Use the notification system to send important updates and announcements to your students.'
          }
        ]
      })
    }

    // Analytics help
    if (category === 'all' || category === 'analytics') {
      helpContent.push({
        id: 4,
        category: 'analytics',
        title: 'Analytics and Reports',
        content: 'Understand student performance and generate comprehensive reports.',
        sections: [
          {
            title: 'Performance Metrics',
            content: 'View detailed analytics on quiz performance, student engagement, and learning outcomes.'
          },
          {
            title: 'Exporting Data',
            content: 'Generate and export reports in various formats for further analysis or record keeping.'
          },
          {
            title: 'Trend Analysis',
            content: 'Track performance trends over time to identify areas for improvement.'
          }
        ]
      })
    }

    // Technical support
    if (category === 'all' || category === 'technical') {
      helpContent.push({
        id: 5,
        category: 'technical',
        title: 'Technical Support',
        content: 'Get help with technical issues and system troubleshooting.',
        sections: [
          {
            title: 'System Requirements',
            content: 'Ensure your browser is up to date and JavaScript is enabled for the best experience.'
          },
          {
            title: 'Common Issues',
            content: 'Troubleshoot common problems like login issues, slow loading, or display problems.'
          },
          {
            title: 'Contact Support',
            content: 'If you need additional help, contact our support team through the help center.'
          }
        ]
      })
    }

    // FAQ section
    const faqs = [
      {
        id: 1,
        question: 'How do I create a new quiz?',
        answer: 'Navigate to the Quizzes module and click "Create New Quiz". Fill in the quiz details and add questions from your question bank or create new ones.'
      },
      {
        id: 2,
        question: 'Can I import questions from external sources?',
        answer: 'Yes, you can import questions in bulk using the Question Bank import feature. Supported formats include CSV and JSON.'
      },
      {
        id: 3,
        question: 'How do I track student progress?',
        answer: 'Use the Analytics module to view detailed reports on student performance, quiz attempts, and learning progress.'
      },
      {
        id: 4,
        question: 'What should I do if a student reports a technical issue?',
        answer: 'Check the system logs and contact technical support if needed. You can also use the notification system to communicate with students about known issues.'
      },
      {
        id: 5,
        question: 'How do I manage different academic sessions?',
        answer: 'Use the Sessions module to create and manage different academic periods. You can assign quizzes and students to specific sessions.'
      }
    ]

    return NextResponse.json({
      helpContent,
      faqs,
      categories: ['general', 'quizzes', 'students', 'analytics', 'technical'],
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error fetching help content:", error)
    return NextResponse.json(
      { error: "Failed to fetch help content" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { question, description, priority = 'medium' } = await req.json()
    
    // In a real system, you would save the support request to the database
    const supportRequest = {
      id: Date.now(),
      question,
      description,
      priority,
      status: 'open',
      createdAt: new Date().toISOString(),
      instructorId: 'current-instructor' // In real app, get from session
    }
    
    return NextResponse.json({
      message: 'Support request submitted successfully',
      request: supportRequest
    })
  } catch (error) {
    console.error("Error submitting support request:", error)
    return NextResponse.json(
      { error: "Failed to submit support request" },
      { status: 500 }
    )
  }
}

