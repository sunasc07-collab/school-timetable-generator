
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
        [255, 182, 193], // LightPink
        [255, 218, 185], // PeachPuff
        [221, 160, 221], // Plum
        [173, 216, 230], // LightBlue
        [144, 238, 144], // LightGreen
        [255, 255, 224], // LightYellow
        [240, 230, 140], // Khaki
        [250, 235, 215], // AntiqueWhite
        [176, 224, 230], // PowderBlue
        [255, 228, 225], // MistyRose
    ];
    let colorIndex = 0;

    const getSubjectColor = (subject: string) => {
        if (subject === 'SHORT-BREAK' || subject === 'LUNCH') return [220, 220, 220];
        if (!subjectColorMap.has(subject)) {
            subjectColorMap.set(subject, pastelColors[colorIndex % pastelColors.length]);
            colorIndex++;
        }
        return subjectColorMap.get(subject)!;
    };

    listToIterate.forEach((item, index) => {
        const itemName = type === 'class' ? item as string : (item as any).name;
        if (index > 0) {
            doc.addPage();
            startY = 20;
            doc.text(mainTitle, 14, 10);
        }
        const itemTitle = type === 'class' ? `${itemName}'s Class Timetable` : `${itemName}'s Timetable`;
        doc.text(itemTitle, 14, startY - 5);
        
        const head = [['Time', ...days]];
        const body: any[][] = [];

        let periodIndex = 0;
        timeSlots.forEach((slot) => {
            const rowData: any[] = [slot.time];
            
            if (slot.isBreak) {
                days.forEach((day, dayIndex) => {
                    const isCenterCell = Math.floor(days.length / 2) === dayIndex;
                    rowData.push({
                        content: isCenterCell ? slot.label : '',
                        styles: { fillColor: getSubjectColor(slot.label!) }
                    });
                });
            } else {
                days.forEach((day) => {
                    const sessionsInSlot = timetable[day]?.[periodIndex] || [];
                    let relevantSessions: TimetableSession[];
    
                    if (type === 'class') {
                        relevantSessions = sessionsInSlot.filter(s => s.classes.includes(itemName));
                    } else {
                        relevantSessions = sessionsInSlot.filter(s => s.teacher === itemName);
                    }
                    
                    if (relevantSessions.length > 0) {
                        const cellContent = relevantSessions.map(session => {
                            return type === 'class' 
                                ? `${session.subject}\n${session.teacher}` 
                                : `${session.subject}\n${session.className}`;
                        }).join('\n\n');
    
                        const mainSession = relevantSessions[0];
    
                        rowData.push({
                            content: cellContent,
                            styles: { fillColor: getSubjectColor(mainSession.subject) }
                        });
    
                    } else {
                        rowData.push('');
                    }
                });
                periodIndex++;
            }
            body.push(rowData);
        });


        autoTable(doc, {
            head: head,
            body: body,
            startY: startY,
            theme: "grid",
            styles: {
                fontSize: 8,
                cellPadding: 2,
                valign: "middle",
                halign: "center",
                lineWidth: 0.1,
                lineColor: [200, 200, 200],
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [50, 50, 50],
                fontStyle: "bold",
            },
            didDrawCell: (data) => {
                 if (data.section === 'body' && data.cell.raw && (data.cell.raw as any).styles && (data.cell.raw as any).styles.fillColor) {
                    doc.setFillColor(...((data.cell.raw as any).styles.fillColor as [number, number, number]));
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');

                    doc.setTextColor(0,0,0);
                    if(data.cell.raw.content) {
                       const textLines = doc.splitTextToSize(String(data.cell.raw.content), data.cell.width - 4);
                       doc.text(textLines, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
                            halign: 'center',
                            valign: 'middle'
                       });
                    }
                }
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

    