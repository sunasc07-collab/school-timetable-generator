
"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTimetable } from "@/context/timetable-provider";
import { Download, Printer, View, Plus, Trash2, Edit, Zap } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import type { ViewMode, TimetableSession, Teacher } from "@/lib/types";

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
  const [timetableName, setTimetableName] = useState("");
  const [timetableToEdit, setTimetableToEdit] = useState<string | null>(null);

  const currentTimetable = activeTimetable;
  const classes = currentTimetable?.classes || [];
  const timetable = currentTimetable?.timetable || {};
  const timeSlots = currentTimetable?.timeSlots || [];
  const days = currentTimetable?.days || [];
  const teachers: Teacher[] = useMemo(() => {
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
    if (!activeTimetable) return;
    if (Object.keys(timetable).length > 0) {
      openDialog('regenerate');
    } else {
      generateTimetable();
    }
  };

  const handleConfirmRegenerate = () => {
    if (!activeTimetable) return;
    generateTimetable();
    closeDialog();
  };

  const generatePdf = (type: 'class' | 'teacher') => {
    if (!currentTimetable) return;
    
    const listToIterate = type === 'class' ? classes : teachers;
    if (listToIterate.length === 0) {
        console.warn(`No ${type}s to generate PDF for.`);
        // Optionally, show a toast or alert to the user
        return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: 'px' });

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
        doc.roundedRect(x, y, w, h, r, r, style);
    };

    const getSubjectColor = (subject: string) => {
        if (!subject) return [255, 255, 255];
        if (['SHORT-BREAK', 'LUNCH', 'Sports'].includes(subject)) return [220, 220, 220];
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

    listToIterate.forEach((item, index) => {
        const itemName = type === 'class' ? item as string : (item as Teacher).name;
        const itemId = type === 'class' ? '' : (item as Teacher).id;
        
        if (index > 0) {
            doc.addPage();
        }

        const PAGE_WIDTH = doc.internal.pageSize.getWidth();
        const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
        const MARGIN = 20;

        doc.setFillColor(83, 4, 133);
        doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

        doc.setFillColor(76, 175, 225);
        roundedRect(MARGIN, MARGIN, PAGE_WIDTH - (MARGIN * 2), 50, 5, 'F');
        doc.setFont(FONT_FAMILY, "bold");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("SCHOOL TIMETABLE", PAGE_WIDTH / 2, MARGIN + 25, { align: 'center' });
        doc.setFontSize(12);
        doc.text(currentTimetable.name, PAGE_WIDTH / 2, MARGIN + 40, { align: 'center' });

        const itemTitle = type === 'class' ? `${itemName}'s Class Timetable` : `${itemName}'s Timetable`;
        doc.setFontSize(18);
        doc.setFont(FONT_FAMILY, "bold");
        doc.text(itemTitle, MARGIN, MARGIN + 75);

        const gridX = MARGIN;
        const gridY = MARGIN + 90;
        const gridWidth = PAGE_WIDTH - (MARGIN * 2);
        const dayHeaderHeight = 30;
        const timeColWidth = 60;
        const dayColWidth = (gridWidth - timeColWidth) / days.length;
        
        const periodSlots = timeSlots.filter(slot => !slot.isBreak);
        const breakSlots = timeSlots.filter(slot => slot.isBreak);
        
        const availableGridHeight = PAGE_HEIGHT - gridY - MARGIN;
        const normalCellHeight = availableGridHeight / (periodSlots.length + breakSlots.length * 0.5);
        const breakCellHeight = normalCellHeight / 2;

        days.forEach((day, dayIndex) => {
            const dayX = gridX + timeColWidth + (dayIndex * dayColWidth);
            const [r, g, b] = DAY_HEADER_COLORS[dayIndex % DAY_HEADER_COLORS.length];
            doc.setFillColor(r, g, b);
            roundedRect(dayX, gridY, dayColWidth, dayHeaderHeight, 10, 'F');

            doc.setFontSize(12);
            doc.setFont(FONT_FAMILY, "bold");
            doc.setTextColor(255, 255, 255);
            doc.text(day.toUpperCase(), dayX + dayColWidth / 2, gridY + dayHeaderHeight / 2 + 4, { align: 'center' });
        });

        let currentY = gridY + dayHeaderHeight;
        let periodIdxCounter = 0;

        timeSlots.forEach((slot) => {
            const rowHeight = slot.isBreak ? breakCellHeight : normalCellHeight;

            if (slot.isBreak) {
                doc.setFillColor(240, 240, 240);
                roundedRect(gridX, currentY, gridWidth, rowHeight, 5, 'F');
                doc.setFontSize(16);
                doc.setFont(FONT_FAMILY, "bold");
                doc.setTextColor(100, 100, 100);
                doc.text(slot.label?.replace('-', ' ') || '', PAGE_WIDTH / 2, currentY + rowHeight / 2 + 5, { align: 'center' });
            } else {
                doc.setFontSize(10);
                doc.setFont(FONT_FAMILY, "bold");
                doc.setTextColor(255, 255, 255);
                doc.text(slot.time, gridX + timeColWidth - 5, currentY + rowHeight / 2 + 4, { align: 'right' });

                days.forEach((day, dayIndex) => {
                    const cellX = gridX + timeColWidth + (dayIndex * dayColWidth);
                    const allSessionsInSlot = timetable[day]?.[periodIdxCounter] || [];
                    
                    let relevantSessions: TimetableSession[] = [];
                    if (type === 'class') {
                        relevantSessions = allSessionsInSlot.filter(s => s.classes.includes(itemName));
                    } else { // type === 'teacher'
                        relevantSessions = allSessionsInSlot.filter(s => s.teacherId === itemId);
                    }

                    if (relevantSessions.length > 0) {
                        const uniqueSessionBlocks = new Map<string, TimetableSession[]>();
                        relevantSessions.forEach(session => {
                            const key = session.optionGroup ? session.id : `${session.className}-${session.subject}`;
                            if(!uniqueSessionBlocks.has(key)) uniqueSessionBlocks.set(key, []);
                            uniqueSessionBlocks.get(key)!.push(session);
                        });

                        const sessionBlockCount = uniqueSessionBlocks.size;
                        const sessionHeight = (rowHeight - 4) / sessionBlockCount;
                        
                        let sessionIndex = 0;
                        uniqueSessionBlocks.forEach((sessionsInBlock) => {
                             const sessionY = currentY + (sessionIndex * sessionHeight) + 2;
                             const firstSession = sessionsInBlock[0];
                             const subject = firstSession.optionGroup ? `Option ${firstSession.optionGroup}` : (firstSession.actualSubject || firstSession.subject);
                             const [r, g, b] = getSubjectColor(subject);
                             doc.setFillColor(r, g, b);
                             roundedRect(cellX + 2, sessionY, dayColWidth - 4, sessionHeight, 8, 'F');

                             doc.setTextColor(50, 50, 50);
                             doc.setFont(FONT_FAMILY, "bold");
                             
                             if (firstSession.optionGroup) {
                                doc.setFontSize(15);
                                doc.text(`Option ${firstSession.optionGroup}`, cellX + dayColWidth / 2, sessionY + 12, { align: 'center' });
                                
                                doc.setFontSize(9);
                                if (type === 'class') {
                                    const teacherText = `Teacher: ${getTeacherInitials(firstSession.teacher)}`;
                                    doc.text(teacherText, cellX + dayColWidth / 2, sessionY + 22, { align: 'center' });
                                } else {
                                     const classNames = [...new Set(sessionsInBlock.map(s => s.classes.map(formatClassName)).flat())].join(', ');
                                     const classText = `Class: ${classNames}`;
                                     doc.text(classText, cellX + dayColWidth / 2, sessionY + 22, { align: 'center' });
                                }

                             } else {
                                doc.setFontSize(10);
                                doc.text(subject, cellX + dayColWidth / 2, sessionY + 12, { align: 'center' });

                                doc.setFontSize(9);
                                if(type === 'class'){
                                    const teacherText = `Teacher: ${getTeacherInitials(firstSession.teacher)}`;
                                    doc.text(teacherText, cellX + dayColWidth / 2, sessionY + 22, { align: 'center' });
                                } else { // teacher view
                                    const classNames = [...new Set(sessionsInBlock.flatMap(s => s.classes.map(formatClassName)))].join(', ');
                                    const classText = `Class: ${classNames}`;
                                    doc.text(classText, cellX + dayColWidth / 2, sessionY + 22, { align: 'center' });
                                }
                             }
                             sessionIndex++;
                        });

                    } else {
                        doc.setFillColor(255, 255, 255, 0.1);
                        roundedRect(cellX + 2, currentY + 2, dayColWidth - 4, rowHeight - 4, 8, 'F');
                    }
                });

                periodIdxCounter++;
            }
            currentY += rowHeight;
        });
    });

    doc.save(`${currentTimetable.name}-${type}-timetables.pdf`);
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

    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-bold tracking-tight font-headline">
          Timetable Weaver
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

        <Button onClick={handleGenerateClick} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!activeTimetable || teachers.length === 0}>
            <Zap className="mr-2 h-4 w-4" />
            Generate Timetable
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

        <Button onClick={handlePrint} variant="outline" disabled={!currentTimetable || Object.keys(timetable).length === 0}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="bg-primary hover:bg-primary/90" disabled={!currentTimetable || Object.keys(timetable).length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => generatePdf('class')}>
              Class Timetables
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => generatePdf('teacher')}>
              Teacher Timetables
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </>
  );
}

    