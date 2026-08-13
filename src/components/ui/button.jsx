import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-bold shadow-none transition duration-150 ease-out hover:bg-opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:scale-100 disabled:opacity-50 motion-reduce:transform-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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
        default: "min-h-10 px-3.5 py-2",
        sm: "min-h-8 px-2.5 text-xs",
        lg: "min-h-11 px-5",
        icon: "h-10 w-10 p-0 sm:h-9 sm:w-9",
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
