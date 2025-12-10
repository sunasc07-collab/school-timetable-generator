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

export default function TimetableGrid() {
  const { timetable, days, periods, moveSession, isConflict } = useTimetable();

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
            <TableHead className="w-24">Period</TableHead>
            {days.map((day) => (
              <TableHead key={day} className="font-headline">{day}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {periods.map((period) => (
            <TableRow key={period}>
              <TableCell className="font-medium">Period {period}</TableCell>
              {days.map((day) => (
                <TableCell
                  key={day}
                  className="p-1 align-top"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day, period - 1)}
                >
                  {renderCellContent(timetable[day]?.[period - 1], day, period - 1)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
