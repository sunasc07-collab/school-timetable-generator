
"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTimetable } from "@/context/timetable-provider";
import { Download, Printer, View, Plus, Trash2, Edit } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "./ui/input";
import { useState } from "react";

export default function Header() {
  const { 
    activeTimetable, 
    timetables, 
    setActiveTimetableId,
    addTimetable,
    removeTimetable,
    renameTimetable,
    viewMode, 
    setViewMode 
  } = useTimetable();
  
  const [newTimetableName, setNewTimetableName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [timetableToEdit, setTimetableToEdit] = useState<string | null>(null);

  const currentTimetable = activeTimetable ? timetables.find(t => t.id === activeTimetable.id) : null;
  const classes = currentTimetable?.classes || [];
  const timetable = currentTimetable?.timetable || {};
  const timeSlots = currentTimetable?.timeSlots || [];
  const days = currentTimetable?.days || [];
  const teachers = currentTimetable?.teachers || [];
  
  const handlePrint = () => {
    window.print();
  };

  const handleAddNewTimetable = () => {
    if (newTimetableName.trim()) {
      addTimetable(newTimetableName.trim());
      setNewTimetableName("");
      setIsAddDialogOpen(false);
    }
  }

  const handleRenameTimetable = () => {
    if (renameName.trim() && timetableToEdit) {
      renameTimetable(timetableToEdit, renameName.trim());
      setRenameName("");
      setIsRenameDialogOpen(false);
      setTimetableToEdit(null);
    }
  }
  
  const handleRemoveTimetable = () => {
    if (timetableToEdit) {
        removeTimetable(timetableToEdit);
        setIsRemoveDialogOpen(false);
        setTimetableToEdit(null);
    }
  };


  const handleDownloadClassPdf = () => {
    if (!currentTimetable) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text(`School Timetable - ${currentTimetable.name} - By Class`, 14, 10);
    let startY = 20;

    classes.forEach((className, classIndex) => {
      if (classIndex > 0) {
          const lastTable = (doc as any).lastAutoTable;
          if (lastTable) {
            startY = lastTable.finalY + 15;
          }
          if (startY > 180) { // Check if new page is needed
              doc.addPage();
              startY = 20;
          }
      }
      doc.text(className, 14, startY - 5);

      const head = [["Day", ...timeSlots.map(slot => slot.label || slot.time)]];

      const body: (string | null)[][] = [];
      
      days.forEach(day => {
          const row: (string | null)[] = [day];
          let periodIndex = 0;
          
          timeSlots.forEach(slot => {
            if (slot.isBreak) {
              row.push(null);
            } else {
              const sessionsInSlot = timetable[day]?.[periodIndex] || [];
              const classSession = sessionsInSlot.find(s => s.className === className);
              if (classSession) {
                row.push(`${classSession.subject}\n${classSession.teacher}`);
              } else {
                row.push("");
              }
              periodIndex++;
            }
          });
          body.push(row);
      });
      
       const columnStyles: { [key: number]: any } = {};
       timeSlots.forEach((slot, index) => {
         if (slot.isBreak) {
           columnStyles[index + 1] = {
             fillColor: [230, 230, 230]
           };
         }
       });

      (doc as any).autoTable({
        head: head,
        body: body,
        startY: startY,
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: "middle",
          halign: "center",
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: columnStyles,
      });

    });

    doc.save(`${currentTimetable.name}-class-timetables.pdf`);
  };

  const handleDownloadTeacherPdf = () => {
    if (!currentTimetable) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text(`School Timetable - ${currentTimetable.name} - By Teacher`, 14, 10);
    let startY = 20;

    teachers.forEach((teacher, teacherIndex) => {
      if (teacherIndex > 0) {
           const lastTable = (doc as any).lastAutoTable;
          if (lastTable) {
            startY = lastTable.finalY + 15;
          }
          if (startY > 180) { // Check if new page is needed
              doc.addPage();
              startY = 20;
          }
      }
      doc.text(teacher.name, 14, startY - 5);

      const head = [["Day", ...timeSlots.map(slot => slot.label || slot.time)]];
      const body: (string | null)[][] = [];
      
      days.forEach(day => {
          const row: (string | null)[] = [day];
          let periodIndex = 0;
          
          timeSlots.forEach(slot => {
            if (slot.isBreak) {
              row.push(null);
            } else {
              const sessionsInSlot = timetable[day]?.[periodIndex] || [];
              const teacherSession = sessionsInSlot.find(s => s.teacher === teacher.name);
              if (teacherSession) {
                row.push(`${teacherSession.subject}\n${teacherSession.className}`);
              } else {
                row.push("");
              }
              periodIndex++;
            }
          });
          body.push(row);
      });
      
      const columnStyles: { [key: number]: any } = {};
      timeSlots.forEach((slot, index) => {
        if (slot.isBreak) {
          columnStyles[index + 1] = {
            fillColor: [230, 230, 230]
          };
        }
      });

      (doc as any).autoTable({
        head: head,
        body: body,
        startY: startY,
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: "middle",
          halign: "center",
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: columnStyles,
      });
    });

    doc.save(`${currentTimetable.name}-teacher-timetables.pdf`);
  };


  return (
    <>
      <AlertDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New School Section</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for the new timetable (e.g., "Primary", "Secondary").
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            placeholder="Timetable name"
            value={newTimetableName}
            onChange={(e) => setNewTimetableName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNewTimetable()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddNewTimetable}>Add</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Timetable</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for the timetable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            placeholder="New timetable name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameTimetable()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameTimetable}>Rename</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the timetable and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveTimetable} variant="destructive">
              Delete
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
                    <span>{activeTimetable?.name || "Select Timetable"}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>School Sections</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={activeTimetable?.id} onValueChange={(id) => id && setActiveTimetableId(id)}>
                    {timetables.map(t => (
                        <DropdownMenuRadioItem key={t.id} value={t.id} className="flex justify-between items-center pr-1">
                           <span>{t.name}</span>
                            <div className="flex items-center">
                               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setTimetableToEdit(t.id); setRenameName(t.name); setIsRenameDialogOpen(true); }}>
                                    <Edit className="h-3 w-3" />
                               </Button>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/80 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setTimetableToEdit(t.id); setIsRemoveDialogOpen(true);}} disabled={timetables.length <= 1}>
                                    <Trash2 className="h-3 w-3" />
                               </Button>
                           </div>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator/>
                <DropdownMenuItem onSelect={() => { setNewTimetableName(""); setIsAddDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4"/>
                    <span>Add New Section</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

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
            <DropdownMenuRadioGroup value={viewMode} onValueChange={(value) => setViewMode(value as 'class' | 'teacher')}>
              <DropdownMenuRadioItem value="class">By Class</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="teacher">By Teacher</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={handlePrint} variant="outline" disabled={!currentTimetable || Object.keys(timetable).length === 0}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!currentTimetable || Object.keys(timetable).length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadClassPdf}>
              Class Timetables
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadTeacherPdf}>
              Teacher Timetables
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </>
  );
}
