import { ReactNode } from "react";

interface HeaderProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function Header({ left, center, right, className = "" }: HeaderProps) {
  return (
    <header className={`sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-12 flex items-center justify-between border-b shadow-sm px-3 ${className}`}>
      <div className="flex items-center">{left}</div>
      <div className="flex items-center">{center}</div>
      <div className="flex items-center">{right}</div>
    </header>
  );
}
