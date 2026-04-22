import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "primary" | "muted";
  className?: string;
}

const variants = {
  default: "bg-[#F1F5F9] text-[#64748B]",
  success: "bg-[#DCFCE7] text-[#16A34A]",
  warning: "bg-[#FEF3C7] text-[#D97706]",
  error: "bg-[#FEE2E2] text-[#DC2626]",
  primary: "bg-[#DBEAFE] text-[#1E3A8A]",
  muted: "bg-[#F8FAFF] text-[#94A3B8]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
