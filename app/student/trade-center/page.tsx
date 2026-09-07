"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentHeader } from "@/components/student-header";
import { TradeCenterContent } from "@/components/trade-center-content";

export default function StudentTradeCenterPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const studentSessionData = localStorage.getItem("studentSession");
    if (!studentSessionData) {
      router.push("/student/login");
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <StudentHeader />
      <main className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 max-w-7xl">
        <TradeCenterContent embedInDashboard={false} />
      </main>
    </div>
  );
}
