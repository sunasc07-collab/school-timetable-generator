
"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTimetable } from "@/context/timetable-provider";
import { Download, Printer, View, Plus, Trash2, Edit, Zap, Settings } from "lucide-react";
import "jspdf-autotable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "./ui/input";
import { useState, useMemo } from "react";
import type { ViewMode, TimetableSession, Teacher, Timetable } from "@/lib/types";
import SystemSettings from "./system-settings";
import { to12Hour } from "@/lib/utils";

type DialogState = 'add' | 'rename' | 'remove' | 'regenerate' | null;

export default function Header() {
  const { 
    activeTimetable, 
    allTeachers,
    timetables, 
    setActiveTimetableId,
    addTimetable,
    removeTimetable,
    renameTimetable,
    viewMode, 
    setViewMode,
    generateTimetable
  } = useTimetable();
  
  const [dialogOpen, setDialogOpen] = useState<DialogState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timetableName, setTimetableName] = useState("");
  const [timetableToEdit, setTimetableToEdit] = useState<string | null>(null);

  const currentTeachers = useMemo(() => {
    if (!activeTimetable) return [];
    return allTeachers.filter(t => t.assignments.some(a => a.schoolId === activeTimetable.id));
  }, [activeTimetable, allTeachers]);
  
  const handlePrint = () => {
    window.print();
  };

  const openDialog = (type: DialogState, timetableId: string | null = null, currentName: string = "") => {
    setDialogOpen(type);
    setTimetableToEdit(timetableId);
    setTimetableName(currentName);
  };
  
  const closeDialog = () => {
    setDialogOpen(null);
    setTimetableToEdit(null);
    setTimetableName("");
  };

  const handleAddNewTimetable = () => {
    if (timetableName.trim()) {
      addTimetable(timetableName.trim());
      closeDialog();
    }
  }

  const handleRenameTimetable = () => {
    if (timetableName.trim() && timetableToEdit) {
      renameTimetable(timetableToEdit, timetableName.trim());
      closeDialog();
    }
  }
  
  const handleRemoveTimetable = () => {
    if (timetableToEdit) {
        removeTimetable(timetableToEdit);
        closeDialog();
    }
  };
  
  const handleGenerateClick = () => {
    const hasAnyTimetableData = timetables.some(t => Object.keys(t.timetable).length > 0);
    if (hasAnyTimetableData) {
      openDialog('regenerate');
    } else {
      generateTimetable();
    }
  };

  const handleConfirmRegenerate = () => {
    generateTimetable();
    closeDialog();
  };

  const generatePdf = async (type: 'class' | 'teacher') => {
    if (!activeTimetable && type === 'class') return;

    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF({ orientation: "landscape", unit: 'pt', format: 'a4' });
    let pageCounter = 0;

    const generatePage = (
        title: string, 
        filterValue: string, 
        viewType: 'class' | 'teacher',
        // For teacher view, these will be arrays of data from multiple schools
        timetablesForView: Timetable[],
        allTeacherSessions: TimetableSession[]
    ) => {
        if (pageCounter > 0) {
            doc.addPage();
        }
        pageCounter++;

        // For merged teacher view, use the first timetable as the structural template
        const templateTimetable = timetablesForView[0];
        if (!templateTimetable) return;
        
        const { timeSlots, days, name: timetableName } = templateTimetable;
        
        const FONT_FAMILY = "Helvetica";
        const DAY_HEADER_COLORS = [
            [255, 107, 107], [255, 184, 107], [255, 235, 107], [107, 222, 122], [107, 175, 255]
        ];
        const SUBJECT_COLORS = [
            [255, 204, 204], [255, 229, 204], [255, 245, 204], [204, 245, 209],
            [204, 224, 255], [229, 204, 255], [255, 204, 229], [224, 224, 224]
        ];
        const subjectColorMap = new Map<string, number[]>();
        let colorIndex = 0;

        const roundedRect = (x: number, y: number, w: number, h: number, r: number, style: 'F' | 'S' | 'FD') => {
            (doc as any).roundedRect(x, y, w, h, r, r, style);
        };

        const getSubjectColor = (subject: string) => {
            if (!subject) return [255, 255, 255];
            if (['Short Break', 'Lunch', 'Sports', 'Assembly', 'Club Activities', 'Guidance'].includes(subject)) return [220, 220, 220];
            if (!subjectColorMap.has(subject)) {
                subjectColorMap.set(subject, SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length]);
                colorIndex++;
            }
            return subjectColorMap.get(subject)!;
        };

        const getTeacherInitials = (teacherName: string) => {
            if (!teacherName) return '';
            return teacherName.split(' ').map(name => name[0]).join('').toUpperCase();
        };

        const formatClassName = (className: string) => {
            if (!className) return '';
            const gradeMatch = className.match(/Grade (\d+)/);
            const alevelMatch = className.match(/A-Level Year (\d+)/);
            
            let gradePart = '';
            if (gradeMatch) {
                gradePart = `G${gradeMatch[1]}`;
            } else if (alevelMatch) {
                gradePart = `A${alevelMatch[1]}`;
            } else {
                 gradePart = className.split(' ')[0] || '';
            }

            const armMatch = className.match(/(?:Grade \d+|A-Level Year \d+|[^\s]+)\s+(.+)/);
            let armPart = '';
            if (armMatch && armMatch[1]) {
                armPart = armMatch[1].charAt(0).toUpperCase();
            }

            return `${gradePart}${armPart}`;
        };
        
        const formatTimeForPdf = (timeStr: string) => {
            const { time, ampm } = to12Hour(timeStr);
            const [hours, minutes] = time.split(':');
            const h = parseInt(hours, 10);
            return `${h}:${minutes} ${ampm.toUpperCase()}`;
        };

        const PAGE_WIDTH = doc.internal.pageSize.getWidth();
        const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
        const MARGIN = 20;

        doc.setFillColor(83, 4, 133);
        doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

        doc.setFillColor(76, 175, 225);
        roundedRect(MARGIN, MARGIN, PAGE_WIDTH - (MARGIN * 2), 40, 10, 'F');
        doc.setFont(FONT_FAMILY, "bold");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text("SCHOOL TIMETABLE", PAGE_WIDTH / 2, MARGIN + 26, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text(title, MARGIN, MARGIN + 70);
        
        doc.setFontSize(12);
        doc.text(viewType === 'teacher' ? 'Consolidated Schedule' : timetableName, PAGE_WIDTH - MARGIN, MARGIN + 70, { align: 'right' });

        const gridX = MARGIN;
        const gridY = MARGIN + 85;
        const gridWidth = PAGE_WIDTH - (MARGIN * 2);
        const dayHeaderHeight = 25;
        const timeColWidth = 70;
        const dayColWidth = (gridWidth - timeColWidth) / days.length;
        
        const totalTeachingPeriods = timeSlots.filter(ts => !ts.isBreak).length;
        const totalBreaks = timeSlots.filter(ts => ts.isBreak).length;
        const availableGridHeight = PAGE_HEIGHT - gridY - MARGIN;
        const normalCellHeight = availableGridHeight / (totalTeachingPeriods + totalBreaks * 0.5);
        const breakCellHeight = normalCellHeight / 2;

        days.forEach((day, dayIndex) => {
            const dayX = gridX + timeColWidth + (dayIndex * dayColWidth);
            const [r, g, b] = DAY_HEADER_COLORS[dayIndex % DAY_HEADER_COLORS.length];
            doc.setFillColor(r, g, b);
            roundedRect(dayX, gridY, dayColWidth, dayHeaderHeight, 6, 'F');

            doc.setFontSize(14);
            doc.setFont(FONT_FAMILY, "bold");
            doc.setTextColor(255, 255, 255);
            doc.text(day.toUpperCase(), dayX + dayColWidth / 2, gridY + dayHeaderHeight / 2 + 5, { align: 'center' });
        });

        let currentY = gridY + dayHeaderHeight;
        
        timeSlots.forEach((slot) => {
            const rowHeight = slot.isBreak ? breakCellHeight : normalCellHeight;
            const [start, end] = slot.time.split('-');
            const formattedTime = `${formatTimeForPdf(start)} - ${formatTimeForPdf(end)}`;

            doc.setFontSize(9);
            doc.setFont(FONT_FAMILY, "bold");
            doc.setTextColor(255, 255, 255);
            doc.text(formattedTime, gridX + timeColWidth - 8, currentY + rowHeight / 2 + 3, { align: 'right', baseline: 'middle' });

            days.forEach((day, dayIndex) => {
                const cellX = gridX + timeColWidth + (dayIndex * dayColWidth);
                const isBreakOnThisDay = slot.isBreak && (slot.days || days).includes(day);

                if (isBreakOnThisDay) {
                     const label = slot.label || '';
                     doc.setFillColor(240, 240, 240);
                     roundedRect(cellX + 2, currentY + 2, dayColWidth - 4, rowHeight-4, 4, 'F');
                     doc.setFontSize(10);
                     doc.setFont(FONT_FAMILY, "bold");
                     doc.setTextColor(100, 100, 100);
                     doc.text(label.replace('-', ' '), cellX + dayColWidth / 2, currentY + rowHeight / 2 + 3, { align: 'center', baseline: 'middle' });
                } else if (!slot.isBreak) {
                    
                    let relevantSessions: TimetableSession[] = [];
                    if (viewType === 'class') {
                        const allSessionsInSlot = templateTimetable.timetable[day]?.find(s => s[0]?.period === slot.period) || [];
                        relevantSessions = allSessionsInSlot.filter(s => s.classes.includes(filterValue));
                    } else { // teacher view
                        relevantSessions = allTeacherSessions.filter(s => s.day === day && s.period === slot.period);
                    }

                    if (relevantSessions.length > 0) {
                        const uniqueSessionBlocks = new Map<string, TimetableSession[]>();
                        
                        if (viewType === 'class') {
                            relevantSessions.forEach(session => {
                                const key = session.optionGroup ? session.id : `${session.id}-${session.className}-${session.subject}`;
                                if(!uniqueSessionBlocks.has(key)) uniqueSessionBlocks.set(key, []);
                                uniqueSessionBlocks.get(key)!.push(session);
                            });
                        }
                        
                        const sessionsToRender = (viewType === 'teacher') ? relevantSessions : Array.from(uniqueSessionBlocks.values()).flat();

                        if (sessionsToRender.length > 0) {
                             const sessionBlockCount = sessionsToRender.length;
                             const sessionHeight = (rowHeight - 4) / sessionBlockCount;
                             
                             sessionsToRender.forEach((session, sessionIndex) => {
                                 const sessionY = currentY + (sessionIndex * sessionHeight) + 2;
                                 const subject = session.isLocked ? session.subject : (session.optionGroup ? `Option ${session.optionGroup}` : (session.actualSubject || session.subject));
                                 const [r, g, b] = getSubjectColor(subject);
                                 doc.setFillColor(r, g, b);
                                 roundedRect(cellX + 2, sessionY, dayColWidth - 4, sessionHeight, 4, 'F');

                                 doc.setTextColor(50, 50, 50);
                                 
                                 if (session.isLocked) {
                                    doc.setFontSize(12);
                                    doc.setFont(FONT_FAMILY, "bold");
                                    doc.text(subject, cellX + dayColWidth / 2, sessionY + sessionHeight / 2 + 4, { align: 'center' });
                                 } else if (session.optionGroup) {
                                    doc.setFontSize(12);
                                    doc.setFont(FONT_FAMILY, "bold");
                                    doc.text(subject, cellX + dayColWidth / 2, sessionY + sessionHeight / 2 - 2, { align: 'center' });
                                    
                                    doc.setFontSize(9);
                                    doc.setFont(FONT_FAMILY, "bold");

                                    if(viewType === 'class'){
                                        const teacherText = `Teacher: ${getTeacherInitials(session.teacher)}`;
                                        doc.text(teacherText, cellX + dayColWidth / 2, sessionY + sessionHeight / 2 + 9, { align: 'center' });
                                    } else { // teacher view
                                        const schoolName = timetables.find(t=>t.id === session.schoolId)?.name || '';
                                        const grades = [...new Set([session.className].map(c => c.match(/^(Grade \d+|A-Level Year \d+)/)?.[0] || c))].join(', ');
                                        const classText = `Class: ${grades} (${schoolName})`;
                                        doc.text(classText, cellX + dayColWidth / 2, sessionY + sessionHeight / 2 + 9, { align: 'center' });
                                    }

                                 } else {
                                    doc.setFontSize(11);
                                    doc.setFont(FONT_FAMILY, "bold");
                                    doc.text(subject, cellX + dayColWidth / 2, sessionY + sessionHeight / 2 - 2, { align: 'center' });

                                    doc.setFontSize(9);
                                    doc.setFont(FONT_FAMILY, "bold");
                                    if(viewType === 'class'){
                                        const teacherText = `Teacher: ${getTeacherInitials(session.teacher)}`;
                                        doc.text(teacherText, cellX + dayColWidth / 2, sessionY + sessionHeight / 2 + 9, { align: 'center' });
                                    } else { // teacher view
                                        const schoolName = timetables.find(t=>t.id === session.schoolId)?.name || '';
                                        const classNames = formatClassName(session.className);
                                        const classText = `Class: ${classNames} (${schoolName})`;
                                        doc.text(classText, cellX + dayColWidth / 2, sessionY + sessionHeight / 2 + 9, { align: 'center' });
                                    }
                                 }
                             });
                        }

                    } else {
                        doc.setFillColor(255, 255, 255, 0.1);
                        roundedRect(cellX + 2, currentY + 2, dayColWidth - 4, rowHeight - 4, 4, 'F');
                    }
                } else {
                     doc.setFillColor(255, 255, 255, 0.1);
                     roundedRect(cellX + 2, currentY + 2, dayColWidth - 4, rowHeight - 4, 4, 'F');
                }
            });
            currentY += rowHeight;
        });
    }

    if (type === 'class' && activeTimetable) {
        if (activeTimetable.classes.length === 0) return;
        activeTimetable.classes.forEach(className => {
            const pageTitle = className.includes("Grade")
                ? `Class Timetable: ${className}`
                : `${className} Class Timetable`;
            generatePage(pageTitle, className, 'class', [activeTimetable], []);
        });
    } else if (type === 'teacher') {
        if (allTeachers.length === 0) return;
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
                                    allTeacherSessions.push({ ...session, day });
                                }
                            });
                        });
                    });
                });
                generatePage(`${teacher.name}'s Timetable`, teacher.id, 'teacher', timetablesForTeacher, allTeacherSessions);
            }
        });
    } else {
        return;
    }

    doc.save(`timetables.pdf`);
  };

  return (
    <>
      <AlertDialog open={dialogOpen === 'add'} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New School</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for the new school (e.g., "Primary School", "Secondary School").
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            placeholder="School name"
            value={timetableName}
            onChange={(e) => setTimetableName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNewTimetable()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddNewTimetable}>Add</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogOpen === 'rename'} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename School</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for the school.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            placeholder="New school name"
            value={timetableName}
            onChange={(e) => setTimetableName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameTimetable()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameTimetable}>Rename</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={dialogOpen === 'remove'} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the school and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveTimetable} variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={dialogOpen === 'regenerate'} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-generating the timetable will discard any manual changes you've made. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRegenerate}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {activeTimetable && <SystemSettings open={settingsOpen} onOpenChange={setSettingsOpen} />}

    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-bold tracking-tight font-headline">
          Timetable
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-48">
                    <span>{activeTimetable?.name || "Select School"}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Schools</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={activeTimetable?.id} onValueChange={(id) => id && setActiveTimetableId(id)}>
                    {timetables.map(t => (
                        <DropdownMenuRadioItem key={t.id} value={t.id} className="flex justify-between items-center pr-1" onSelect={(e) => e.preventDefault()}>
                           <span className="flex-1">{t.name}</span>
                            <div className="flex items-center flex-shrink-0">
                               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openDialog('rename', t.id, t.name); }}>
                                    <Edit className="h-3 w-3" />
                               </Button>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/80 hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDialog('remove', t.id); }} disabled={timetables.length <= 1}>
                                    <Trash2 className="h-3 w-3" />
                               </Button>
                           </div>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator/>
                <DropdownMenuItem onSelect={() => openDialog('add')}>
                    <Plus className="mr-2 h-4 w-4"/>
                    <span>Add New School</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={handleGenerateClick} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={allTeachers.length === 0}>
            <Zap className="mr-2 h-4 w-4" />
            Generate Timetable
        </Button>
        
        <Button onClick={() => setSettingsOpen(true)} variant="outline" size="icon" disabled={!activeTimetable}>
            <Settings className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <View className="mr-2 h-4 w-4" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Timetable View</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <DropdownMenuRadioItem value="class">By Class</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="teacher">By Teacher</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="arm">By Arm</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={handlePrint} variant="outline" disabled={timetables.every(t => Object.keys(t.timetable).length === 0)}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="bg-primary hover:bg-primary/90" disabled={timetables.every(t => Object.keys(t.timetable).length === 0)}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => generatePdf('class')} disabled={!activeTimetable || activeTimetable.classes.length === 0}>
              Class Timetables
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => generatePdf('teacher')} disabled={allTeachers.length === 0}>
              Teacher Timetables
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </>
  );
}

    

    