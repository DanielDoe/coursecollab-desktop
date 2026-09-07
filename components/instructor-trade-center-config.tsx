"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers";
import type { TradeCenterConfigRow } from "@/lib/trade-center-shared";
import { cn } from "@/lib/utils";
import {
  TC_DESC,
  TC_DIVIDER,
  TC_INPUT,
  TC_PANEL,
  TC_PANEL_INNER,
  TC_SPINNER,
  TC_TITLE,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  tcCtaClass,
  tcOutlineClass,
  tcSliderClass,
  tcSwitchClass,
} from "@/lib/trade-center/trade-center-instructor-ui";

const DEFAULTS: TradeCenterConfigRow = {
  session: "ALL",
  practice_weight: 1.0,
  playground_weight: 1.0,
  reading_weight: 0.8,
  weekly_practice_cap: 60,
  weekly_playground_cap: 36,
  weekly_reading_cap: 40,
  ec_conversion_multiplier: 0.01,
  max_engagement_credits: 10,
  trading_enabled: true,
  donations_enabled: true,
  min_donation_points: 100,
  weekly_reset_day: 1,
  is_active: true,
  practice_enabled: true,
  playground_enabled: true,
  reading_enabled: true,
};

export function InstructorTradeCenterConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<TradeCenterConfigRow>(DEFAULTS);

  useEffect(() => {
    void fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/trade-center/config?session=ALL", {
        headers: buildInstructorApiHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.config) {
        const c = data.config;
        setConfig({
          session: c.session || "ALL",
          practice_weight: Number(c.practice_weight) || 1,
          playground_weight: Number(c.playground_weight) || 1,
          reading_weight: Number(c.reading_weight) || 0.8,
          weekly_practice_cap: Number(c.weekly_practice_cap) || 60,
          weekly_playground_cap: Number(c.weekly_playground_cap) || 36,
          weekly_reading_cap: Number(c.weekly_reading_cap) || 40,
          ec_conversion_multiplier: Number(c.ec_conversion_multiplier) || 0.01,
          max_engagement_credits: Number(c.max_engagement_credits) || 10,
          trading_enabled: c.trading_enabled !== false,
          donations_enabled: c.donations_enabled !== false,
          min_donation_points: Number(c.min_donation_points) || 100,
          weekly_reset_day: Number(c.weekly_reset_day) ?? 1,
          is_active: c.is_active !== false,
          practice_enabled: c.practice_enabled !== false,
          playground_enabled: c.playground_enabled !== false,
          reading_enabled: c.reading_enabled !== false,
        });
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/trade-center/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorApiHeaders(),
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      if (response.ok) {
        if (data.config) setConfig(data.config);
        toast({
          title: "Success",
          description: "Trade Center configuration saved successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save configuration",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save configuration",
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
        <p className={cn("mt-4 text-sm", PORTAL_TEXT_MUTED)}>Loading configuration…</p>
      </div>
    );
  }

  const pointsPerEc = Math.max(1, Math.round(1 / (config.ec_conversion_multiplier || 0.01)));

  return (
    <div className={cn(TC_PANEL, TC_PANEL_INNER, "space-y-6")}>
      <div>
        <h2 className={TC_TITLE}>Conversion Rules</h2>
        <p className={cn(TC_DESC, "mt-1")}>Configure how activity points convert to Engagement Credits</p>
      </div>

      <div className={cn("flex flex-wrap gap-6 pb-4 border-b", TC_DIVIDER)}>
            <div className="flex items-center justify-between gap-4 min-w-[200px]">
              <div>
                <Label className={PORTAL_TEXT}>Module active</Label>
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Disable to block all Trade Center activity</p>
              </div>
              <Switch
                checked={config.is_active}
                onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                className={tcSwitchClass()}
              />
            </div>
            <div className="flex items-center justify-between gap-4 min-w-[200px]">
              <div>
                <Label className={PORTAL_TEXT}>EC trading enabled</Label>
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Students can convert points to EC</p>
              </div>
              <Switch
                checked={config.trading_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, trading_enabled: checked })}
                className={tcSwitchClass()}
              />
            </div>
          </div>

          <div className="space-y-4">
            {(
              [
                ["Practice Hub Weight", "practice_weight"],
                ["Playground Weight", "playground_weight"],
                ["Lecture Reading Weight", "reading_weight"],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <Label className={PORTAL_TEXT}>{label}</Label>
                <div className="mt-2 space-y-2">
                  <Slider
                    value={[config[key]]}
                    onValueChange={([value]) => setConfig({ ...config, [key]: value })}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className={cn("w-full", tcSliderClass())}
                  />
                  <div className={cn("flex justify-between text-sm", PORTAL_TEXT_MUTED)}>
                    <span>0.5x</span>
                    <span className="font-semibold">{config[key].toFixed(1)}x</span>
                    <span>2.0x</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t", TC_DIVIDER)}>
            <div>
              <Label className={PORTAL_TEXT}>Weekly Practice Cap</Label>
              <Input
                type="number"
                value={config.weekly_practice_cap}
                onChange={(e) =>
                  setConfig({ ...config, weekly_practice_cap: parseInt(e.target.value, 10) || 0 })
                }
                min={0}
                className={cn("mt-2", TC_INPUT)}
              />
            </div>
            <div>
              <Label className={PORTAL_TEXT}>Weekly Playground Cap</Label>
              <Input
                type="number"
                value={config.weekly_playground_cap}
                onChange={(e) =>
                  setConfig({ ...config, weekly_playground_cap: parseInt(e.target.value, 10) || 0 })
                }
                min={0}
                className={cn("mt-2", TC_INPUT)}
              />
            </div>
            <div>
              <Label className={PORTAL_TEXT}>Weekly Reading Cap</Label>
              <Input
                type="number"
                value={config.weekly_reading_cap}
                onChange={(e) =>
                  setConfig({ ...config, weekly_reading_cap: parseInt(e.target.value, 10) || 0 })
                }
                min={0}
                className={cn("mt-2", TC_INPUT)}
              />
            </div>
          </div>

          <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t", TC_DIVIDER)}>
            <div>
              <Label className={PORTAL_TEXT}>Points per EC</Label>
              <Input
                type="number"
                value={pointsPerEc}
                onChange={(e) => {
                  const ppe = parseInt(e.target.value, 10) || 100;
                  setConfig({ ...config, ec_conversion_multiplier: 1 / Math.max(1, ppe) });
                }}
                min={1}
                max={1000}
                className={cn("mt-2", TC_INPUT)}
              />
              <p className={cn("text-xs mt-1", PORTAL_TEXT_MUTED)}>
                Multiplier: {config.ec_conversion_multiplier.toFixed(4)} (default 100 pts = 1 EC)
              </p>
            </div>
            <div>
              <Label className={PORTAL_TEXT}>Max Engagement Credits (semester cap from trading)</Label>
              <Input
                type="number"
                value={config.max_engagement_credits}
                onChange={(e) =>
                  setConfig({ ...config, max_engagement_credits: parseInt(e.target.value, 10) || 1 })
                }
                min={1}
                max={100}
                className={cn("mt-2", TC_INPUT)}
              />
            </div>
            <div>
              <Label className={PORTAL_TEXT}>Weekly reset day</Label>
              <Input
                type="number"
                value={config.weekly_reset_day}
                onChange={(e) =>
                  setConfig({ ...config, weekly_reset_day: parseInt(e.target.value, 10) || 1 })
                }
                min={0}
                max={6}
                className={cn("mt-2", TC_INPUT)}
              />
              <p className={cn("text-xs mt-1", PORTAL_TEXT_MUTED)}>0 = Sunday, 1 = Monday (ISO week uses Monday)</p>
            </div>
          </div>

          <div className={cn("pt-4 border-t space-y-4", TC_DIVIDER)}>
            <div className="flex items-center justify-between">
              <div>
                <Label className={PORTAL_TEXT}>Enable Donations</Label>
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Allow students to donate points to peers</p>
              </div>
              <Switch
                checked={config.donations_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, donations_enabled: checked })}
                className={tcSwitchClass()}
              />
            </div>

            {config.donations_enabled && (
              <div>
                <Label className={PORTAL_TEXT}>Minimum Donation Points</Label>
                <Input
                  type="number"
                  value={config.min_donation_points}
                  onChange={(e) =>
                    setConfig({ ...config, min_donation_points: parseInt(e.target.value, 10) || 0 })
                  }
                  min={1}
                  className={cn("mt-2", TC_INPUT)}
                />
              </div>
            )}
          </div>

          <div className={cn("flex gap-3 pt-4 border-t", TC_DIVIDER)}>
            <Button onClick={() => void handleSave()} disabled={saving} className={cn("gap-2 rounded-lg", tcCtaClass())}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Configuration
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => void fetchConfig()} className={cn("gap-2 rounded-lg", tcOutlineClass())}>
              <RefreshCw className="h-4 w-4" /> Reset
            </Button>
          </div>
    </div>
  );
}
