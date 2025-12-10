"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimetableDragData, TimetableSession } from "@/lib/types";
import { BookOpen } from "lucide-react";

type TimetableItemProps = {
  session: TimetableSession;
  isConflict: boolean;
  from: { day: string; period: number };
};

export default function TimetableItem({
  session,
  isConflict,
  from,
}: TimetableItemProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    const dragData: TimetableDragData = { session, from };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all duration-200 ease-in-out shadow-md hover:shadow-lg h-20 flex items-center justify-center",
        isConflict ? "bg-destructive/10 border-destructive ring-2 ring-destructive" : "bg-card"
      )}
    >
      <CardContent className="p-2 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-primary shrink-0"/>
          <span className="truncate">{session.subject}</span>
        </div>
      </CardContent>
    </Card>
  );
}
