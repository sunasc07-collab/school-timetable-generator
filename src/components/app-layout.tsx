
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
import type { Timetable, TimetableSession } from "@/lib/types";
import { Button } from "./ui/button";
import { Plus, Settings, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import SystemSettings from "./system-settings";


export default function AppLayout() {
  const isMobile = useIsMobile();
  const { activeTimetable, allTeachers, viewMode, timetables, classes, arms, setIsTeacherEditorOpen } =
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
      const consolidatedTimetable: Timetable = {
        id: 'consolidated',
        name: 'Consolidated',
        days: DEFAULT_DAYS,
        timeSlots: DEFAULT_TIMESLOTS,
        timetable: {},
        classes: [],
        conflicts: [],
        error: null,
        lockedSessions: [],
      };

      allTeachers.forEach((teacher) => {
        const allTeacherSessions: TimetableSession[] = [];
        const timetablesForTeacher = timetables.filter(t => 
            teacher.assignments.some(a => a.schoolId === t.id) &&
            Object.keys(t.timetable).length > 0
        );

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

        if (allTeacherSessions.length > 0) {
          items.push({
            title: `${teacher.name}'s Timetable`,
            filterValue: teacher.id,
            templateTimetable: consolidatedTimetable,
            allTeacherSessions: allTeacherSessions,
          });
        }
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

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-headline">Teachers</h2>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setIsTeacherEditorOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Teacher
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)} disabled={!activeTimetable}>
                  <Settings className="mr-2 h-4 w-4" />
                  System Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_TIMESLOTS = [
    { period: 1, time: '08:00-08:40', id: '1' },
    { period: 2, time: '08:40-09:20', id: '2' },
    { period: 3, time: '09:20-10:00', id: '3' },
    { period: null, time: '10:00-10:20', isBreak: true, label: 'Short Break', id: 'b1', days: DEFAULT_DAYS },
    { period: 4, time: '10:20-11:00', id: '4' },
    { period: 5, time: '11:00-11:40', id: '5' },
    { period: 6, time: '11:40-12:20', id: '6' },
    { period: null, time: '12:20-13:00', isBreak: true, label: 'Lunch', id: 'b2', days: DEFAULT_DAYS },
    { period: 7, time: '13:00-13:40', id: '7' },
    { period: 8, time: '13:40-14:20', id: '8' },
    { period: 9, time: '14:20-15:00', id: '9' },
    { period: 10, time: '15:00-15:40', id: '10' },
    { period: 11, time: '15:40-16:20', id: '11' },
    { period: 12, time: '16:20-17:00', id: '12' },
];

