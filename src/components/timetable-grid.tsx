
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
import { Trash2, Zap, ZapOff } from "lucide-react";
import { useState, useMemo } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal } from "lucide-react";
import ClientOnly from "./client-only";

export default function TimetableGrid() {
  const { 
    activeTimetable,
    moveSession, 
    isConflict, 
    generateTimetable, 
    viewMode, 
    clearTimetable, 
    resolveConflicts 
  } = useTimetable();

  const timetable = activeTimetable?.timetable || {};
  const days = activeTimetable?.days || [];
  const timeSlots = activeTimetable?.timeSlots || [];
  const teachers = activeTimetable?.teachers || [];
  const classes = activeTimetable?.classes || [];
  const conflicts = activeTimetable?.conflicts || [];
  
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const arms = useMemo(() => {
    if (!activeTimetable) return [];
    const armSet = new Set<string>();
    
    activeTimetable.teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                if (!assignment.groupArms) {
                    assignment.grades.forEach(grade => {
                        assignment.arms.forEach(arm => {
                            armSet.add(`${grade} ${arm}`);
                        });
                    });
                }
            });
        });
    });
    return Array.from(armSet).sort();
  }, [activeTimetable]);


  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
  };

  const handleDrop = (
    e: React.DragEvent<HTMLTableCellElement>,
    day: string,
    period: number
  ) => {
    e.preventDefault();
    if (!activeTimetable) return;
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
    if (!activeTimetable) return;
    if (Object.keys(timetable).length > 0) {
      setIsRegenerateConfirmOpen(true);
    } else {
      generateTimetable();
    }
  };
  
  const handleConfirmRegenerate = () => {
    if (!activeTimetable) return;
    generateTimetable();
    setIsRegenerateConfirmOpen(false);
  };

  const handleClearClick = () => {
     if (!activeTimetable) return;
    setIsClearConfirmOpen(true);
  };

  const handleConfirmClear = () => {
    if (!activeTimetable) return;
    clearTimetable();
    setIsClearConfirmOpen(false);
  }


  const renderCellContent = (sessions: TimetableSession[], day: string, period: number, filterValue: string) => {
     let relevantSessions: TimetableSession[] = [];
     if (viewMode === 'class') {
         relevantSessions = sessions.filter(s => s.className === filterValue);
     } else if (viewMode === 'teacher') {
         relevantSessions = sessions.filter(s => s.teacher === filterValue);
     } else if (viewMode === 'arm') {
         relevantSessions = sessions.filter(s => s.className.includes(filterValue));
     }
     
     if (relevantSessions.length > 0) {
      return (
        <div className="space-y-1">
        {relevantSessions.map(session => (
            <TimetableItem
              key={`${session.id}-${session.part || ''}`}
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

  if (!activeTimetable) {
    return (
      <div className="flex items-center justify-center h-full rounded-lg border-2 border-dashed border-border text-center p-12">
        <div>
          <h3 className="text-lg font-semibold font-headline">No Timetable Selected</h3>
          <p className="text-muted-foreground mt-2">
            Please select or create a school section from the dropdown in the header to get started.
          </p>
        </div>
      </div>
    );
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
          <Button onClick={handleRegenerateClick} className="bg-accent hover:bg-accent/90 text-accent-foreground">
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
                <TableHead key={index} className={cn("font-headline text-center align-middle", slot.isBreak && "w-10 p-0")}>
                    {slot.isBreak ? (
                        <div className="relative h-full flex items-center justify-center">
                            <span className="absolute inset-0 bg-background z-10"></span>
                             <span className="relative z-20 font-medium text-muted-foreground uppercase text-center [writing-mode:vertical-lr] transform rotate-180">
                                {slot.label}
                            </span>
                        </div>
                    ) : (
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
            {days.map((day, dayIndex) => {
                const rowCells = [];
                let periodIndex = 0;
                for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
                    const slot = timeSlots[slotIndex];

                    if (slot.isBreak) {
                        if (slot.label?.toUpperCase() === 'ASSEMBLY') {
                            if (dayIndex === 0) { // Only render for the first day (Monday)
                                rowCells.push(
                                    <TableCell 
                                        key={`break-${slotIndex}`} 
                                        className="p-0" 
                                        rowSpan={days.length}
                                    >
                                        <div className="relative h-full w-full flex items-center justify-center bg-background">
                                          <span className="font-medium text-muted-foreground uppercase [writing-mode:vertical-lr] transform rotate-180">
                                              {slot.label}
                                          </span>
                                        </div>
                                    </TableCell>
                                );
                            }
                        } else {
                            rowCells.push(
                              <TableCell key={`break-${slotIndex}`} className="p-0">
                                <div className="relative h-full w-full flex items-center justify-center bg-background">
                                  <span className="font-medium text-muted-foreground uppercase [writing-mode:vertical-lr] transform rotate-180">
                                    {slot.label}
                                  </span>
                                </div>
                              </TableCell>
                            );
                        }
                        continue;
                    }
                    
                    const sessions = timetable[day]?.[periodIndex] || [];
                    
                    rowCells.push(
                        <TableCell
                            key={slotIndex}
                            className={cn("p-1 align-top", "hover:bg-muted/50 transition-colors")}
                            onDragOver={(e) => !slot.isBreak && handleDragOver(e)}
                            onDrop={(e) => !slot.isBreak && handleDrop(e, day, periodIndex)}
                        >
                            {renderCellContent(sessions, day, periodIndex, filterValue)}
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
  
  let itemsToRender: { title: string, filterValue: string }[] = [];
  if (viewMode === 'class') {
    itemsToRender = classes.map(className => ({ title: `${className}'s Timetable`, filterValue: className }));
  } else if (viewMode === 'teacher') {
    itemsToRender = teachers.map(teacher => ({ title: `${teacher.name}'s Timetable`, filterValue: teacher.name }));
  } else if (viewMode === 'arm') {
    itemsToRender = arms.map(armName => ({ title: `${armName}'s Timetable`, filterValue: armName }));
  }

  return (
    <ClientOnly>
       <AlertDialog open={isRegenerateConfirmOpen} onOpenChange={setIsRegenerateConfirmOpen}>
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

      <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will clear the entire timetable and all manual changes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear} variant="destructive">
              Clear Timetable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-8">
        <div className="flex justify-between items-center mb-4 gap-2">
            <div>
              {conflicts.length > 0 && (
                 <Alert variant="destructive" className="max-w-md">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle> {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected!</AlertTitle>
                    <AlertDescription>
                      {conflicts[0].message} {conflicts.length > 1 ? ` (and ${conflicts.length - 1} more)`: ''} Review the highlighted slots or click "Resolve Conflicts".
                    </AlertDescription>
                  </Alert>
              )}
            </div>
            <div className="flex gap-2">
                {conflicts.length > 0 && (
                  <Button onClick={() => resolveConflicts()} variant="outline">
                    <ZapOff className="mr-2 h-4 w-4" />
                    Resolve Conflicts
                  </Button>
                )}
                <Button onClick={handleClearClick} variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Timetable
                </Button>
                <Button onClick={handleRegenerateClick} variant="outline">
                    <Zap className="mr-2 h-4 w-4" />
                    Re-generate Timetable
                </Button>
            </div>
        </div>
          {itemsToRender.map(({ title, filterValue }) => renderTimetableFor(title, filterValue))}
      </div>
    </ClientOnly>
  );
}
