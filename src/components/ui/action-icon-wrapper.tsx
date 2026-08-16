"use client";

import { useCallback, useState } from "react";
import { StateIconProps } from "./animated-state-icons";

interface ActionIconWrapperProps {
  icon: React.ComponentType<StateIconProps>;
  onClick?: () => void | Promise<void>;
  size?: number;
  className?: string; // Passed to the icon
  wrapperClassName?: string; // Passed to the button
  duration?: number;
  title?: string;
}

export function ActionIconWrapper({ 
  icon: Icon, 
  onClick, 
  size = 20, 
  className, 
  wrapperClassName,
  duration = 2000,
  title
}: ActionIconWrapperProps) {
  const [isActive, setIsActive] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) return;
    
    setIsActive(true);
    try {
      if (onClick) await onClick();
    } finally {
      setTimeout(() => {
        setIsActive(false);
      }, duration);
    }
  }, [isActive, onClick, duration]);

  return (
    <button 
      onClick={handleClick} 
      className={wrapperClassName || "inline-flex items-center justify-center focus:outline-none bg-transparent border-none p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"}
      type="button"
      title={isActive ? "Ação concluída" : title}
    >
      <Icon size={size} className={className} isActive={isActive} />
    </button>
  );
}
