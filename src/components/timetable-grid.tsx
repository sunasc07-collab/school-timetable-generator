
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
import { Button } from "./ui/button";
import { Zap } from "lucide-react";

export default function TimetableGrid() {
  const { timetable, days, timeSlots, moveSession, isConflict, teachers, generateTimetable } = useTimetable();

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
  };

  const handleDrop = (
    e: React.DragEvent<HTMLTableCellElement>,
    day: string,
    period: number
  ) => {
    e.preventDefault();
    try {
        const data: TimetableDragData = JSON.parse(
          e.dataTransfer.getData("application/json")
        );
        moveSession(data.session, data.from, { day, period });
    } catch (error) {
        console.error("Failed to parse drag data:", error);
    }
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

  if (teachers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full rounded-lg border-2 border-dashed border-border text-center p-12">
        <div>
          <h3 className="text-lg font-semibold font-headline">No Teachers Added</h3>
          <p className="text-muted-foreground mt-2">
            Add some teachers and their subject assignments in the controls panel to get started.
          </p>
        </div>
      </div>
    );
  }

  if (Object.keys(timetable).length === 0) {
     return (
      <div className="flex items-center justify-center h-full rounded-lg border-2 border-dashed border-border text-center p-12">
        <div>
          <h3 className="text-lg font-semibold font-headline">Timetable not generated</h3>
          <p className="text-muted-foreground mt-2 mb-4">
            Click the button below to generate a timetable based on the current teacher and subject configuration.
          </p>
          <Button onClick={generateTimetable} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Zap className="mr-2 h-4 w-4" />
            Generate Timetable
          </Button>
        </div>
      </div>
    );
  }
  
  // This renders one global timetable
  return (
    <div className="space-y-8">
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold font-headline">Master Timetable</h2>
                <Button onClick={generateTimetable} variant="outline">
                    <Zap className="mr-2 h-4 w-4" />
                    Re-generate
                </Button>
            </div>
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
                        
                        rowCells.push(
                            <TableCell
                                key={slotIndex}
                                className={cn("p-1 align-top", slot.isBreak ? "bg-muted/30" : "hover:bg-muted/50 transition-colors")}
                                onDragOver={(e) => !slot.isBreak && handleDragOver(e)}
                                onDrop={(e) => !slot.isBreak && handleDrop(e, day, periodIndex)}
                            >
                                {!slot.isBreak && renderCellContent(session, day, periodIndex)}
                            </TableCell>
                        );

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
    </div>
  );
}
