import { ReactNode } from "react";

import { SignOutButton } from "@/SignOutButton";

interface HeaderProps {
  center?: ReactNode;
  className?: string;
}

export function Header({ center, className = "" }: HeaderProps) {
  return (
    <header
      className={`sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-12 flex items-center justify-between border-b shadow-sm px-3 ${className}`}
    >
      <div className="flex items-center">
        <h2 className="text-sm font-semibold text-primary tracking-tight">
          Invoice Manager
        </h2>
      </div>
      <div className="flex items-center">{center}</div>
      <div className="flex items-center">
        <SignOutButton />
      </div>
    </header>
  );
}
