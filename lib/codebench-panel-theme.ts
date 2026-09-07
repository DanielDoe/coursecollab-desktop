/** Light/dark surface classes for CodeBench side panels (debug, style review, chat). */

export function codebenchPanelTheme(isLight: boolean) {
  return {
    root: isLight ? "bg-slate-50" : "bg-slate-900/50",
    header: isLight ? "border-slate-200 bg-white" : "border-slate-700/50 bg-slate-800/50",
    title: isLight ? "text-slate-900" : "text-slate-200",
    subtitle: isLight ? "text-slate-600" : "text-slate-400",
    body: isLight ? "text-slate-800" : "text-slate-200",
    muted: isLight ? "text-slate-600" : "text-slate-400",
    card: isLight ? "bg-white border-slate-200" : "bg-slate-800/50 border-slate-700",
    cardSelected: isLight ? "border-red-400 shadow-md shadow-red-500/10" : "border-red-500/50 shadow-lg shadow-red-500/10",
    code: isLight ? "bg-slate-100 text-slate-800 border border-slate-200" : "bg-slate-900/50 text-slate-300",
    warnBox: isLight ? "bg-amber-50 border-amber-300" : "bg-yellow-500/10 border-yellow-500/30",
    warnLabel: isLight ? "text-amber-800 font-semibold" : "text-yellow-400",
    warnText: isLight ? "text-amber-950" : "text-yellow-200",
    infoBox: isLight ? "bg-sky-50 border-sky-300" : "bg-blue-500/10 border-blue-500/30",
    infoLabel: isLight ? "text-sky-800 font-semibold" : "text-blue-400",
    infoText: isLight ? "text-sky-950" : "text-blue-200",
    option: isLight ? "bg-slate-50 border-slate-200 hover:bg-slate-100" : "bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50",
    optionText: isLight ? "text-slate-800" : "text-slate-200",
    optionCorrect: isLight ? "bg-emerald-50 border-emerald-400" : "bg-green-500/10 border-green-500/30",
    optionWrong: isLight ? "bg-red-50 border-red-400" : "bg-red-500/10 border-red-500/30",
    successBox: isLight ? "bg-emerald-50 border-emerald-300" : "bg-green-500/10 border-green-500/30",
    successTitle: isLight ? "text-emerald-800" : "text-green-300",
    successText: isLight ? "text-emerald-900" : "text-slate-300",
    resolveBtn: isLight
      ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-400"
      : "bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30",
    tabsList: isLight ? "bg-slate-100 border-slate-200" : "bg-slate-800/50 border-slate-700/50",
    tabActive: isLight ? "bg-white text-emerald-800 shadow-sm" : "bg-emerald-500/20 text-emerald-300",
    principleBox: isLight ? "bg-violet-50 border-violet-300" : "bg-blue-500/10 border-blue-500/30",
    principleLabel: isLight ? "text-violet-800 font-semibold" : "text-blue-400",
    principleText: isLight ? "text-violet-950" : "text-blue-200",
    exampleCode: isLight ? "text-emerald-800" : "text-emerald-300",
  }
}

export function codebenchChatTheme(isLight: boolean) {
  return {
    root: isLight ? "bg-white" : "bg-[#080b10]",
    header: isLight
      ? "border-slate-200 bg-white"
      : "border-[#582c83]/25 bg-gradient-to-r from-[#1a0f28]/90 to-[#0f1419]/90",
    headerTitle: isLight ? "text-slate-900" : "text-white",
    headerSubtitle: isLight ? "text-slate-600" : "text-slate-400",
    modeBadge: isLight
      ? "border-violet-300 bg-violet-100 text-violet-800"
      : "border-[#582c83]/40 bg-[#582c83]/20 text-violet-200",
    messages: isLight ? "bg-slate-50" : "bg-[#080b10]",
    emptyTitle: isLight ? "text-slate-900" : "text-white",
    emptySubtitle: isLight ? "text-slate-600" : "text-slate-400",
    assistantBubble: isLight
      ? "border border-slate-200 bg-white text-slate-800 shadow-sm"
      : "border border-white/[0.08] bg-[#12161f] text-slate-100 shadow-md",
    userBubble: isLight
      ? "bg-violet-600 text-white shadow-md"
      : "bg-gradient-to-br from-[#582c83] to-[#6d3d9a] text-white shadow-lg shadow-purple-950/30",
    thinkingBubble: isLight
      ? "border border-slate-200 bg-white"
      : "border border-white/[0.08] bg-[#12161f]",
    thinkingText: isLight ? "text-slate-600" : "text-slate-400",
    composer: isLight ? "border-slate-200 bg-white" : "border-[#582c83]/25 bg-[#0a0e14]",
    input: isLight
      ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-violet-400 focus:ring-violet-400/30"
      : "border-white/10 bg-[#12161f] text-slate-100 placeholder:text-slate-500 focus:border-[#582c83]/60 focus:ring-[#582c83]/30",
    loadingText: isLight ? "text-slate-600" : "text-slate-400",
  }
}
