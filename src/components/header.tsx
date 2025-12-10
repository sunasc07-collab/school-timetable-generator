
"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTimetable } from "@/context/timetable-provider";
import { Download, Printer, View } from "lucide-react";
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

export default function Header() {
  const { classes, timetable, timeSlots, days, teachers, viewMode, setViewMode } = useTimetable();
  
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadClassPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("School Timetable - By Class", 14, 10);
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

    doc.save("class-timetables.pdf");
  };

  const handleDownloadTeacherPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("School Timetable - By Teacher", 14, 10);
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

    doc.save("teacher-timetables.pdf");
  };


  return (
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

        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={Object.keys(timetable).length === 0}>
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
  );
}
