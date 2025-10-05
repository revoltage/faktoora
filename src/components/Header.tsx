import { ReactNode, useState } from "react";

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
        className={`sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-12 flex items-center justify-between border-b shadow-sm px-3 ${className}`}
      >
        <div className="flex items-center">
          <h2 className="text-sm font-semibold text-primary tracking-tight">
            Faktoora
          </h2>
        </div>
        <div className="flex items-center">{center}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] shadow-none"
            onClick={() => setIsSettingsOpen(true)}
          >
            Settings
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
