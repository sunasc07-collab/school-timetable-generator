"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTimetable } from "@/context/timetable-provider";
import { Download, Printer, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function Header() {
  const { generateTimetable, teachers, timetable, timeSlots, days } = useTimetable();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateClick = async () => {
    if (teachers.length === 0) {
      toast({
        variant: "destructive",
        title: "No Teachers Added",
        description: "Please add at least one teacher before generating a timetable.",
      });
      return;
    }
    setIsGenerating(true);
    try {
      await generateTimetable();
      toast({
        title: "Success!",
        description: "A new timetable has been generated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("School Timetable", 14, 16);

    const head = [["Time", ...days]];
    const body: (string | null)[][] = [];

    timeSlots.forEach((slot) => {
      const row: (string | null)[] = [];
      if (slot.isBreak) {
        row.push(slot.time);
        row.push({
          content: slot.label || "Break",
          colSpan: days.length,
          styles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] },
        });
        // This is a bit of a hack to make the colSpan work with autotable
        for (let i = 1; i < days.length; i++) {
          row.push(null);
        }
      } else {
        row.push(`${slot.time}\nPeriod ${slot.period}`);
        const periodIndex = timeSlots.filter(s => !s.isBreak && s.period! <= slot.period!).length - 1;
        days.forEach(day => {
          const session = timetable[day]?.[periodIndex];
          if (session) {
            row.push(`${session.subject}\n(${session.teacher})`);
          } else {
            row.push("");
          }
        });
      }
      body.push(row.filter(c => c !== null));
    });

    (doc as any).autoTable({
      head: head,
      body: body,
      startY: 20,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: "middle",
        halign: "center",
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
    });

    doc.save("timetable.pdf");
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
        <Button
          onClick={handleGenerateClick}
          disabled={isGenerating || teachers.length === 0}
          variant="outline"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate Timetable"}
        </Button>
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

    