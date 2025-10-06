import { ReactNode, useState } from "react";

import { Settings } from "lucide-react";

import { SettingsModal } from "@/components/SettingsModal";
import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  center?: ReactNode;
  className?: string;
}

export function Header({ center, className = "" }: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header
        className={`sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-12 flex items-center justify-between gap-2 border-b shadow-sm px-3 sm:px-4 ${className}`}
      >
        <div className="flex items-center flex-shrink-0">
          <h2 className="text-sm font-semibold text-primary tracking-tight">
            Faktoora
          </h2>
        </div>
        <div className="flex flex-1 justify-center px-1 sm:px-2 min-w-0">
          {center}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <SignOutButton />
        </div>
      </header>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
