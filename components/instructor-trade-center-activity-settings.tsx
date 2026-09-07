"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Brain, Code, BookOpen, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers";
import { cn } from "@/lib/utils";
import {
  TC_DESC,
  TC_DIVIDER,
  TC_PANEL,
  TC_PANEL_INNER,
  TC_SPINNER,
  TC_TITLE,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  tcChrome,
  tcCtaClass,
  tcIconBadge,
  tcOutlineClass,
  tcSwitchClass,
} from "@/lib/trade-center/trade-center-instructor-ui";

type ActivityToggles = {
  session: string;
  practice_enabled: boolean;
  playground_enabled: boolean;
  reading_enabled: boolean;
};

export function InstructorTradeCenterActivitySettings() {
  const { toast } = useToast();
  const fp = tcChrome().p;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ActivityToggles>({
    session: "ALL",
    practice_enabled: true,
    playground_enabled: true,
    reading_enabled: true,
  });

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/trade-center/config?session=ALL", {
        headers: buildInstructorApiHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.config) {
        const c = data.config;
        setSettings({
          session: c.session || "ALL",
          practice_enabled: c.practice_enabled !== false,
          playground_enabled: c.playground_enabled !== false,
          reading_enabled: c.reading_enabled !== false,
        });
      }
    } catch (error) {
      console.error("Error fetching activity settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const getRes = await fetch("/api/trade-center/config?session=ALL", {
        headers: buildInstructorApiHeaders(),
      });
      const getData = await getRes.json();
      const base = getRes.ok && getData.config ? getData.config : { session: "ALL" };

      const response = await fetch("/api/trade-center/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorApiHeaders(),
        },
        body: JSON.stringify({
          ...base,
          session: settings.session,
          practice_enabled: settings.practice_enabled,
          playground_enabled: settings.playground_enabled,
          reading_enabled: settings.reading_enabled,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Success",
          description: "Activity settings saved. New points from disabled sources will stop accruing.",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save settings",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={cn(TC_PANEL, "flex flex-col items-center justify-center p-12")}>
        <div className={cn("h-8 w-8", TC_SPINNER)} />
        <p className={cn("mt-4 text-sm", PORTAL_TEXT_MUTED)}>Loading settings…</p>
      </div>
    );
  }

  const rows = [
    {
      key: "practice_enabled" as const,
      icon: Brain,
      title: "Practice Hub",
      desc: "Points from practice attempts and sample practice",
    },
    {
      key: "playground_enabled" as const,
      icon: Code,
      title: "Playground",
      desc: "Points from playground sessions",
    },
    {
      key: "reading_enabled" as const,
      icon: BookOpen,
      title: "Lecture Reading",
      desc: "Points from lecture slide opens",
    },
  ];

  return (
    <div className={cn(TC_PANEL, TC_PANEL_INNER, "space-y-5")}>
      <div>
        <h2 className={TC_TITLE}>Activity Settings</h2>
        <p className={cn(TC_DESC, "mt-1")}>
          Enable or disable activity sources for Trade Center points. Existing weekly balances are preserved;
          disabled sources stop contributing on the next sync.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map(({ key, icon: Icon, title, desc }) => (
          <div
            key={key}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border p-4",
              fp.border,
              "bg-[var(--sidebar-accent)]/20",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={tcIconBadge("sm")}>
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <Label className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</Label>
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{desc}</p>
              </div>
            </div>
            <Switch
              checked={settings[key]}
              onCheckedChange={(checked) => setSettings({ ...settings, [key]: checked })}
              className={tcSwitchClass()}
            />
          </div>
        ))}
      </div>

      <div className={cn("flex flex-wrap gap-2 border-t pt-4", TC_DIVIDER)}>
        <Button onClick={() => void handleSave()} disabled={saving} className={cn("gap-2 rounded-lg", tcCtaClass())}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </Button>
        <Button variant="outline" onClick={() => void fetchSettings()} className={cn("gap-2 rounded-lg", tcOutlineClass())}>
          <RefreshCw className="h-4 w-4" /> Reset
        </Button>
      </div>
    </div>
  );
}
