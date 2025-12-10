"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTimetable } from "@/context/timetable-provider";
import { Printer, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Header() {
  const { generateTimetable, teachers } = useTimetable();
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
        <Button onClick={handlePrint} variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
    </header>
  );
}
