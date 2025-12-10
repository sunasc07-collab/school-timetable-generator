
"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTimetable } from "@/context/timetable-provider";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function Header() {
  const { teachers, timetable, timeSlots, days } = useTimetable();
  
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("School Timetable", 14, 10);
    let startY = 20;

    teachers.forEach((teacher, teacherIndex) => {
      if (teacherIndex > 0) {
          startY = (doc as any).lastAutoTable.finalY + 15;
          if (startY > 180) { // Check if new page is needed
              doc.addPage();
              startY = 20;
          }
      }
      doc.text(teacher.name, 14, startY - 5);

      const head = [["Day", ...timeSlots.map(slot => slot.label || slot.time)]];

      const body: (string | null)[][] = [];
      const periodCount = timeSlots.filter(s => !s.isBreak).length;

      days.forEach(day => {
          const row: (string | null)[] = [day];
          const teacherSessionsForDay = (timetable[day] || []).map((session, period) => ({ session, period }))
            .filter(({session}) => session?.teacher === teacher.name);
          
          let periodSlots = new Array(periodCount).fill(null);
          teacherSessionsForDay.forEach(({ session, period }) => {
            if (session && period < periodCount) {
              periodSlots[period] = `${session.subject}\n${session.className}`;
            }
          });

          let sessionIndex = 0;
          timeSlots.forEach(slot => {
            if (slot.isBreak) {
              row.push(null);
            } else {
              row.push(periodSlots[sessionIndex] || "");
              sessionIndex++;
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

    doc.save("timetables.pdf");
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
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button onClick={handleDownloadPdf} variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={Object.keys(timetable).length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>
    </header>
  );
}
