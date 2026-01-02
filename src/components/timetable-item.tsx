
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimetableDragData, TimetableSession } from "@/lib/types";
import { BookOpen, GraduationCap, User, AlertCircle, Users, Lock, Building } from "lucide-react";
import { useTimetable } from "@/context/timetable-provider";
import { useMemo } from "react";

type TimetableItemProps = {
  session: TimetableSession;
  from: { day: string; period: number };
};

export default function TimetableItem({
  session,
  from,
}: TimetableItemProps) {
  const { viewMode, isConflict, timetables } = useTimetable();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    const dragData: TimetableDragData = { session, from };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
  };
  
  const hasConflict = isConflict(session.id);

  const schoolName = useMemo(() => {
    return timetables.find(t => t.id === session.schoolId)?.name || 'Unknown School';
  }, [timetables, session.schoolId]);

  if (session.isLocked) {
     return (
       <Card
        className={cn(
          "transition-all duration-200 ease-in-out shadow-md w-full flex flex-col items-center justify-center relative group bg-muted",
        )}
        title={session.subject}
      >
        <CardContent className="p-1.5 text-center space-y-1 w-full text-xs">
            <div className={cn("flex items-center justify-center gap-1.5 font-bold text-muted-foreground")}>
              <Lock className="h-4 w-4 text-muted-foreground/80 shrink-0"/>
              <span className="truncate font-bold">{session.subject}</span>
            </div>
        </CardContent>
       </Card>
     )
  }
  
  const title = `Subject: ${session.actualSubject || session.subject}\nClass: ${session.className}\nTeacher: ${session.teacher}\nSchool: ${schoolName}`;

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all duration-200 ease-in-out shadow-md hover:shadow-lg w-full flex flex-col items-center justify-center relative group",
        hasConflict ? "bg-destructive/80 border-destructive text-destructive-foreground" : "bg-card",
        session.isDouble && session.part === 1 ? "rounded-b-none border-b-0" : "",
        session.isDouble && session.part === 2 ? "rounded-t-none border-t-0" : ""
      )}
      title={title}
    >
       {session.isDouble && <div className="absolute top-0 right-1 text-xs text-muted-foreground opacity-70">D</div>}
       {hasConflict && <div className="absolute top-0 left-1 text-xs text-destructive-foreground bg-destructive rounded-full h-4 w-4 flex items-center justify-center font-bold ring-2 ring-white">!</div>}
      <CardContent className="p-1.5 text-center space-y-1 w-full text-xs">
            <div className={cn("flex items-center justify-center gap-1.5 font-medium", hasConflict ? "text-destructive-foreground" : "text-foreground")}>
              {hasConflict && <AlertCircle className="h-4 w-4" />}
              <BookOpen className="h-4 w-4 text-primary shrink-0"/>
              <span className="truncate">{session.actualSubject || session.subject}</span>
            </div>
            {viewMode === 'teacher' ? (
                <div className={cn("flex items-center justify-center gap-1.5", hasConflict ? "text-destructive-foreground/80" : "text-muted-foreground")}>
                    <Building className="h-3 w-3 shrink-0"/>
                    <span className="truncate">{schoolName}</span>
                </div>
            ) : (
                <div className={cn("flex items-center justify-center gap-1.5", hasConflict ? "text-destructive-foreground/80" : "text-muted-foreground")}>
                    <User className="h-3 w-3 shrink-0"/>
                    <span className="truncate">{session.teacher}</span>
                </div>
            )}
             <div className={cn("flex items-center justify-center gap-1.5", hasConflict ? "text-destructive-foreground/80" : "text-muted-foreground")}>
              <GraduationCap className="h-3 w-3 shrink-0"/>
              <span className="break-words">{session.className}</span>
            </div>
      </CardContent>
    </Card>
  );
}

    
