import { cn } from "@/lib/utils";

export function SectionIntro({
  title,
  eyebrow,
  children,
  className,
  eyebrowClassName,
}: {
  title: string;
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
  eyebrowClassName?: string;
}) {
  return (
    <div className={cn("flex max-w-4xl flex-col gap-5", className)}>
      {eyebrow ? (
        <p className={cn("neo-kicker", eyebrowClassName)}>{eyebrow}</p>
      ) : null}
      <h2 className="text-4xl leading-[0.95] font-black md:text-6xl">{title}</h2>
      {children ? (
        <div className="max-w-[64ch] text-lg leading-8 text-foreground/70">{children}</div>
      ) : null}
    </div>
  );
}
