import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  id?: string;
}

export function Card({ children, className, onClick, hover, id }: CardProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        "bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5",
        hover && "hover:shadow-[0_4px_24px_rgba(30,58,138,0.12)] hover:-translate-y-0.5 transition-all cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-base font-semibold text-[#0F172A]", className)}>
      {children}
    </h3>
  );
}
