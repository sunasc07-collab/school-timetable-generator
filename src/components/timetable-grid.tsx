
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
import type { TimetableDragData, TimetableSession, Teacher, Timetable } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { Button } from "./ui/button";
import { Trash2, ZapOff } from "lucide-react";
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
import ErrorDisplay from "./error-display";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileTimetableView from "./mobile-timetable-view";


export default function TimetableGrid() {
  const { 
    activeTimetable,
    allTeachers,
    moveSession, 
    viewMode, 
    clearTimetable, 
    resolveConflicts,
    timetables, 
  } = useTimetable();

  const isMobile = useIsMobile();

  const timetable = activeTimetable?.timetable || {};
  const days = activeTimetable?.days || [];
  const timeSlots = activeTimetable?.timeSlots || [];
  const classes = activeTimetable?.classes || [];
  const conflicts = activeTimetable?.conflicts || [];
  const error = activeTimetable?.error || null;
  
  const teachers = useMemo(() => {
    if (!activeTimetable) return [];
    return allTeachers.filter(t => t.assignments.some(a => a.schoolId === activeTimetable.id));
  }, [activeTimetable, allTeachers]);

  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const arms = useMemo(() => {
    if (!activeTimetable || viewMode !== 'arm') return [];

    const armSet = new Set<string>();
    
    allTeachers.forEach(teacher => {
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
  }, [activeTimetable, viewMode, classes, allTeachers]);


  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
  };

  const handleDrop = (
    e: React.DragEvent<HTMLTableCellElement>,
    day: string,
    period: number,
    timetableId: string
  ) => {
    e.preventDefault();
    if (!activeTimetable) return;
    try {
        const data: TimetableDragData = JSON.parse(
          e.dataTransfer.getData("application/json")
        );
        // We can only drag/drop within the same timetable
        if (timetableId === activeTimetable.id) {
          moveSession(data.session, data.from, { day, period });
        }
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


  const renderCellContent = (day: string, period: number, filterValue: string, allTeacherSessions: TimetableSession[] = []) => {
     let relevantSessions: TimetableSession[] = [];

     if (viewMode === 'teacher') {
        relevantSessions = allTeacherSessions.filter(s => s.day === day && s.period === period);
     } else {
        const allSessionsInSlot = activeTimetable?.timetable[day]?.find(slot => slot[0]?.period === period) || [];
        if (viewMode === 'class' || viewMode === 'arm') {
            relevantSessions = allSessionsInSlot.filter(s => {
                return s.classes.includes(filterValue);
            });
        }
     }
     
     if (relevantSessions.length > 0) {
      return (
        <div className="space-y-1">
        {relevantSessions.map(session => (
            <TimetableItem
              key={`${session.id}-${session.subject}-${session.teacher}-${session.className}-${session.part || ''}`}
              session={session}
              from={{ day, period }}
            />
        ))}
        </div>
      );
    }
    return null;
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
  
  if (allTeachers.length === 0) {
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

  if (Object.keys(timetable).length === 0 && viewMode !== 'teacher') {
     return (
        <div className="flex flex-col items-center justify-center h-full rounded-lg border-2 border-dashed border-border text-center p-12">
            {error ? (
                <ErrorDisplay message={error} />
            ) : (
                <div>
                    <h3 className="text-lg font-semibold font-headline">Timetable not generated</h3>
                    <p className="text-muted-foreground mt-2 mb-4">
                        Click the "Generate Timetable" button in the header to create a schedule.
                    </p>
                </div>
            )}
        </div>
    );
  }

  const renderTimetableFor = (title: string, filterValue: string, templateTimetable: Timetable, allTeacherSessions: TimetableSession[] = []) => (
    <div key={`${filterValue}-${templateTimetable.id}`}>
        <h2 className="text-2xl font-bold font-headline mb-2">{title}</h2>
        {viewMode === 'teacher' && <p className="text-muted-foreground mb-4">Consolidated Schedule</p>}
        <div className="rounded-lg border w-full">
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead className="w-28">Time</TableHead>
                {templateTimetable.days.map((day) => (
                  <TableHead key={day} className="font-headline text-center align-middle">
                    {day}
                  </TableHead>
                ))}
            </TableRow>
            </TableHeader>
            <TableBody>
             {templateTimetable.timeSlots.map((slot) => {
                const [start, end] = slot.time.split('-');
                const formattedTime = `${formatTime(start)} - ${formatTime(end)}`;

                return (
                    <TableRow key={slot.id} className="h-24">
                        <TableCell className="font-medium text-muted-foreground align-middle text-center p-1">
                            <div className="text-xs">{formattedTime}</div>
                            {!slot.isBreak && <div className="text-xs mt-1">Period {slot.period}</div>}
                        </TableCell>
                        {templateTimetable.days.map((day) => {
                            const isBreakOnThisDay = slot.isBreak && (slot.days || templateTimetable.days).includes(day);

                            if (isBreakOnThisDay) {
                                return (
                                    <TableCell key={`${slot.id}-${day}`} className="text-center p-0 bg-muted/50 align-middle">
                                        <span className="font-semibold text-muted-foreground tracking-widest uppercase text-xs">
                                            {slot.label}
                                        </span>
                                    </TableCell>
                                );
                            }

                            if (slot.period === null) return <TableCell key={`${slot.id}-${day}`} />;

                            return (
                                <TableCell
                                    key={`${slot.id}-${day}`}
                                    className="p-1 align-top hover:bg-muted/50 transition-colors min-h-[6rem]"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, day, slot.period as number, templateTimetable.id)}
                                >
                                    {renderCellContent(day, slot.period as number, filterValue, allTeacherSessions)}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                )
            })}
            </TableBody>
        </Table>
        </div>
    </div>
  );
  
  let itemsToRender: { 
      title: string; 
      filterValue: string; 
      templateTimetable: Timetable; 
      allTeacherSessions?: TimetableSession[];
  }[] = [];

  if (viewMode === 'class' && activeTimetable) {
    itemsToRender = classes.map(className => ({ title: `${className} Timetable`, filterValue: className, templateTimetable: activeTimetable }));
  } else if (viewMode === 'teacher') {
    allTeachers.forEach(teacher => {
        const schoolsTaughtIds = [...new Set(teacher.assignments.map(a => a.schoolId))];
        const timetablesForTeacher = timetables.filter(t => schoolsTaughtIds.includes(t.id) && Object.keys(t.timetable).length > 0);

        if (timetablesForTeacher.length > 0) {
            const allTeacherSessions: TimetableSession[] = [];
            timetablesForTeacher.forEach(tt => {
                Object.entries(tt.timetable).forEach(([day, daySlots]) => {
                    daySlots.forEach(slot => {
                        slot.forEach(session => {
                            if (session.teacherId === teacher.id) {
                                allTeacherSessions.push({ ...session, day: day }); // Add day to session for filtering
                            }
                        });
                    });
                });
            });

            itemsToRender.push({
                title: `${teacher.name}'s Timetable`,
                filterValue: teacher.id,
                templateTimetable: timetablesForTeacher[0], // Use first school's structure as template
                allTeacherSessions: allTeacherSessions
            });
        }
    });
  } else if (viewMode === 'arm' && activeTimetable) {
    itemsToRender = arms.map(armName => ({ title: `${armName} Timetable`, filterValue: armName, templateTimetable: activeTimetable }));
  }
  
  if (viewMode === 'teacher' && itemsToRender.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-lg border-2 border-dashed border-border text-center p-12">
        <h3 className="text-lg font-semibold font-headline">No Timetables Generated for Teachers</h3>
        <p className="text-muted-foreground mt-2 mb-4">
          Generate timetables for the schools to see the teacher schedules.
        </p>
      </div>
    );
  }
  
  const mobileItemsToRender = useMemo(() => {
    if (viewMode === 'teacher') {
      return itemsToRender.map(({ title, filterValue, allTeacherSessions }) => ({ title, filterValue, allTeacherSessions }));
    }
    return itemsToRender.map(({ title, filterValue }) => ({ title, filterValue }));
  }, [itemsToRender, viewMode]);


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
                      Review the highlighted slots. Resolving conflicts will clear the timetable.
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
          {isMobile ? (
              <MobileTimetableView itemsToRender={mobileItemsToRender} />
          ) : (
             itemsToRender.map(({ title, filterValue, templateTimetable, allTeacherSessions }) => renderTimetableFor(title, filterValue, templateTimetable, allTeacherSessions))
          )}
      </div>
    </ClientOnly>
  );
}
