import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

    const variants = {
      primary: "bg-[#1E3A8A] hover:bg-[#162D6B] text-white",
      secondary: "bg-[#F8FAFF] hover:bg-[#E2E8F0] text-[#1E3A8A] border border-[#E2E8F0]",
      ghost: "bg-transparent hover:bg-[#F8FAFF] text-[#64748B] hover:text-[#0F172A]",
      danger: "bg-[#DC2626] hover:bg-[#B91C1C] text-white",
      success: "bg-[#16A34A] hover:bg-[#15803D] text-white",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs min-h-[36px]",
      md: "px-5 py-2.5 text-sm min-h-[44px]",
      lg: "px-7 py-3.5 text-base min-h-[52px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Loading...
          </span>
        ) : children}
      </button>
    );
  }
);
Button.displayName = "Button";
export { Button };
