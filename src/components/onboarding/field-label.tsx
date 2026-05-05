import { cn } from "@/lib/utils";

interface Props extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ className, required, children, ...props }: Props) {
  return (
    <label
      className={cn("block text-sm font-medium leading-none", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}
