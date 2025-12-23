
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimetableDragData, TimetableSession } from "@/lib/types";
import { BookOpen, GraduationCap, User, AlertCircle, Users } from "lucide-react";
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
  const { viewMode, activeTimetable, isConflict } = useTimetable();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    const dragData: TimetableDragData = { session, from };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
  };

  const allSessionsInSlot = useMemo(() => {
    if (!activeTimetable?.timetable) return [];
    const slot = activeTimetable.timetable[from.day]?.[from.period] || [];
    if (session.optionGroup) {
      // Find all sessions that are part of the same option block instance
      return slot.filter(s => s.id === session.id);
    }
    return [session];
  }, [activeTimetable, from.day, from.period, session]);


  const isOptionGroup = !!session.optionGroup;
  
  // For option groups, we only want to render ONE card that represents the entire block.
  // We can ensure this by only rendering if the current session is the first one in the block.
  if (isOptionGroup && allSessionsInSlot.map(s => s.actualSubject).indexOf(session.actualSubject) > 0) {
    return null;
  }

  if (isOptionGroup) {
    const teachersAndSubjects = allSessionsInSlot.map(s => `${s.teacher} (${s.actualSubject})`).join(', ');
    const classes = [...new Set(allSessionsInSlot.map(s => s.className))].join(', ');
    const title = `Option Group: ${session.subject}\nDetails: ${teachersAndSubjects}\nClasses: ${classes}`;
    const hasConflict = isConflict(session.id);

    // Group teachers by their subject for display
    const teachersBySubject = allSessionsInSlot.reduce((acc, s) => {
        const key = s.actualSubject || 'Unknown';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(s.teacher);
        return acc;
    }, {} as Record<string, string[]>);


     return (
       <Card
        draggable
        onDragStart={handleDragStart}
        className={cn(
            "cursor-grab active:cursor-grabbing transition-all duration-200 ease-in-out shadow-md hover:shadow-lg w-full flex flex-col items-center justify-center relative group",
            hasConflict ? "bg-destructive/80 border-destructive text-destructive-foreground" : "bg-card",
        )}
        title={title}
       >
        <CardContent className="p-1.5 text-center space-y-1 w-full text-xs">
            <div className={cn("flex items-center justify-center gap-1.5 font-bold", hasConflict ? "text-destructive-foreground" : "text-foreground")}>
               {hasConflict && <AlertCircle className="h-4 w-4" />}
               <span className="truncate">{session.subject}</span>
             </div>
             
             {Object.entries(teachersBySubject).map(([subj, teachers]) => (
                <div key={subj} className={cn("flex items-start justify-center gap-1.5 text-xs", hasConflict ? "text-destructive-foreground/80" : "text-muted-foreground")}>
                    <BookOpen className="h-3 w-3 shrink-0 mt-0.5"/>
                    <div className="text-left">
                        <span className="font-medium">{subj}: </span>
                        <span className="truncate">{[...new Set(teachers)].join(', ')}</span>
                    </div>
                </div>
             ))}

             <div className={cn("flex items-center justify-center gap-1.5 text-xs pt-1", hasConflict ? "text-destructive-foreground/80" : "text-muted-foreground")}>
               <GraduationCap className="h-3 w-3 shrink-0"/>
               <span className="break-words">{classes}</span>
             </div>
        </CardContent>
       </Card>
     )
  }
  
  const title = `Subject: ${session.subject}\nClass: ${session.className}\nTeacher: ${session.teacher}${session.isDouble ? ` (Double Period, Part ${session.part})` : ''}`;
  const hasConflict = isConflict(session.id);

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
              <span className="truncate">{session.subject}</span>
            </div>
            <div className={cn("flex items-center justify-center gap-1.5", hasConflict ? "text-destructive-foreground/80" : "text-muted-foreground")}>
              <User className="h-3 w-3 shrink-0"/>
              <span className="truncate">{session.teacher}</span>
            </div>
             <div className={cn("flex items-center justify-center gap-1.5", hasConflict ? "text-destructive-foreground/80" : "text-muted-foreground")}>
              <GraduationCap className="h-3 w-3 shrink-0"/>
              <span className="break-words">{session.className}</span>
            </div>
      </CardContent>
    </Card>
  );
}
