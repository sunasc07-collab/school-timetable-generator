"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimetableDragData, TimetableSession } from "@/lib/types";
import { BookOpen, User } from "lucide-react";

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
        "cursor-grab active:cursor-grabbing transition-all duration-200 ease-in-out shadow-md hover:shadow-lg",
        isConflict ? "bg-destructive/10 border-destructive ring-2 ring-destructive" : "bg-card"
      )}
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-primary shrink-0"/>
          <span className="truncate">{session.subject}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <User className="h-4 w-4 shrink-0"/>
          <span className="truncate">{session.teacher}</span>
        </div>
      </CardContent>
    </Card>
  );
}
