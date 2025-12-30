
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

    const doc = new jsPDF({ orientation: "landscape" });
    const mainTitle = type === 'class' ? `School Timetable - ${currentTimetable.name} - By Class` : `School Timetable - ${currentTimetable.name} - By Teacher`;
    let startY = 20;

    const listToIterate = type === 'class' ? classes : teachers;
    
    const subjectColorMap = new Map<string, number[]>();
    const pastelColors = [
        [255, 182, 193], [255, 218, 185], [221, 160, 221], [173, 216, 230],
        [144, 238, 144], [255, 255, 224], [240, 230, 140], [250, 235, 215],
        [176, 224, 230], [255, 228, 225],
    ];
    let colorIndex = 0;

    const getSubjectColor = (session: TimetableSession) => {
        const subject = session.actualSubject || session.subject;
        if (!subject) return [255, 255, 255];
        if (['SHORT-BREAK', 'LUNCH', 'Sports'].includes(subject)) return [220, 220, 220];
        if (session.optionGroup) return [255, 250, 205]; // LemonChiffon for option groups
        if (!subjectColorMap.has(subject)) {
            subjectColorMap.set(subject, pastelColors[colorIndex % pastelColors.length]);
            colorIndex++;
        }
        return subjectColorMap.get(subject)!;
    };
    
    const getTeacherInitials = (teacherName: string) => {
      if (!teacherName) return '';
      return teacherName.split(' ').map(name => name[0]).join('').toUpperCase();
    };

    const getSubjectInitials = (subject: string) => {
      if (!subject) return '';
      if (subject.toLowerCase().startsWith("option")) {
        return subject.replace("Option", "Opt");
      }
      if (subject.length > 3) {
        return subject.substring(0, 3);
      }
      return subject;
    };

    const formatClassName = (className: string) => {
        if (!className) return '';
        const gradeMatch = className.match(/Grade (\d+)/);
        const alevelMatch = className.match(/A-Level Year (\d+)/);
        const armMatch = className.match(/(?:Grade \d+|A-Level Year \d+)\s+(.+)/);

        let gradePart = '';
        if (gradeMatch) {
            gradePart = `G${gradeMatch[1]}`;
        } else if (alevelMatch) {
            gradePart = `A${alevelMatch[1]}`;
        }

        let armPart = '';
        if (armMatch && armMatch[1]) {
            armPart = armMatch[1].charAt(0).toUpperCase();
        }

        return `${gradePart}${armPart}`;
    };

    listToIterate.forEach((item, index) => {
        const itemName = type === 'class' ? item as string : (item as Teacher).name;
        if (index > 0) {
            doc.addPage();
            startY = 20;
        }
        doc.text(mainTitle, 14, 10);
        const itemTitle = type === 'class' ? `${itemName}'s Class Timetable` : `${itemName}'s Timetable`;
        doc.text(itemTitle, 14, startY - 5);

        const head = [['Time', ...days.map(d => d.toUpperCase())]];
        const body: any[][] = [];
        let periodIdxCounter = 0;

        timeSlots.forEach((slot) => {
            const rowData: any[] = [{ content: slot.time, styles: { valign: 'middle', halign: 'center' } }];
            
            if (slot.isBreak) {
                const breakCell = {
                    content: slot.label?.replace('-', ' '),
                    colSpan: days.length,
                    styles: { halign: 'center', valign: 'middle', fillColor: getSubjectColor({} as TimetableSession) }
                };
                rowData.push(breakCell);
            } else {
                days.forEach((day, dayIndex) => {
                    const allSessionsInSlot = timetable[day]?.[periodIdxCounter] || [];
                    let relevantSessions: TimetableSession[] = [];
                    
                    if (type === 'class') {
                        relevantSessions = allSessionsInSlot.filter(s => s.classes.includes(itemName));
                    } else if (type === 'teacher') {
                        relevantSessions = allSessionsInSlot.filter(s => s.teacher === itemName);
                    }

                    if (relevantSessions.length > 0) {
                        rowData.push(relevantSessions);
                    } else {
                        rowData.push('');
                    }
                });
                periodIdxCounter++;
            }
            body.push(rowData);
        });

        autoTable(doc, {
            head: head,
            body: body,
            startY: startY,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 1, valign: "middle", halign: "center", lineWidth: 0.1, lineColor: [200, 200, 200], minCellHeight: 15 },
            headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: "bold", halign: 'center' },
            didDrawCell: (data) => {
                if (data.section !== 'body' || !data.cell.raw || !Array.isArray(data.cell.raw)) return;
                
                const sessions = data.cell.raw as TimetableSession[];
                if (sessions.length === 0) return;
                
                const cellHeight = data.cell.height;
                const sessionHeight = cellHeight / sessions.length;

                sessions.forEach((session, i) => {
                    const sessionY = data.cell.y + (i * sessionHeight);
                    
                    doc.setFillColor(...(getSubjectColor(session) as [number, number, number]));
                    doc.rect(data.cell.x, sessionY, data.cell.width, sessionHeight, 'F');
                    doc.setTextColor(0, 0, 0);
                    doc.setFont(undefined, 'normal');

                    if (session.optionGroup) {
                        const subjectText = session.actualSubject || session.subject;
                        doc.setFontSize(8);
                        doc.setFont(undefined, 'bold');
                        doc.text(subjectText, data.cell.x + data.cell.width / 2, sessionY + 4, { halign: 'center' });

                        const optionGroupText = `Option ${session.optionGroup}`;
                        doc.setFontSize(15);
                        doc.setFont(undefined, 'bold');
                        doc.text(optionGroupText, data.cell.x + data.cell.width / 2, sessionY + 10, { halign: 'center' });

                        const className = session.classes[0] || '';
                        const formattedClass = formatClassName(className);
                        const teacherInitial = getTeacherInitials(session.teacher);
                        const details = `${formattedClass} - ${teacherInitial}`;

                        doc.setFontSize(8);
                        doc.setFont(undefined, 'normal');
                        doc.text(details, data.cell.x + data.cell.width / 2, sessionY + 14, { halign: 'center' });
                    } else {
                        const subjectText = getSubjectInitials(session.subject);
                        const details = type === 'class' ? getTeacherInitials(session.teacher) : formatClassName(session.className);

                        doc.setFontSize(8);
                        doc.setFont(undefined, 'bold');
                        doc.text(subjectText, data.cell.x + data.cell.width / 2, sessionY + sessionHeight / 2 - 2, { halign: 'center' });

                        doc.setFontSize(7);
                        doc.setFont(undefined, 'normal');
                        doc.text(details, data.cell.x + data.cell.width / 2, sessionY + sessionHeight / 2 + 3, { halign: 'center' });
                    }
                });
            },
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
