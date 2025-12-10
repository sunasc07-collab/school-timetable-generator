"use client";

import AppLayout from "./app-layout";
import { TimetableProvider } from "@/context/timetable-provider";

export default function TimetableApp() {
  return (
    <TimetableProvider>
      <AppLayout />
    </TimetableProvider>
  );
}
