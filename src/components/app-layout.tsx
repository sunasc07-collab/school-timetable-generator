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
import { useMemo } from "react";
import type { Timetable, TimetableSession } from "@/lib/types";

export default function AppLayout() {
  const isMobile = useIsMobile();
  const { activeTimetable, allTeachers, viewMode, timetables, classes, arms } =
    useTimetable();

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
        const schoolsTaughtIds = [
          ...new Set(teacher.assignments.map((a) => a.schoolId)),
        ];
        const timetablesForTeacher = timetables.filter(
          (t) =>
            schoolsTaughtIds.includes(t.id) &&
            Object.keys(t.timetable).length > 0
        );

        if (timetablesForTeacher.length > 0) {
          const allTeacherSessions: TimetableSession[] = [];
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

          items.push({
            title: `${teacher.name}'s Timetable`,
            filterValue: teacher.id,
            templateTimetable: timetablesForTeacher[0],
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
    if (viewMode === "teacher") {
      return itemsToRender.map(({ title, filterValue, allTeacherSessions }) => ({
        title,
        filterValue,
        allTeacherSessions,
      }));
    }
    return itemsToRender.map(({ title, filterValue }) => ({
      title,
      filterValue,
    }));
  }, [itemsToRender, viewMode]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-primary"
            >
              <path d="M3 6h18" />
              <path d="M12 12h-9" />
              <path d="M12 18h-6" />
              <path d="M18 12h3" />
              <path d="M6 3v18" />
            </svg>
            <h2 className="text-lg font-semibold font-headline">Controls</h2>
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
