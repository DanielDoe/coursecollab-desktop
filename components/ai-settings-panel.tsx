"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Brain, DollarSign, Zap, Save, RotateCcw } from "lucide-react"

interface AISettings {
  model: string
  temperature: number
  max_tokens: number
  timeout_seconds: number
  confidence_high: number
  confidence_medium: number
  enable_cost_tracking: boolean
  auto_approve_high_confidence: boolean
}

export function AISettingsPanel() {
  const [settings, setSettings] = useState<AISettings>({
    model: "gpt-5.4-mini",
    temperature: 0.0,
    max_tokens: 200,
    timeout_seconds: 20,
    confidence_high: 0.9,
    confidence_medium: 0.5,
    enable_cost_tracking: true,
    auto_approve_high_confidence: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/ai-settings")
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error("[v0] Failed to fetch AI settings:", error)
      toast({
        title: "Error",
        description: "Failed to load AI settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, updated_by: "Admin" }),
      })

      if (!response.ok) throw new Error("Failed to save settings")

      toast({
        title: "Settings saved",
        description: "AI evaluation settings have been updated successfully",
      })
    } catch (error) {
      console.error("[v0] Failed to save AI settings:", error)
      toast({
        title: "Error",
        description: "Failed to save AI settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSettings({
      model: "gpt-5.4-mini",
      temperature: 0.0,
      max_tokens: 200,
      timeout_seconds: 20,
      confidence_high: 0.9,
      confidence_medium: 0.5,
      enable_cost_tracking: true,
      auto_approve_high_confidence: true,
    })
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      {/* AI Model Settings */}
      <Card className="border-2 border-purple-200/50 dark:border-purple-800/50">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-950/20">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Model Settings
          </CardTitle>
          <CardDescription>Configure the AI model and behavior parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={settings.model} onValueChange={(value) => setSettings({ ...settings, model: value })}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (task routing)</SelectItem>
                  <SelectItem value="gpt-5.4-mini">GPT-5.4 Mini (Default)</SelectItem>
                  <SelectItem value="gpt-5.4">GPT-5.4 (Serious grading)</SelectItem>
                  <SelectItem value="gpt-5.4-nano">GPT-5.4 Nano (Fast/cheap)</SelectItem>
                  <SelectItem value="gpt-5.5">GPT-5.5 (Expert)</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fallback)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature (0.0 - 1.0)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: Number.parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_tokens">Max Tokens</Label>
              <Input
                id="max_tokens"
                type="number"
                value={settings.max_tokens}
                onChange={(e) => setSettings({ ...settings, max_tokens: Number.parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={settings.timeout_seconds}
                onChange={(e) => setSettings({ ...settings, timeout_seconds: Number.parseInt(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Thresholds */}
      <Card className="border-2 border-amber-200/50 dark:border-amber-800/50">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            Confidence Thresholds
          </CardTitle>
          <CardDescription>Set confidence levels for automatic grading decisions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="confidence_high">High Confidence (≥)</Label>
              <Input
                id="confidence_high"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.confidence_high}
                onChange={(e) => setSettings({ ...settings, confidence_high: Number.parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Answers above this threshold are auto-approved</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidence_medium">Medium Confidence (≥)</Label>
              <Input
                id="confidence_medium"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.confidence_medium}
                onChange={(e) => setSettings({ ...settings, confidence_medium: Number.parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Answers below this require manual review</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost & Automation */}
      <Card className="border-2 border-green-200/50 dark:border-green-800/50">
        <CardHeader className="bg-gradient-to-r from-green-50 to-transparent dark:from-green-950/20">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Cost & Automation
          </CardTitle>
          <CardDescription>Manage cost tracking and automation preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cost_tracking">Enable Cost Tracking</Label>
              <p className="text-sm text-muted-foreground">Track API costs for each evaluation</p>
            </div>
            <Switch
              id="cost_tracking"
              checked={settings.enable_cost_tracking}
              onCheckedChange={(checked) => setSettings({ ...settings, enable_cost_tracking: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_approve">Auto-approve High Confidence</Label>
              <p className="text-sm text-muted-foreground">Skip manual review for high-confidence answers</p>
            </div>
            <Switch
              id="auto_approve"
              checked={settings.auto_approve_high_confidence}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_approve_high_confidence: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Button onClick={handleReset} variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}
