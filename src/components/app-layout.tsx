"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import Header from "@/components/header";
import TeacherEditor from "@/components/teacher-editor";
import ClientOnly from "./client-only";
import TimetableGrid from "./timetable-grid";
import LockedSessions from "./locked-sessions";

export default function AppLayout() {
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
            <SidebarSeparator />
            <LockedSessions />
          </ClientOnly>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <ClientOnly>
          <Header />
        </ClientOnly>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <ClientOnly>
            <TimetableGrid />
          </ClientOnly>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
