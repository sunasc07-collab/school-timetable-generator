
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
import type { TimetableDragData, TimetableSession, Teacher } from "@/lib/types";
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
    allTeachers,
    moveSession, 
    isConflict, 
    viewMode, 
    clearTimetable, 
    resolveConflicts 
  } = useTimetable();

  const timetable = activeTimetable?.timetable || {};
  const days = activeTimetable?.days || [];
  const timeSlots = activeTimetable?.timeSlots || [];
  const classes = activeTimetable?.classes || [];
  const conflicts = activeTimetable?.conflicts || [];
  
  const teachers = useMemo(() => {
    if (!activeTimetable) return [];
    return allTeachers.filter(t => t.assignments.some(a => a.schoolId === activeTimetable.id));
  }, [activeTimetable, allTeachers]);

  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const isSecondarySchool = useMemo(() => activeTimetable?.name.toLowerCase().includes('secondary'), [activeTimetable]);

  const arms = useMemo(() => {
    if (!activeTimetable || viewMode !== 'arm') return [];

    const armSet = new Set<string>();
    
    teachers.forEach(teacher => {
        teacher.assignments.forEach(assignment => {
            if (assignment.schoolId !== activeTimetable.id || !assignment.arms || assignment.arms.length === 0) return;
            
            assignment.grades.forEach(grade => {
                assignment.arms.forEach(arm => {
                    const fullClassName = `${grade} ${arm}`;
                    armSet.add(fullClassName);
                });
            });
        });
    });

    const sortedArms = Array.from(armSet).sort();
    if (sortedArms.length > 0) return sortedArms;

    // Fallback for schools without defined arms but with classes.
    return classes.sort();
  }, [activeTimetable, viewMode, classes, teachers]);


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
  
  const handleClearClick = () => {
     if (!activeTimetable) return;
    setIsClearConfirmOpen(true);
  };

  const handleConfirmClear = () => {
    if (!activeTimetable) return;
    clearTimetable();
    setIsClearConfirmOpen(false);
  }


  const renderCellContent = (day: string, period: number, filterValue: string) => {
     const allSessionsInSlot = timetable[day]?.[period] || [];
     
     let relevantSessions: TimetableSession[] = [];
     if (viewMode === 'class' || viewMode === 'arm') {
        relevantSessions = allSessionsInSlot.filter(s => {
            return s.classes.includes(filterValue);
        });
    } else if (viewMode === 'teacher') {
        relevantSessions = allSessionsInSlot.filter(s => s.teacher === filterValue);
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
          <h3 className="text-lg font-semibold font-headline">No School Selected</h3>
          <p className="text-muted-foreground mt-2">
            Please select or create a school from the dropdown in the header to get started.
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
            Click the "Generate Timetable" button in the header to create a schedule.
          </p>
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
                <TableHead className="w-32 border-x-0"></TableHead>
                {timeSlots.map((slot, index) => {
                  if (slot.isBreak) {
                     return (
                      <TableHead key={index} className="w-10 p-0 font-headline text-center align-middle border-x-0">
                        <div className="text-xs font-normal h-full">{slot.time}</div>
                      </TableHead>
                    );
                  }
                  return (
                    <TableHead key={index} className={cn("font-headline text-center align-middle")}>
                        <div>Period {slot.period}</div>
                        <div className="text-xs font-normal">{slot.time}</div>
                    </TableHead>
                  );
                })}
            </TableRow>
            </TableHeader>
            <TableBody>
            {days.map((day) => {
                const rowCells = [];
                let periodIndex = 0;
                
                for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
                    const slot = timeSlots[slotIndex];

                    if (slot.isBreak) {
                        let breakText: React.ReactNode = null;
                        
                        if (slot.label === 'SHORT-BREAK') {
                            if (day === 'Tue') breakText = <span className="font-bold text-[22px]">BREAK</span>;
                            if (day === 'Wed') breakText = <span className="font-bold text-[22px]">SHORT</span>;
                        } else if (slot.label === 'LUNCH' && day === 'Wed') {
                            breakText = <span className="text-[35px] font-bold">LUNCH</span>;
                        }
                        
                        rowCells.push(
                            <TableCell key={slotIndex} className="p-0 relative border-x-0">
                                <div className={cn(
                                        "text-muted-foreground uppercase [writing-mode:vertical-lr] transform rotate-180 tracking-widest flex items-center justify-center gap-4 h-full",
                                        "absolute inset-0"
                                    )}>
                                    {breakText}
                                </div>
                           </TableCell>
                        );
                        continue;
                    }
                    
                    rowCells.push(
                        <TableCell
                            key={slotIndex}
                            className={cn("p-1 align-top", "hover:bg-muted/50 transition-colors")}
                            onDragOver={(e) => handleDragOver(e)}
                            onDrop={(e) => handleDrop(e, day, periodIndex)}
                        >
                            {renderCellContent(day, periodIndex, filterValue)}
                        </TableCell>
                    );

                    periodIndex++;
                }

                if (day === 'Fri' && isSecondarySchool) {
                    const sportCell = (
                        <TableCell colSpan={2} className="p-1 align-middle text-center">
                            <div className="flex items-center justify-center h-20 w-full text-center font-bold text-lg text-muted-foreground uppercase">
                                SPORT
                            </div>
                        </TableCell>
                    );
                    const regularCells = rowCells.slice(0, -2);
                    return (
                         <TableRow key={day}>
                            <TableCell className="font-medium text-muted-foreground align-top pt-3">{day}</TableCell>
                            <TableCell className="w-32 relative border-x-0">
                                {day === 'Wed' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[35px] font-bold text-muted-foreground/80 transform -rotate-90 uppercase">Assembly</span>
                                    </div>
                                )}
                            </TableCell>
                            {regularCells}
                            {sportCell}
                        </TableRow>
                    )

                }

                return (
                    <TableRow key={day}>
                        <TableCell className="font-medium text-muted-foreground align-top pt-3">{day}</TableCell>
                        <TableCell className="w-32 relative border-x-0">
                            {day === 'Wed' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[35px] font-bold text-muted-foreground/80 transform -rotate-90 uppercase">Assembly</span>
                                </div>
                            )}
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
                <Button onClick={handleClearClick} variant="destructive" disabled={Object.keys(timetable).length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Timetable
                </Button>
            </div>
        </div>
          {itemsToRender.map(({ title, filterValue }) => renderTimetableFor(title, filterValue))}
      </div>
    </ClientOnly>
  );
}
