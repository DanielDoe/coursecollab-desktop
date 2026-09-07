import type React from "react"
import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { Inter, Roboto_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

// Set NEXT_PUBLIC_DISABLE_VERCEL_ANALYTICS=true to avoid ERR_BLOCKED_BY_CLIENT in console
// (happens when ad blockers block _vercel/insights/script.js)
const enableAnalytics = process.env.NEXT_PUBLIC_DISABLE_VERCEL_ANALYTICS !== "true"
import { Suspense } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { NotificationProvider } from "@/components/notification-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { MonacoErrorHandlerProvider } from "@/components/monaco-error-handler-provider"
import { SessionCatalogProvider } from "@/components/session-catalog-provider"
import { SessionExpiryGuard } from "@/components/auth/SessionExpiryGuard"
import { SystemErrorCapture } from "@/components/system-error-capture"
import { SystemErrorBoundary } from "@/components/system-error-boundary"
import { NativeWebBridgeListener } from "@/components/native-web-bridge-listener"
import { UserTimezoneProvider } from "@/components/providers/user-timezone-provider"
import { AppQueryProvider } from "@/components/providers/app-query-provider"
import {
  DEFAULT_USER_TIMEZONE,
  USER_TIMEZONE_COOKIE,
  normalizeTimezone,
} from "@/lib/user-timezone"
// Import console override early to disable logs in production
import "@/lib/console-override"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "CourseCollab",
  description: "All-in-one learning platform for modern engineering education.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/course-collab-mark-512.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

// Use dynamic rendering to avoid build worker crashes during static generation
export const dynamic = "force-dynamic"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const cookieTz = cookieStore.get(USER_TIMEZONE_COOKIE)?.value
  let initialTimezone = DEFAULT_USER_TIMEZONE
  if (cookieTz) {
    try {
      initialTimezone = normalizeTimezone(decodeURIComponent(cookieTz))
    } catch {
      initialTimezone = normalizeTimezone(cookieTz)
    }
  }

  return (
    <html
      lang="en"
      className={`${inter.variable} ${robotoMono.variable} scroll-smooth`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try{
    var path=location.pathname.replace(/\\/$/,'')||'/';
    var brandPublic=path==='/'||['/faculty/login','/student/login','/student/forgot-password','/student/reset-password','/student/change-password','/admin/login','/admin/reset-password','/institution/login','/institution/signup','/auth/university','/auth/student','/auth/verify-access-email'].some(function(p){return path===p||path.indexOf(p+'/')===0;});
    if(brandPublic){
      var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;
      var bgLight='#faf8fc';
      var bgDark='#0d0814';
      document.documentElement.style.colorScheme=dark?'dark':'light';
      document.documentElement.style.backgroundColor=dark?bgDark:bgLight;
      document.documentElement.dataset.ccBrandChrome='true';
      document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.remove();});
      [['(prefers-color-scheme: light)',bgLight],['(prefers-color-scheme: dark)',bgDark]].forEach(function(pair){
        var tc=document.createElement('meta');
        tc.setAttribute('name','theme-color');
        tc.setAttribute('content',pair[1]);
        tc.setAttribute('media',pair[0]);
        document.head.appendChild(tc);
      });
      return;
    }
    var raw=localStorage.getItem('course-collab.appearance-prefs');
    var prefs=raw?JSON.parse(raw):null;
    var mode=(prefs&&prefs.appearanceMode)||localStorage.getItem('theme')||'system';
    var dark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    var bg=dark?'#0a0a0a':'#fafafa';
    if(dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme=dark?'dark':'light';
    document.documentElement.style.backgroundColor=bg;
    var metas=document.querySelectorAll('meta[name="theme-color"]');
    if(metas.length===0){
      var tc=document.createElement('meta');
      tc.setAttribute('name','theme-color');
      tc.setAttribute('content',bg);
      document.head.appendChild(tc);
    }else{
      metas.forEach(function(m){
        m.setAttribute('content',bg);
        m.removeAttribute('media');
      });
    }
  }catch(e){}
})();
`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var strip = function(){
    try{
      document.querySelectorAll('[data-cursor-ref]').forEach(function(el){ el.removeAttribute('data-cursor-ref'); });
    }catch(e){}
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',strip,{once:true});
  }else{ strip(); }
  var obs = new MutationObserver(function(mutations){
    for(var i=0;i<mutations.length;i++){
      var m=mutations[i];
      if(m.type==='attributes'&&m.attributeName==='data-cursor-ref'){
        m.target.removeAttribute('data-cursor-ref');
      }
    }
  });
  obs.observe(document.documentElement,{attributes:true,attributeFilter:['data-cursor-ref'],subtree:true});
  var idleStrip = function(){
    strip();
    if(typeof requestIdleCallback==='function'){
      requestIdleCallback(idleStrip,{timeout:5000});
    }else{
      setTimeout(idleStrip,5000);
    }
  };
  if(typeof requestIdleCallback==='function'){
    requestIdleCallback(idleStrip,{timeout:5000});
  }else{
    setTimeout(idleStrip,5000);
  }
})();
`,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning={true}>
        <SystemErrorCapture />
        <SessionExpiryGuard />
        <MonacoErrorHandlerProvider />
        <ThemeProvider>
          <AppQueryProvider>
            <UserTimezoneProvider initialTimezone={initialTimezone}>
            <NotificationProvider>
              <NativeWebBridgeListener />
              <SessionCatalogProvider>
                <SystemErrorBoundary moduleName="Platform Module">
                  <Suspense fallback={null}>{children}</Suspense>
                </SystemErrorBoundary>
              </SessionCatalogProvider>
            </NotificationProvider>
            </UserTimezoneProvider>
          </AppQueryProvider>
        </ThemeProvider>
        <Toaster />
        <SonnerToaster />
        {enableAnalytics && <Analytics />}
      </body>
    </html>
  )
}