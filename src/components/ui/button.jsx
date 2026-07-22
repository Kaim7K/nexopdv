import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold shadow-sm transition duration-150 ease-out hover:-translate-y-px active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none motion-reduce:transform-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-primary/15 hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-destructive/15 hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:border-muted-foreground/30 hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "shadow-none hover:bg-accent/10 hover:text-accent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-9 px-3 text-xs sm:min-h-8",
        lg: "min-h-12 px-6 sm:px-8",
        icon: "h-11 w-11 p-0 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** @type {React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'default'|'destructive'|'outline'|'secondary'|'ghost'|'link', size?: 'default'|'sm'|'lg'|'icon', asChild?: boolean} & React.RefAttributes<HTMLButtonElement>>} */
const Button = React.forwardRef(({ className, variant, size, asChild = false, type, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      type={asChild ? undefined : type || 'button'}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
