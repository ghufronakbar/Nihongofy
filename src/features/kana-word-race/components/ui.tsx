import type { LucideIcon } from "lucide-react";

export function RaceSectionHeading({ icon: Icon, label, title, id, tone = "accent", as: Heading = "h2" }: {
  icon: LucideIcon;
  label: string;
  title: string;
  id?: string;
  tone?: "accent" | "paper" | "green";
  as?: "h1" | "h2";
}) {
  return <div className="race-section-heading" data-tone={tone}>
    <span className="race-section-icon"><Icon className="size-6" aria-hidden="true" /></span>
    <div className="min-w-0"><p className="race-eyebrow">{label}</p><Heading id={id} className="mt-1 text-xl font-black sm:text-2xl">{title}</Heading></div>
  </div>;
}
