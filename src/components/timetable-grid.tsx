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
  const { timetable, days, timeSlots, moveSession, isConflict } = useTimetable();

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
  
  const renderCellContent = (session: TimetableSession | null, day: string, period: number) => {
     if (session) {
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
    <div className="rounded-lg border w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Time</TableHead>
            {days.map((day) => (
              <TableHead key={day} className="font-headline">{day}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {timeSlots.map((slot, index) => {
            if (slot.isBreak) {
              return (
                <TableRow key={`break-${index}`}>
                  <TableCell className="font-medium text-muted-foreground">
                    {slot.time}
                  </TableCell>
                  <TableCell
                    colSpan={days.length}
                    className="text-center font-semibold bg-muted/50 text-muted-foreground"
                  >
                    {slot.label}
                  </TableCell>
                </TableRow>
              );
            }
            // We need to map the slot index to the timetable data index, accounting for breaks
            const periodIndex = timeSlots.slice(0, index + 1).filter(s => !s.isBreak).length - 1;

            return (
              <TableRow key={slot.period}>
                <TableCell className="font-medium text-muted-foreground align-top pt-3">
                   <div className="font-bold">{slot.time}</div>
                   <div className="text-xs">Period {slot.period}</div>
                </TableCell>
                {days.map((day) => (
                  <TableCell
                    key={day}
                    className={cn("p-1 align-top", slot.isBreak ? "bg-muted/30" : "")}
                    onDragOver={(e) => !slot.isBreak && handleDragOver(e)}
                    onDrop={(e) => !slot.isBreak && handleDrop(e, day, periodIndex)}
                  >
                    {!slot.isBreak && renderCellContent(timetable[day]?.[periodIndex], day, periodIndex)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

    