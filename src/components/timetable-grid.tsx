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
      if (session && session.teacher === teacherName) {
          return session;
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

  if (Object.keys(timetable).length === 0) {
    return (
      <div className="flex items-center justify-center h-full rounded-lg border-2 border-dashed border-border text-center p-12">
        <div>
          <h3 className="text-lg font-semibold font-headline">No Timetable Generated</h3>
          <p className="text-muted-foreground mt-2">
            Add some teachers and click 'Generate Timetable' to get started.
          </p>
        </div>
      </div>
    );
  }

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
                        return (
                        <TableRow key={day}>
                            <TableCell className="font-medium text-muted-foreground align-top pt-3">
                                <div className="font-bold">{day}</div>
                            </TableCell>
                            {timeSlots.map((slot, slotIndex) => {
                                if (slot.isBreak) {
                                    return <TableCell key={slotIndex} className="bg-muted/50" />
                                }
                                const periodIndex = timeSlots.slice(0, slotIndex + 1).filter(s => !s.isBreak).length - 1;
                                const session = getSessionForTeacher(teacher.name, day, periodIndex);

                                const isDoublePart1 = session?.isDouble && session.part === 1;

                                return (
                                <TableCell
                                    key={slotIndex}
                                    colSpan={isDoublePart1 ? 2 : 1}
                                    className={cn("p-1 align-top", slot.isBreak ? "bg-muted/30" : "")}
                                    onDragOver={(e) => !slot.isBreak && handleDragOver(e)}
                                    onDrop={(e) => !slot.isBreak && handleDrop(e, day, periodIndex)}
                                >
                                    {!slot.isBreak && renderCellContent(session, day, periodIndex)}
                                </TableCell>
                                );
                            }).filter((cell, i) => {
                                // Filter out the cell for the second part of a double period
                                if (!timeSlots[i].isBreak) {
                                    const periodIndex = timeSlots.slice(0, i + 1).filter(s => !s.isBreak).length - 1;
                                    if (periodIndex > 0) {
                                        const prevPeriodIndex = periodIndex - 1;
                                        const prevDay = days[days.indexOf(day)];
                                        const prevSession = getSessionForTeacher(teacher.name, prevDay, prevPeriodIndex);

                                        if (prevSession && prevSession.isDouble && prevSession.part === 1) {
                                            // check if it crosses a break
                                            const prevSlotIndex = timeSlots.findIndex(s => s.period === prevSession.periods);
                                            if (prevSlotIndex + 1 === i) {
                                                return false;
                                            }
                                        }
                                    }
                                }
                                return true;
                            })}
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
