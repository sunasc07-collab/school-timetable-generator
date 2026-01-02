
"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import Header from "@/components/header";
import TeacherEditor from "@/components/teacher-editor";
import ClientOnly from "./client-only";
import TimetableGrid from "./timetable-grid";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileTimetableView from "./mobile-timetable-view";
import { useTimetable } from "@/context/timetable-provider";
import { useMemo, useState } from "react";
import type { Timetable, TimetableSession, TimeSlot } from "@/lib/types";
import { Button } from "./ui/button";
import { Plus, Settings, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import SystemSettings from "./system-settings";


export default function AppLayout() {
  const isMobile = useIsMobile();
  const { activeTimetable, allTeachers, viewMode, timetables, classes, arms, setIsTeacherEditorOpen, setEditingTeacher } =
    useTimetable();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const itemsToRender = useMemo(() => {
    let items: {
      title: string;
      filterValue: string;
      templateTimetable: Timetable;
      allTeacherSessions?: TimetableSession[];
    }[] = [];

    if (viewMode === "class" && activeTimetable) {
      items = classes.map((className) => ({
        title: `${className} Timetable`,
        filterValue: className,
        templateTimetable: activeTimetable,
      }));
    } else if (viewMode === "teacher") {
        allTeachers.forEach((teacher) => {
        const schoolsForTeacher = timetables.filter(t => teacher.assignments.some(a => a.schoolId === t.id));
        if (schoolsForTeacher.length === 0) return;

        const allTeacherSessions: TimetableSession[] = [];
        const timetablesForTeacher = schoolsForTeacher.filter(t => Object.keys(t.timetable).length > 0);

        timetablesForTeacher.forEach((tt) => {
          Object.entries(tt.timetable).forEach(([day, daySlots]) => {
            daySlots.forEach((slot) => {
              slot.forEach((session) => {
                if (session.teacherId === teacher.id) {
                  allTeacherSessions.push({ ...session, day: day });
                }
              });
            });
          });
        });
        
        if (allTeacherSessions.length === 0 && timetablesForTeacher.length === 0) return;

        // Consolidate time slots from all schools the teacher is assigned to
        const consolidatedTimeSlots = schoolsForTeacher.reduce((acc: TimeSlot[], school) => {
            school.timeSlots.forEach(ts => {
                if (!acc.some(ats => ats.time === ts.time)) {
                    acc.push(ts);
                }
            });
            return acc;
        }, []).sort((a, b) => {
            const timeA = a.time.split('-')[0];
            const timeB = b.time.split('-')[0];
            return timeA.localeCompare(timeB);
        });

        const consolidatedTimetable: Timetable = {
            id: `consolidated-${teacher.id}`,
            name: `${teacher.name}'s Consolidated Timetable`,
            days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            timeSlots: consolidatedTimeSlots,
            timetable: {},
            classes: [],
            conflicts: [],
            error: null,
            lockedSessions: [],
        };

        items.push({
            title: `${teacher.name}'s Timetable`,
            filterValue: teacher.id,
            templateTimetable: consolidatedTimetable,
            allTeacherSessions: allTeacherSessions,
        });
      });
    } else if (viewMode === "arm" && activeTimetable) {
      items = arms.map((armName) => ({
        title: `${armName} Timetable`,
        filterValue: armName,
        templateTimetable: activeTimetable,
      }));
    }
    return items;
  }, [viewMode, activeTimetable, classes, arms, allTeachers, timetables]);

  const mobileItemsToRender = useMemo(() => {
    if (viewMode === 'teacher') {
       return itemsToRender.map(({ title, filterValue, allTeacherSessions, templateTimetable }) => ({
        title,
        filterValue,
        allTeacherSessions,
        templateTimetable
      }));
    }
    return itemsToRender.map(({ title, filterValue, templateTimetable }) => ({
      title,
      filterValue,
      templateTimetable
    }));
  }, [itemsToRender, viewMode]);
  
  const handleAddTeacherClick = () => {
    setEditingTeacher(null);
    setIsTeacherEditorOpen(true);
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-headline">Teachers</h2>
            <ClientOnly>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleAddTeacherClick}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Teacher
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)} disabled={!activeTimetable}>
                  <Settings className="mr-2 h-4 w-4" />
                  System Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </ClientOnly>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <ClientOnly>
            <TeacherEditor />
          </ClientOnly>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <ClientOnly>
          <Header />
        </ClientOnly>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
           {activeTimetable && <SystemSettings open={settingsOpen} onOpenChange={setSettingsOpen} />}
          <ClientOnly>
            {isMobile ? (
              <MobileTimetableView itemsToRender={mobileItemsToRender} />
            ) : (
              <TimetableGrid itemsToRender={itemsToRender} />
            )}
          </ClientOnly>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
