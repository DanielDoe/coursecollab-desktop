"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { MapPin, Locate } from "lucide-react"

interface ManageGeolocationPanelProps {
  geoRequired: boolean
  geoLat: number | null
  geoLng: number | null
  geoRadiusMeters: number
  onGeoRequiredChange: (value: boolean) => void
  onGeoLatChange: (value: number | null) => void
  onGeoLngChange: (value: number | null) => void
  onGeoRadiusChange: (value: number) => void
  assessmentLabel: string
  disabled?: boolean
  /** When true, renders without outer Card (for embedding in Availability Schedule) */
  embedded?: boolean
}

export function ManageGeolocationPanel({
  geoRequired,
  geoLat,
  geoLng,
  geoRadiusMeters,
  onGeoRequiredChange,
  onGeoLatChange,
  onGeoLngChange,
  onGeoRadiusChange,
  assessmentLabel,
  disabled = false,
  embedded = false,
}: ManageGeolocationPanelProps) {
  const { toast } = useToast()
  const [locationLoading, setLocationLoading] = useState(false)

  const parseCoord = (val: string): number | null => {
    const n = parseFloat(val)
    return Number.isFinite(n) ? n : null
  }

  const handleGetMyLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location Not Supported",
        description: "Your browser does not support geolocation. Please enter coordinates manually.",
        variant: "destructive",
      })
      return
    }

    setLocationLoading(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })

      const lat = position.coords.latitude
      const lng = position.coords.longitude
      onGeoLatChange(lat)
      onGeoLngChange(lng)

      toast({
        title: "Location Retrieved",
        description: `Coordinates set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      })
    } catch (error: unknown) {
      const err = error as { code?: number }
      let message = "Failed to get location."
      if (err.code === 1) {
        message = "Location permission denied. Please allow location access in your browser."
      } else if (err.code === 2) {
        message = "Location unavailable. Ensure GPS/location services are enabled."
      } else if (err.code === 3) {
        message = "Location request timed out. Please try again."
      }
      toast({
        title: "Location Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLocationLoading(false)
    }
  }

  const formContent = (
    <>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <Label htmlFor="geo_required" className="text-base font-medium text-slate-900 dark:text-slate-100 cursor-pointer">
              Require students to be at a specific location
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              When enabled, students must be within the radius of the set coordinates to take this assessment
            </p>
          </div>
          <Switch
            id="geo_required"
            checked={geoRequired}
            onCheckedChange={onGeoRequiredChange}
            disabled={disabled}
          />
        </div>

        {geoRequired && (
          <div className="space-y-5 pl-2 border-l-4 border-emerald-500 ml-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="geo_lat" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Latitude
                </Label>
                <Input
                  id="geo_lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  placeholder="e.g. 40.7128"
                  value={geoLat ?? ""}
                  onChange={(e) => onGeoLatChange(parseCoord(e.target.value))}
                  disabled={disabled}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="geo_lng" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Longitude
                </Label>
                <Input
                  id="geo_lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  placeholder="e.g. -74.0060"
                  value={geoLng ?? ""}
                  onChange={(e) => onGeoLngChange(parseCoord(e.target.value))}
                  disabled={disabled}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetMyLocation}
                disabled={disabled || locationLoading}
                className="gap-2"
              >
                {locationLoading ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Getting location...
                  </>
                ) : (
                  <>
                    <Locate className="h-4 w-4" />
                    Use my current location
                  </>
                )}
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Or enter coordinates manually above
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="geo_radius" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Allowed radius (meters)
              </Label>
              <Input
                id="geo_radius"
                type="number"
                min="10"
                max="5000"
                step="10"
                value={geoRadiusMeters}
                onChange={(e) => onGeoRadiusChange(parseInt(e.target.value) || 100)}
                disabled={disabled}
                className="rounded-xl w-40"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Students must be within this distance of the location. Typical classroom: 50–200m. Building: 100–300m.
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Tip:</strong> Click &quot;Use my current location&quot; to auto-fill coordinates if you&apos;re at the classroom. Or use Google Maps—right-click the location, click the coordinates to copy. Format: latitude, longitude (e.g. 40.7128, -74.0060).
              </p>
            </div>
          </div>
        )}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
            <MapPin className="h-5 w-5 text-emerald-500" />
            Location Restriction
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Restrict where this {assessmentLabel.toLowerCase()} can be taken. Students must be within the specified radius of the designated location.
          </p>
        </div>
        <div className="space-y-5">
          {formContent}
        </div>
      </div>
    )
  }

  return (
    <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-2xl">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-emerald-500" />
          Location Restriction
        </CardTitle>
        <CardDescription>
          Restrict where this {assessmentLabel.toLowerCase()} can be taken. Students must be within the specified radius of the designated location.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {formContent}
      </CardContent>
    </Card>
  )
}
