"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Search, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConceptModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectConcept: (concept: string) => void
}

const conceptCategories = [
  { name: "Loops", concepts: ["for loops", "while loops", "do-while loops", "nested loops", "loop control"] },
  { name: "Pointers", concepts: ["pointer basics", "pointer arithmetic", "dereferencing", "pointer to pointer", "null pointers"] },
  { name: "Arrays", concepts: ["array declaration", "array indexing", "multidimensional arrays", "array initialization", "array size"] },
  { name: "Functions", concepts: ["function definition", "function calls", "parameters", "return values", "function overloading"] },
  { name: "Classes", concepts: ["class definition", "objects", "constructors", "destructors", "member functions"] },
  { name: "Recursion", concepts: ["recursive functions", "base cases", "recursive calls", "stack overflow", "tail recursion"] },
  { name: "Memory", concepts: ["dynamic allocation", "memory leaks", "smart pointers", "stack vs heap", "memory management"] },
  { name: "Strings", concepts: ["string manipulation", "C-style strings", "std::string", "string operations", "string comparison"] },
]

export function ConceptModal({ isOpen, onClose, onSelectConcept }: ConceptModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredConcepts = conceptCategories
    .flatMap(cat => cat.concepts.map(concept => ({ category: cat.name, concept })))
    .filter(({ concept }) => 
      concept.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const handleConceptSelect = (concept: string) => {
    onSelectConcept(concept)
    onClose()
    setSearchQuery("")
    setSelectedCategory(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] sm:max-h-[85vh] overflow-hidden flex flex-col w-[calc(100%-2rem)] sm:w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl dark:text-slate-200">
            <BookOpen className="w-4 w-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="sm:hidden">Explain Concept</span>
            <span className="hidden sm:inline">Explain a Concept</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a concept (e.g., loops, pointers, arrays)..."
              className="pl-10 pr-4 py-2 w-full"
            />
          </div>

          {/* Quick Categories */}
          <div className="flex flex-wrap gap-2">
            {conceptCategories.map((category) => (
              <Badge
                key={category.name}
                variant={selectedCategory === category.name ? "default" : "outline"}
                className="cursor-pointer hover:bg-purple-100 transition-colors"
                onClick={() => setSelectedCategory(
                  selectedCategory === category.name ? null : category.name
                )}
              >
                {category.name}
              </Badge>
            ))}
          </div>

          {/* Concept List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {selectedCategory ? (
              // Show concepts from selected category
              conceptCategories
                .find(cat => cat.name === selectedCategory)
                ?.concepts.map((concept) => (
                  <motion.button
                    key={concept}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleConceptSelect(concept)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
                  >
                    <div className="font-medium text-slate-900">{concept}</div>
                    <div className="text-xs text-slate-500 mt-1">{selectedCategory}</div>
                  </motion.button>
                ))
            ) : filteredConcepts.length > 0 ? (
              // Show filtered concepts
              filteredConcepts.map(({ category, concept }) => (
                <motion.button
                  key={`${category}-${concept}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConceptSelect(concept)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  <div className="font-medium text-slate-900">{concept}</div>
                  <div className="text-xs text-slate-500 mt-1">{category}</div>
                </motion.button>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                No concepts found. Try a different search term.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
