
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimetableDragData, TimetableSession } from "@/lib/types";
import { BookOpen, GraduationCap, User } from "lucide-react";

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
        "cursor-grab active:cursor-grabbing transition-all duration-200 ease-in-out shadow-md hover:shadow-lg h-20 w-full flex flex-col items-center justify-center relative group",
        isConflict ? "bg-destructive/20 border-destructive ring-2 ring-destructive" : "bg-card",
        session.isDouble && session.part === 1 ? "rounded-b-none border-b-0" : "",
        session.isDouble && session.part === 2 ? "rounded-t-none border-t-0" : ""
      )}
      title={`Subject: ${session.subject}\nClass: ${session.className}\nTeacher: ${session.teacher}`}
    >
       {session.isDouble && <div className="absolute top-0 right-1 text-xs text-muted-foreground opacity-70">D</div>}
       {isConflict && <div className="absolute top-0 left-1 text-xs text-destructive-foreground bg-destructive rounded-full h-4 w-4 flex items-center justify-center font-bold">!</div>}
      <CardContent className="p-1.5 text-center space-y-1 w-full">
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-primary shrink-0"/>
          <span className="truncate">{session.subject}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <GraduationCap className="h-3 w-3 shrink-0"/>
          <span className="truncate">{session.className}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0"/>
          <span className="truncate">{session.teacher}</span>
        </div>
      </CardContent>
    </Card>
  );
}
