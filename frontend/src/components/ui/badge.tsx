import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        project:
          "border-transparent bg-accent-soft text-primary hover:bg-primary/15 cursor-pointer font-medium",
        exploring: "border-transparent bg-muted text-muted-foreground",
        building: "border-transparent bg-accent-soft text-primary font-medium",
        paused: "border-transparent bg-muted text-muted-foreground opacity-60",
        completed: "border-transparent bg-brand-soft text-brand font-medium",
        tag: "border border-border bg-transparent text-muted-foreground hover:border-primary/30 hover:text-primary font-normal transition-colors",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
