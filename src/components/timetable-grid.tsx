
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
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TimetableGrid() {
  const { timetable, days, timeSlots, moveSession, isConflict, teachers, classes, generateTimetable, viewMode } = useTimetable();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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
  
  const handleRegenerateClick = () => {
    setIsConfirmOpen(true);
  };
  
  const handleConfirmRegenerate = () => {
    generateTimetable();
    setIsConfirmOpen(false);
  };


  const renderCellContent = (sessions: TimetableSession[], day: string, period: number, filterValue: string) => {
     const relevantSessions = sessions.filter(s => viewMode === 'class' ? s.className === filterValue : s.teacher === filterValue);
     
     if (relevantSessions.length > 0) {
      return (
        <div className="space-y-1">
        {relevantSessions.map(session => (
            <TimetableItem
              key={session.id}
              session={session}
              isConflict={isConflict(session.id)}
              from={{ day, period }}
            />
        ))}
        </div>
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

  const renderTimetableFor = (title: string, filterValue: string) => (
    <div key={filterValue}>
        <h2 className="text-2xl font-bold font-headline mb-4">{title}</h2>
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
                    
                    const sessions = timetable[day]?.[periodIndex] || [];
                    
                    rowCells.push(
                        <TableCell
                            key={slotIndex}
                            className={cn("p-1 align-top", slot.isBreak ? "bg-muted/30" : "hover:bg-muted/50 transition-colors")}
                            onDragOver={(e) => !slot.isBreak && handleDragOver(e)}
                            onDrop={(e) => !slot.isBreak && handleDrop(e, day, periodIndex)}
                        >
                            {!slot.isBreak && renderCellContent(sessions, day, periodIndex, filterValue)}
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
  );
  
  const itemsToRender = viewMode === 'class' 
    ? classes.map(className => ({ title: `${className}'s Timetable`, filterValue: className }))
    : teachers.map(teacher => ({ title: `${teacher.name}'s Timetable`, filterValue: teacher.name }));

  return (
    <>
       <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-generating the timetable will discard any manual changes you've made. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRegenerate}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-8">
        <div className="flex justify-end items-center mb-4">
              <Button onClick={handleRegenerateClick} variant="outline">
                  <Zap className="mr-2 h-4 w-4" />
                  Re-generate Timetable
              </Button>
          </div>
          {itemsToRender.map(({ title, filterValue }) => renderTimetableFor(title, filterValue))}
      </div>
    </>
  );
}

    