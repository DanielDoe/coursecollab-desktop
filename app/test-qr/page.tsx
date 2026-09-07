"use client";

import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock } from "lucide-react";

export default function TestQRPage() {
  // This is the QR code from the test session we just created
  const qrCode = "ATTEND_1_P01_1762460536420_cda4a24a6679e13f0f54538910051e21";
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 dark:from-slate-950 dark:via-purple-950 dark:to-indigo-950 p-6 flex items-center justify-center">
      <Card className="max-w-2xl w-full shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">
              📱 Test Attendance Session
            </CardTitle>
            <p className="text-white/90">ELEG 1304 - Test Class</p>
            <div className="flex items-center justify-center gap-4 text-sm">
              <Badge className="bg-white/20 text-white border-0">
                <Calendar className="h-3 w-3 mr-1" />
                Section P01
              </Badge>
              <Badge className="bg-white/20 text-white border-0">
                <Clock className="h-3 w-3 mr-1" />
                Active for 2 hours
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center space-y-6">
            {/* QR Code */}
            <div className="p-8 bg-white rounded-2xl shadow-xl">
              <QRCodeSVG
                value={qrCode}
                size={350}
                level="H"
                includeMargin
              />
            </div>

            {/* Instructions */}
            <div className="text-center space-y-4 max-w-md">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                Scan to Mark Attendance
              </h3>
              
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 rounded-lg p-4 space-y-2 text-left">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  📱 How to scan:
                </p>
                <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
                  <li>Go to <code className="bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded">/student/attendance</code></li>
                  <li>Click <strong>"Scan QR Code"</strong> button</li>
                  <li>Allow camera permissions</li>
                  <li>Point your camera at this QR code</li>
                  <li>✅ Earn 2 points instantly!</li>
                </ol>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4 text-green-500" />
                <span>Location verification: 100m radius</span>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  💡 <strong>Tip:</strong> This is a test session. In production, instructors will display QR codes during class.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

