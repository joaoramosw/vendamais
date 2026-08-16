"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export interface StateIconProps {
  size?: number;
  color?: string;
  className?: string;
  isActive?: boolean; // Controlled state from parent
}

/* ─── 1. LOADING → SUCCESS ─── */
export function SuccessIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.circle cx="20" cy="20" r="16" stroke={color} strokeWidth={2}
        animate={isActive ? { pathLength: 1, opacity: 1 } : { pathLength: 0.7, opacity: 0.4 }}
        transition={{ duration: 0.5 }}
      />
      {!isActive && (
        <motion.circle cx="20" cy="20" r="16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray="25 75"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "20px 20px" }}
        />
      )}
      <motion.path d="M12 20l6 6 10-12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        animate={isActive ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.4, delay: isActive ? 0.2 : 0 }}
      />
    </svg>
  );
}

/* ─── 2. MENU → CLOSE (Sidebar Use) ─── */
export function MenuCloseIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.line x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={isActive ? { y1: 20, y2: 20, rotate: 45 } : { y1: 12, y2: 12, rotate: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} style={{ transformOrigin: "20px 20px" }}
      />
      <motion.line x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={isActive ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.2 }} style={{ transformOrigin: "20px 20px" }}
      />
      <motion.line x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={isActive ? { y1: 20, y2: 20, rotate: -45 } : { y1: 28, y2: 28, rotate: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} style={{ transformOrigin: "20px 20px" }}
      />
    </svg>
  );
}

/* ─── 3. COPY → COPIED (Table Action Use) ─── */
export function CopiedIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <rect x="12" y="10" width="18" height="22" rx="2" stroke={color} strokeWidth={2} />
      <path d="M10 14h-0a2 2 0 00-2 2v18a2 2 0 002 2h14" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.3} />
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.path key="check" d="M16 21l4 4 6-8" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0 }} transition={{ duration: 0.3 }}
          />
        ) : (
          <motion.g key="lines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <line x1="17" y1="18" x2="25" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
            <line x1="17" y1="23" x2="25" y2="23" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
            <line x1="17" y1="28" x2="22" y2="28" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ─── 4. EYE → HIDDEN (Table Column/Password Use) ─── */
export function EyeToggleIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="M4 20s6-10 16-10 16 10 16 10-6 10-16 10S4 20 4 20z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" animate={isActive ? { opacity: 0.3 } : { opacity: 1 }} transition={{ duration: 0.3 }} />
      <motion.circle cx="20" cy="20" r="5" stroke={color} strokeWidth={2} animate={isActive ? { scale: 0.6, opacity: 0.2 } : { scale: 1, opacity: 1 }} transition={{ duration: 0.3 }} />
      <motion.line x1="6" y1="34" x2="34" y2="6" stroke={color} strokeWidth={2.5} strokeLinecap="round" animate={isActive ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.25 }} />
    </svg>
  );
}

/* ─── 5. SIDEBAR ICONS ─── */
export function AnimatedDashboardIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.rect width="7" height="9" x="3" y="3" rx="1" animate={isActive ? { height: 11, y: -1 } : { height: 9, y: 0 }} transition={{ duration: 0.2 }} />
      <motion.rect width="7" height="5" x="14" y="3" rx="1" animate={isActive ? { height: 7, y: 1 } : { height: 5, y: 0 }} transition={{ duration: 0.2 }} />
      <motion.rect width="7" height="9" x="14" y="12" rx="1" animate={isActive ? { height: 7, y: 1 } : { height: 9, y: 0 }} transition={{ duration: 0.2 }} />
      <motion.rect width="7" height="5" x="3" y="16" rx="1" animate={isActive ? { height: 3, y: -1 } : { height: 5, y: 0 }} transition={{ duration: 0.2 }} />
    </svg>
  );
}

export function AnimatedPackageIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="m7.5 4.27 9 5.15" animate={isActive ? { pathLength: 1, opacity: 1 } : { pathLength: 0.5, opacity: 0.6 }} />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <motion.path d="m3.3 7 8.7 5 8.7-5" animate={isActive ? { y: -1 } : { y: 0 }} />
      <path d="M12 22V12" />
    </svg>
  );
}

export function AnimatedTagsIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z" animate={isActive ? { scale: 1.05 } : { scale: 1 }} style={{ transformOrigin: "12px 12px" }} />
      <path d="M6 9h.01" />
      <motion.path d="m13.5 2 6.71 6.71c.94.94.94 2.48 0 3.42l-3.58 3.58" animate={isActive ? { x: 2 } : { x: 0 }} />
    </svg>
  );
}

export function AnimatedClipboardListIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("", className)} style={{ width: size, height: size }}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <motion.path d="M12 11h4" animate={isActive ? { pathLength: 1 } : { pathLength: 0.2 }} />
      <motion.path d="M12 16h4" animate={isActive ? { pathLength: 1 } : { pathLength: 0.2 }} transition={{ delay: 0.1 }} />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

export function AnimatedFileTextIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <motion.path d="M10 9H8" animate={isActive ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }} />
      <motion.path d="M16 13H8" animate={isActive ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }} transition={{ delay: 0.1 }} />
      <motion.path d="M16 17H8" animate={isActive ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }} transition={{ delay: 0.2 }} />
    </svg>
  );
}

export function AnimatedSendIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="m22 2-7 20-4-9-9-4Z" animate={isActive ? { x: 2, y: -2 } : { x: 0, y: 0 }} />
      <motion.path d="M22 2 11 13" animate={isActive ? { pathLength: 1 } : { pathLength: 0.4 }} />
    </svg>
  );
}

export function AnimatedShieldCheckIcon({ size = 20, color = "currentColor", className, isActive = false }: StateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-2 7-2 2.9 0 5 1 7 2a1 1 0 0 1 1 1v7Z" />
      <motion.path d="m9 12 2 2 4-4" animate={isActive ? { pathLength: 1 } : { pathLength: 0 }} transition={{ duration: 0.3 }} />
    </svg>
  );
}
