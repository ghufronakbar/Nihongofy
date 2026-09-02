import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { QuestionNavList, type NavMondaiItem } from "./question-nav";

export function QuestionNavMobile({
  items,
  activeId,
  buildHref,
  children,
}: {
  items: NavMondaiItem[];
  activeId: number;
  buildHref: (itemId: number) => string;
  children?: React.ReactNode;
}) {
  return (
    <div className="lg:hidden">
      <Sheet>
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <Menu className="size-4" />
          Pilih Mondai & Lembar Jawaban
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Navigasi Mondai</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4 space-y-4">
            {children}
            <QuestionNavList items={items} activeId={activeId} buildHref={buildHref} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
