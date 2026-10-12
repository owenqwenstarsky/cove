import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-copper text-white hover:bg-copper-deep",
        quiet: "bg-paper text-foreground ring-1 ring-line hover:bg-white",
        danger: "bg-danger text-white hover:brightness-110",
        ghost: "text-foreground hover:bg-black/5",
        sidebar: "justify-start rounded-xl px-3 py-2 text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button type={type} className={cn(buttonStyles({ variant }), className)} {...props} />;
}
