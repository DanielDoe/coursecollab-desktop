"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Code,
  Video,
  Headphones,
  Image,
  FileText,
  Zap,
  Clock,
  Target,
  Brain,
  Save,
  Check
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { portalAccentIconClass } from "@/lib/portal-module-themes"

const aiTutorTheme = getStudentModuleTheme("ai-tutor")

interface LearningPreferences {
  preferredStyle: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
  explanationDepth: 'brief' | 'detailed' | 'comprehensive'
  codeExamples: boolean
  visualDiagrams: boolean
  stepByStepBreakdown: boolean
  realWorldAnalogies: boolean
  responseLength: number // 1-5 scale
  technicalLevel: number // 1-5 scale
}

interface LearningStylePreferencesProps {
  studentId: string
  onPreferencesChange?: (prefs: LearningPreferences) => void
  embedInDashboard?: boolean
}

export function LearningStylePreferences({
  studentId,
  onPreferencesChange,
  embedInDashboard = false,
}: LearningStylePreferencesProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<LearningPreferences>({
    preferredStyle: 'visual',
    explanationDepth: 'detailed',
    codeExamples: true,
    visualDiagrams: true,
    stepByStepBreakdown: true,
    realWorldAnalogies: true,
    responseLength: 3,
    technicalLevel: 3
  })

  useEffect(() => {
    loadPreferences()
  }, [studentId])

  const loadPreferences = () => {
    const saved = localStorage.getItem(`learningPrefs_${studentId}`)
    if (saved) {
      try {
        setPreferences(JSON.parse(saved))
      } catch (error) {
        console.error("Failed to load preferences:", error)
      }
    }
  }

  const savePreferences = () => {
    setSaving(true)
    
    // Save to localStorage
    localStorage.setItem(`learningPrefs_${studentId}`, JSON.stringify(preferences))
    
    // Notify parent component
    onPreferencesChange?.(preferences)
    
    setTimeout(() => {
      setSaving(false)
      toast({
        title: "Preferences Saved!",
        description: "AI will adapt responses to your learning style"
      })
    }, 500)
  }

  const updatePreference = (key: keyof LearningPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'visual': return Image
      case 'auditory': return Headphones
      case 'reading': return BookOpen
      case 'kinesthetic': return Code
      default: return Brain
    }
  }

  if (embedInDashboard) {
    const depthLabels = { brief: 'Brief', detailed: 'Detailed', comprehensive: 'Full' } as const
    const lengthLabel = ['Very short', 'Short', 'Medium', 'Long', 'Very long'][preferences.responseLength - 1]
    const levelLabel = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'][preferences.technicalLevel - 1]

    return (
      <div className="space-y-4">
        <section className="rounded-xl bg-[var(--muted)]/30 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
            Learning style
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['visual', 'auditory', 'reading', 'kinesthetic'] as const).map((style) => {
              const Icon = getStyleIcon(style)
              const active = preferences.preferredStyle === style
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => updatePreference('preferredStyle', style)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                      : "hover:bg-[var(--muted)]/45 text-[var(--cc-text)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="capitalize font-medium">{style}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl bg-[var(--muted)]/30 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
            Explanation depth
          </p>
          <div className="flex flex-wrap gap-2">
            {(['brief', 'detailed', 'comprehensive'] as const).map((depth) => (
              <button
                key={depth}
                type="button"
                onClick={() => updatePreference('explanationDepth', depth)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  preferences.explanationDepth === depth
                    ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/45",
                )}
              >
                {depthLabels[depth]}
              </button>
            ))}
          </div>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs text-[var(--cc-text-muted)]">Response length · {lengthLabel}</Label>
              <Slider
                value={[preferences.responseLength]}
                onValueChange={(value) => updatePreference('responseLength', value[0])}
                min={1}
                max={5}
                step={1}
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--cc-text-muted)]">Technical level · {levelLabel}</Label>
              <Slider
                value={[preferences.technicalLevel]}
                onValueChange={(value) => updatePreference('technicalLevel', value[0])}
                min={1}
                max={5}
                step={1}
                className="mt-2"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-[var(--muted)]/30 p-4 space-y-2">
          {[
            { key: 'codeExamples' as const, label: 'Code examples', desc: 'Include practical snippets' },
            { key: 'visualDiagrams' as const, label: 'Visual diagrams', desc: 'ASCII diagrams and flowcharts' },
            { key: 'stepByStepBreakdown' as const, label: 'Step-by-step', desc: 'Break complex topics into steps' },
            { key: 'realWorldAnalogies' as const, label: 'Real-world analogies', desc: 'Use everyday examples' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--cc-text)]">{label}</p>
                <p className="text-xs text-[var(--cc-text-muted)]">{desc}</p>
              </div>
              <Switch
                checked={preferences[key]}
                onCheckedChange={(checked) => updatePreference(key, checked)}
              />
            </div>
          ))}
        </section>

        <div className="flex justify-end">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className={cn("rounded-full gap-2", aiTutorTheme.page.cta)}
          >
            {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saved' : 'Save preferences'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Learning Style Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
            Learning Style Preference
          </CardTitle>
          <CardDescription>
            Choose how you learn best - AI will adapt its explanations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={preferences.preferredStyle}
            onValueChange={(value) => updatePreference('preferredStyle', value as any)}
          >
            <div className="grid grid-cols-2 gap-4">
              {(['visual', 'auditory', 'reading', 'kinesthetic'] as const).map((style) => {
                const Icon = getStyleIcon(style)
                const descriptions = {
                  visual: 'Diagrams, charts, and visual representations',
                  auditory: 'Explanations you can listen to',
                  reading: 'Text-based detailed explanations',
                  kinesthetic: 'Hands-on code examples and practice'
                }

                return (
                  <div key={style}>
                    <Label 
                      htmlFor={style}
                      className={cn(
                        "flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                        preferences.preferredStyle === style
                          ? cn(aiTutorTheme.page.border, aiTutorTheme.page.softBg, "ring-1 ring-[#7a4eba]/40")
                          : "border-slate-200/70 dark:border-white/10 hover:border-[#7a4eba]/40 dark:hover:border-[#7a4eba]/30",
                      )}
                    >
                      <RadioGroupItem value={style} id={style} className="mr-3" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-5 h-5" />
                          <span className="font-semibold capitalize">{style}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {descriptions[style]}
                        </p>
                      </div>
                    </Label>
                  </div>
                )
              })}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Response Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
            Response Customization
          </CardTitle>
          <CardDescription>
            Fine-tune how the AI explains concepts to you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Explanation Depth */}
          <div className="space-y-3">
            <Label>Explanation Depth</Label>
            <RadioGroup
              value={preferences.explanationDepth}
              onValueChange={(value) => updatePreference('explanationDepth', value as any)}
              className="flex gap-3"
            >
              <div className="flex-1">
                <Label
                  htmlFor="brief"
                  className={cn(
                    "flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer",
                    preferences.explanationDepth === 'brief'
                      ? cn(aiTutorTheme.page.border, aiTutorTheme.page.softBg)
                      : "border-slate-200/70 dark:border-white/10",
                  )}
                >
                  <RadioGroupItem value="brief" id="brief" className="sr-only" />
                  <Zap className="w-4 h-4 mr-2" />
                  Brief
                </Label>
              </div>
              <div className="flex-1">
                <Label
                  htmlFor="detailed"
                  className={cn(
                    "flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer",
                    preferences.explanationDepth === 'detailed'
                      ? cn(aiTutorTheme.page.border, aiTutorTheme.page.softBg)
                      : "border-slate-200/70 dark:border-white/10",
                  )}
                >
                  <RadioGroupItem value="detailed" id="detailed" className="sr-only" />
                  <FileText className="w-4 h-4 mr-2" />
                  Detailed
                </Label>
              </div>
              <div className="flex-1">
                <Label
                  htmlFor="comprehensive"
                  className={cn(
                    "flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer",
                    preferences.explanationDepth === 'comprehensive'
                      ? cn(aiTutorTheme.page.border, aiTutorTheme.page.softBg)
                      : "border-slate-200/70 dark:border-white/10",
                  )}
                >
                  <RadioGroupItem value="comprehensive" id="comprehensive" className="sr-only" />
                  <BookOpen className="w-4 h-4 mr-2" />
                  Comprehensive
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Response Length Slider */}
          <div className="space-y-3">
            <Label>Response Length: {['Very Short', 'Short', 'Medium', 'Long', 'Very Long'][preferences.responseLength - 1]}</Label>
            <Slider
              value={[preferences.responseLength]}
              onValueChange={(value) => updatePreference('responseLength', value[0])}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>

          {/* Technical Level Slider */}
          <div className="space-y-3">
            <Label>Technical Level: {['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'][preferences.technicalLevel - 1]}</Label>
            <Slider
              value={[preferences.technicalLevel]}
              onValueChange={(value) => updatePreference('technicalLevel', value[0])}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>

          {/* Toggle Options */}
          <div className="space-y-4 pt-4 border-t border-slate-200/70 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Code Examples</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Include practical code snippets</p>
              </div>
              <Switch
                checked={preferences.codeExamples}
                onCheckedChange={(checked) => updatePreference('codeExamples', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Visual Diagrams</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">ASCII diagrams and flowcharts</p>
              </div>
              <Switch
                checked={preferences.visualDiagrams}
                onCheckedChange={(checked) => updatePreference('visualDiagrams', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Step-by-Step Breakdown</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Break complex topics into steps</p>
              </div>
              <Switch
                checked={preferences.stepByStepBreakdown}
                onCheckedChange={(checked) => updatePreference('stepByStepBreakdown', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Real-World Analogies</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Use everyday examples</p>
              </div>
              <Switch
                checked={preferences.realWorldAnalogies}
                onCheckedChange={(checked) => updatePreference('realWorldAnalogies', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={savePreferences}
          disabled={saving}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 gap-2"
        >
          {saving ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Preferences
            </>
          )}
        </Button>
      </div>

      {/* Preview */}
      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Your AI will respond with:
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Badge variant={preferences.preferredStyle === 'visual' ? 'default' : 'outline'}>
              <Image className="w-3 h-3 mr-1" /> Visual Style
            </Badge>
            <Badge variant={preferences.codeExamples ? 'default' : 'outline'}>
              <Code className="w-3 h-3 mr-1" /> Code Examples
            </Badge>
            <Badge variant={preferences.visualDiagrams ? 'default' : 'outline'}>
              <Target className="w-3 h-3 mr-1" /> Diagrams
            </Badge>
            <Badge variant={preferences.stepByStepBreakdown ? 'default' : 'outline'}>
              <BookOpen className="w-3 h-3 mr-1" /> Step-by-Step
            </Badge>
            <Badge variant={preferences.realWorldAnalogies ? 'default' : 'outline'}>
              <Brain className="w-3 h-3 mr-1" /> Analogies
            </Badge>
            <Badge>
              <Clock className="w-3 h-3 mr-1" /> {['Very Short', 'Short', 'Medium', 'Long', 'Very Long'][preferences.responseLength - 1]}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

