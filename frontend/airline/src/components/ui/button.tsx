import * as React from "react";
import { cn } from "@/src/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
    let variantClass = "bg-primary text-white hover:bg-primary-hover";
    if (variant === "ghost") variantClass = "hover:bg-accent hover:text-accent-foreground";
    else if (variant === "outline") variantClass = "border border-input bg-background hover:bg-accent";
    else if (variant === "destructive") variantClass = "bg-red-600 text-white hover:bg-red-700";
    else if (variant === "secondary") variantClass = "bg-gray-100 text-gray-900 hover:bg-gray-200";

    let sizeClass = "h-10 px-4 py-2";
    if (size === "icon") sizeClass = "h-5 w-5 p-0";
    else if (size === "sm") sizeClass = "h-9 px-3";
    else if (size === "lg") sizeClass = "h-11 px-8";

    return (
      <button
        className={cn(base, variantClass, sizeClass, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
