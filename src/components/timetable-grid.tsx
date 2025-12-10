
"use client";

import { useTimetable } from "@/context/timetable-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TimetableItem from "./timetable-item";
import type { TimetableDragData, TimetableSession } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TimetableGrid() {
  const { timetable, days, timeSlots, moveSession, isConflict, teachers } = useTimetable();

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
  };

  const handleDrop = (
    e: React.DragEvent<HTMLTableCellElement>,
    day: string,
    period: number
  ) => {
    e.preventDefault();
    const data: TimetableDragData = JSON.parse(
      e.dataTransfer.getData("application/json")
    );
    moveSession(data.session, data.from, { day, period });
  };
  
  const getSessionForTeacher = (teacherName: string, day: string, periodIndex: number): TimetableSession | null => {
      const session = timetable[day]?.[periodIndex];
      // This logic is now flawed. The timetable is global, not per teacher.
      // We need to find the session for the current teacher in the global timetable.
      const teacherTimetable = Object.fromEntries(
        Object.entries(timetable).map(([day, sessions]) => [
            day,
            sessions.filter(s => s?.teacher === teacherName)
        ])
      );
      
      const sessionForDay = timetable[day]?.[periodIndex];
      if(sessionForDay && sessionForDay.teacher === teacherName) {
        return sessionForDay;
      }
      
      return null;
  }

  const renderCellContent = (session: TimetableSession | null, day: string, period: number) => {
     if (session) {
       // Hide the second part of a double period if it's being rendered separately
      if (session.isDouble && session.part === 2) {
        const prevPeriodSession = timetable[day]?.[period - 1];
        if (prevPeriodSession && prevPeriodSession.isDouble && prevPeriodSession.subject === session.subject && prevPeriodSession.className === session.className) {
            return null;
        }
      }
      return (
        <TimetableItem
          session={session}
          isConflict={isConflict(session.id)}
          from={{ day, period }}
        />
      );
    }
    return <div className="h-20 w-full" />; // Placeholder for empty slot
  }

  if (teachers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full rounded-lg border-2 border-dashed border-border text-center p-12">
        <div>
          <h3 className="text-lg font-semibold font-headline">No Teachers Added</h3>
          <p className="text-muted-foreground mt-2">
            Add some teachers to get started.
          </p>
        </div>
      </div>
    );
  }
  
  // This renders a timetable for EACH teacher.
  // We need to render ONE global timetable and highlight conflicts.
  // OR render one timetable per class.
  // Let's stick with one per teacher for now, but the logic must be correct.
  return (
    <div className="space-y-8">
        {teachers.map(teacher => (
             <div key={teacher.id}>
                <h2 className="text-2xl font-bold font-headline mb-4">{teacher.name}</h2>
                <div className="rounded-lg border w-full">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="w-28">Day</TableHead>
                        {timeSlots.map((slot, index) => (
                        <TableHead key={index} className="font-headline text-center">
                            {slot.isBreak ? slot.label : (
                                <>
                                    <div>{slot.time}</div>
                                    <div className="text-xs font-normal">Period {slot.period}</div>
                                </>
                            )}
                        </TableHead>
                        ))}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {days.map((day) => {
                        const rowCells = [];
                        let periodIndex = 0;
                        for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
                            const slot = timeSlots[slotIndex];

                            if (slot.isBreak) {
                                rowCells.push(<TableCell key={`break-${slotIndex}`} className="bg-muted/50" />);
                                continue;
                            }
                            
                            const session = timetable[day]?.[periodIndex];
                            const teacherSession = (session?.teacher === teacher.name) ? session : null;
                            const isDoublePart1 = teacherSession?.isDouble && teacherSession.part === 1;
                            
                            rowCells.push(
                                <TableCell
                                    key={slotIndex}
                                    colSpan={isDoublePart1 ? 2 : 1}
                                    className={cn("p-1 align-top", slot.isBreak ? "bg-muted/30" : "")}
                                    onDragOver={(e) => !slot.isBreak && handleDragOver(e)}
                                    onDrop={(e) => !slot.isBreak && handleDrop(e, day, periodIndex)}
                                >
                                    {!slot.isBreak && renderCellContent(teacherSession, day, periodIndex)}
                                </TableCell>
                            );

                            if (isDoublePart1) {
                                slotIndex++; // Skip next slot as it's covered by colSpan
                            }
                            periodIndex++;
                        }


                        return (
                            <TableRow key={day}>
                                <TableCell className="font-medium text-muted-foreground align-top pt-3">
                                    <div className="font-bold">{day}</div>
                                </TableCell>
                                {rowCells}
                            </TableRow>
                        );
                    })}
                    </TableBody>
                </Table>
                </div>
            </div>
        ))}
    </div>
  );
}
