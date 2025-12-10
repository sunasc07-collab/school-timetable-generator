"use server";

import { generateInitialTimetable } from "@/ai/flows/generate-initial-timetable";
import type { Teacher } from "@/lib/types";

export async function handleGenerateTimetable(teachers: Teacher[]) {
  if (!teachers || teachers.length === 0) {
    throw new Error("Teacher data is required to generate a timetable.");
  }

  const input = {
    teachers: teachers.map((teacher) => ({
      name: teacher.name,
      subjects: teacher.subjects.map((s) => s.name),
      periodsDesired: teacher.subjects.reduce((acc, s) => acc + s.periods, 0),
    })),
  };

  try {
    const result = await generateInitialTimetable(input);
    if (result && result.timetable) {
      return result.timetable;
    }
    throw new Error("Failed to generate timetable from AI response.");
  } catch (error) {
    console.error("Error generating timetable:", error);
    throw new Error("An error occurred while communicating with the AI service.");
  }
}
