"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { X, Sparkles, Zap, Infinity, Rocket, CheckCircle2, Gift, Star, Crown, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface TrialActivationModalProps {
  isOpen: boolean
  onClose: () => void
  daysRemaining: number
}

const perks = [
  {
    icon: Infinity,
    title: "High-capacity Cora",
    description: "Ask unlimited questions to our AI tutor",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
  },
  {
    icon: Zap,
    title: "Unlimited Playground",
    description: "Play unlimited games in the playground",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    gradient: "from-purple-500/20 to-pink-500/20",
    iconBg: "bg-gradient-to-br from-purple-500 to-pink-500",
  },
  {
    icon: Rocket,
    title: "Unlimited Quiz Retakes",
    description: "Retake quizzes as many times as you want",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    gradient: "from-green-500/20 to-emerald-500/20",
    iconBg: "bg-gradient-to-br from-green-500 to-emerald-500",
  },
  {
    icon: Sparkles,
    title: "All Premium Features",
    description: "Access to all CourseCollab premium features",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    gradient: "from-yellow-500/20 to-orange-500/20",
    iconBg: "bg-gradient-to-br from-yellow-500 to-orange-500",
  },
]

export function TrialActivationModal({ isOpen, onClose, daysRemaining }: TrialActivationModalProps) {
  const [currentPerkIndex, setCurrentPerkIndex] = useState(0)
  const [showContent, setShowContent] = useState(isOpen) // Initialize based on isOpen to prevent blank screen
  const [confettiActive, setConfettiActive] = useState(true)
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 })
  const prefersReducedMotion = useReducedMotion()

  // Get window size safely
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
      
      const handleResize = () => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight })
      }
      
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setShowContent(false)
      setConfettiActive(false)
      return
    }

    // Show content immediately to prevent blank screen
    setShowContent(true)

    // Fallback: ensure content shows even if there's an issue
    const fallbackTimer = setTimeout(() => {
      setShowContent(true)
    }, 100)

    // Stop confetti after 2.5 seconds
    const confettiTimer = setTimeout(() => {
      setConfettiActive(false)
    }, 2500)

    // Rotate through perks - engaging but not too fast
    const interval = setInterval(() => {
      setCurrentPerkIndex((prev) => (prev + 1) % perks.length)
    }, 2800)

    return () => {
      clearTimeout(fallbackTimer)
      clearTimeout(confettiTimer)
      clearInterval(interval)
    }
  }, [isOpen])

  // Optimized confetti - enough to be engaging but not overwhelming
  const confettiCount = prefersReducedMotion ? 0 : 30

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100]"
            onClick={onClose}
          />

          {/* Confetti Effect - Optimized */}
          {confettiActive && !prefersReducedMotion && (
            <div className="fixed inset-0 z-[101] pointer-events-none overflow-hidden">
              {[...Array(confettiCount)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: Math.random() * windowSize.width,
                    y: -30,
                    rotate: 0,
                    opacity: 0.8,
                  }}
                  animate={{
                    y: windowSize.height + 50,
                    rotate: 180,
                    opacity: [0.8, 1, 0],
                  }}
                  transition={{
                    duration: 2 + Math.random(),
                    ease: "linear",
                    delay: Math.random() * 0.3,
                  }}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#ef4444"][
                      Math.floor(Math.random() * 5)
                    ],
                    willChange: "transform",
                  }}
                />
              ))}
            </div>
          )}

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
            }}
            className="fixed inset-0 z-[102] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="relative w-full max-w-3xl bg-gradient-to-br from-background via-background/95 to-primary/10 border-2 border-primary/30 shadow-2xl overflow-hidden">
              {/* Subtle animated gradient border */}
              <motion.div
                className="absolute inset-0 rounded-lg opacity-20"
                animate={{
                  background: [
                    "linear-gradient(45deg, #3b82f6, #a855f7)",
                    "linear-gradient(45deg, #a855f7, #10b981)",
                    "linear-gradient(45deg, #10b981, #f59e0b)",
                    "linear-gradient(45deg, #f59e0b, #3b82f6)",
                  ],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ willChange: "background" }}
              />

              {/* Close Button */}
              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-muted/80 transition-colors bg-background/80 backdrop-blur-sm border border-border/50"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </motion.button>

              {/* Content */}
              <div className="relative p-8 md:p-12">
                {/* Header */}
                <AnimatePresence>
                  {showContent && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: "spring",
                        delay: 0.2,
                        stiffness: 200,
                        damping: 20,
                      }}
                      className="text-center mb-10"
                    >
                      {/* Gift Icon with engaging animation */}
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          type: "spring",
                          delay: 0.3,
                          stiffness: 200,
                          damping: 15,
                        }}
                        className="inline-flex items-center justify-center mb-6 relative"
                      >
                        {/* Pulsing glow effect */}
                        {!prefersReducedMotion && (
                          <motion.div
                            animate={{
                              scale: [1, 1.15, 1],
                              opacity: [0.4, 0.6, 0.4],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                            className="absolute inset-0 bg-gradient-to-br from-primary via-purple-500 to-pink-500 rounded-full blur-2xl"
                          />
                        )}
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl">
                          <Gift className="h-12 w-12 text-white" />
                        </div>
                        {/* Sparkles around gift - engaging but optimized */}
                        {!prefersReducedMotion && (
                          <>
                            {[...Array(6)].map((_, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                                transition={{
                                  delay: 0.5 + i * 0.1,
                                  duration: 0.6,
                                  repeat: Infinity,
                                  repeatDelay: 3,
                                }}
                                className="absolute"
                                style={{
                                  top: `${50 + 40 * Math.cos((i * Math.PI) / 3)}%`,
                                  left: `${50 + 40 * Math.sin((i * Math.PI) / 3)}%`,
                                  willChange: "transform, opacity",
                                }}
                              >
                                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                              </motion.div>
                            ))}
                          </>
                        )}
                      </motion.div>

                      {/* Title */}
                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent"
                      >
                        🎉 Welcome to Your Free Trial!
                      </motion.h2>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-xl md:text-2xl text-muted-foreground mb-2"
                      >
                        You now have{" "}
                        <span className="font-bold text-primary text-2xl md:text-3xl">{daysRemaining} days</span> of
                      </motion.p>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, type: "spring" }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30"
                      >
                        <Crown className="h-5 w-5 text-yellow-500" />
                        <span className="font-bold text-lg bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                          Trailblazer Access
                        </span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Perks Grid - Engaging animations */}
                <AnimatePresence>
                  {showContent && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      {perks.map((perk, index) => {
                        const Icon = perk.icon
                        const isActive = index === currentPerkIndex

                        return (
                          <motion.div
                            key={perk.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{
                              opacity: isActive ? 1 : 0.65,
                              y: 0,
                              scale: prefersReducedMotion ? 1 : isActive ? 1.03 : 1,
                            }}
                            transition={{
                              delay: 0.9 + index * 0.12,
                              type: "spring",
                              stiffness: 200,
                              damping: 25,
                            }}
                            className={`relative rounded-xl p-5 border-2 transition-all duration-300 overflow-hidden cursor-pointer ${
                              isActive
                                ? "border-primary/60 shadow-xl shadow-primary/20 bg-gradient-to-br " + perk.gradient
                                : "border-transparent bg-muted/30"
                            }`}
                            style={{ willChange: prefersReducedMotion ? "auto" : "transform, opacity" }}
                            onMouseEnter={() => {
                              if (!isActive && !prefersReducedMotion) {
                                // Subtle hover effect
                              }
                            }}
                          >
                            {/* Subtle glow for active perk */}
                            {isActive && !prefersReducedMotion && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0.15, 0.25, 0.15] }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                                className={`absolute inset-0 bg-gradient-to-br ${perk.gradient} blur-xl`}
                              />
                            )}

                            <div className="relative flex items-start gap-4">
                              {/* Icon with engaging animation */}
                              <motion.div
                                animate={
                                  prefersReducedMotion
                                    ? {}
                                    : isActive
                                    ? {
                                        rotate: [0, 8, -8, 0],
                                        scale: [1, 1.1, 1],
                                      }
                                    : {}
                                }
                                transition={{
                                  duration: 0.8,
                                  repeat: isActive && !prefersReducedMotion ? Infinity : 0,
                                  repeatDelay: 2,
                                  ease: "easeInOut",
                                }}
                                className={`${perk.iconBg} p-3 rounded-lg shadow-lg flex-shrink-0`}
                                style={{ willChange: prefersReducedMotion ? "auto" : "transform" }}
                              >
                                <Icon className="h-6 w-6 text-white" />
                              </motion.div>

                              <div className="flex-1 min-w-0">
                                <motion.h3
                                  animate={prefersReducedMotion ? {} : { scale: isActive ? 1.02 : 1 }}
                                  className="font-bold text-lg mb-1 text-foreground"
                                >
                                  {perk.title}
                                </motion.h3>
                                <p className="text-sm text-muted-foreground">{perk.description}</p>
                              </div>

                              {/* Checkmark with engaging entrance */}
                              {isActive && (
                                <motion.div
                                  initial={{ scale: 0, rotate: -180 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                  className="flex-shrink-0"
                                >
                                  {!prefersReducedMotion && (
                                    <motion.div
                                      animate={{
                                        scale: [1, 1.15, 1],
                                      }}
                                      transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                      }}
                                      className="absolute inset-0 bg-green-500 rounded-full blur-md opacity-40"
                                    />
                                  )}
                                  <CheckCircle2 className="h-6 w-6 text-green-500 relative" />
                                </motion.div>
                              )}
                            </div>

                            {/* Subtle shine effect for active perk */}
                            {isActive && !prefersReducedMotion && (
                              <motion.div
                                initial={{ x: "-100%" }}
                                animate={{ x: "200%" }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  repeatDelay: 2,
                                  ease: "easeInOut",
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12"
                                style={{ willChange: "transform" }}
                              />
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </AnimatePresence>

                {/* Countdown - Engaging but optimized */}
                <AnimatePresence>
                  {showContent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1.4, type: "spring" }}
                      className="text-center p-6 mb-8 rounded-xl bg-gradient-to-r from-primary/15 via-purple-500/15 to-pink-500/15 border-2 border-primary/30 relative overflow-hidden"
                    >
                      {/* Subtle animated background */}
                      {!prefersReducedMotion && (
                        <motion.div
                          animate={{
                            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 bg-[length:200%_100%]"
                          style={{ willChange: "background-position" }}
                        />
                      )}

                      <p className="text-sm font-medium text-muted-foreground mb-2 relative z-10">
                        ⏰ Trial expires in
                      </p>
                      <motion.p
                        animate={
                          prefersReducedMotion
                            ? {}
                            : {
                                scale: [1, 1.03, 1],
                              }
                        }
                        transition={{
                          duration: 2.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent relative z-10"
                        style={{ willChange: prefersReducedMotion ? "auto" : "transform" }}
                      >
                        {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CTA Buttons - Engaging hover effects */}
                <AnimatePresence>
                  {showContent && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.6 }}
                      className="flex flex-col sm:flex-row gap-4"
                    >
                      <motion.div
                        whileHover={prefersReducedMotion ? {} : { scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1"
                      >
                        <Button
                          onClick={onClose}
                          className="w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 hover:from-primary/90 hover:via-purple-500/90 hover:to-pink-500/90 text-white shadow-xl hover:shadow-2xl transition-all text-lg py-6 relative overflow-hidden group"
                          size="lg"
                        >
                          {/* Subtle shine on hover */}
                          {!prefersReducedMotion && (
                            <motion.div
                              initial={{ x: "-100%" }}
                              whileHover={{ x: "200%" }}
                              transition={{ duration: 0.6 }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                            />
                          )}
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            <Rocket className="h-5 w-5" />
                            Start Exploring
                          </span>
                        </Button>
                      </motion.div>

                      <motion.div
                        whileHover={prefersReducedMotion ? {} : { scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1"
                      >
                        <Button
                          onClick={() => {
                            onClose()
                            window.location.href = "/student/membership"
                          }}
                          variant="outline"
                          className="w-full border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5 text-lg py-6 transition-all"
                          size="lg"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <Trophy className="h-5 w-5" />
                            View Plans
                          </span>
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Optimized background elements - subtle but engaging */}
              {!prefersReducedMotion && (
                <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        x: [0, 60, 0],
                        y: [0, 60, 0],
                        opacity: [0.08, 0.15, 0.08],
                      }}
                      transition={{
                        duration: 6 + i * 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 1.5,
                      }}
                      className="absolute w-80 h-80 rounded-full blur-3xl"
                      style={{
                        background: `radial-gradient(circle, ${
                          ["#3b82f6", "#a855f7", "#10b981"][i]
                        } 0%, transparent 70%)`,
                        top: `${30 + i * 30}%`,
                        left: `${20 + i * 30}%`,
                        willChange: "transform, opacity",
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
