"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict } from "@/lib/types";
import { handleGenerateTimetable } from "@/lib/actions";

type TimetableContextType = {
  teachers: Teacher[];
  addTeacher: (name: string, subjects: Omit<Subject, "id">[]) => void;
  removeTeacher: (id: string) => void;
  timetable: TimetableData;
  days: string[];
  periods: number[];
  generateTimetable: () => Promise<void>;
  moveSession: (session: TimetableSession, from: { day: string, period: number }, to: { day: string, period: number }) => void;
  conflicts: Conflict[];
  isConflict: (sessionId: string) => boolean;
};

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

const defaultTeachers: Teacher[] = [
    {
        id: "t1",
        name: "Mr. Smith",
        subjects: [
            { id: "s1-1", name: "Mathematics", periods: 5 },
            { id: "s1-2", name: "Physics", periods: 4 },
        ],
    },
    {
        id: "t2",
        name: "Ms. Jones",
        subjects: [
            { id: "s2-1", name: "English", periods: 5 },
            { id: "s2-2", name: "History", periods: 3 },
        ],
    },
    {
        id: "t3",
        name: "Dr. Brown",
        subjects: [
            { id: "s3-1", name: "Chemistry", periods: 4 },
            { id: "s3-2", name: "Biology", periods: 4 },
        ],
    },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIOD_COUNT = 8;

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>(defaultTeachers);
  const [timetable, setTimetable] = useState<TimetableData>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const days = Object.keys(timetable).length > 0 ? DAYS : [];
  const periods = Object.keys(timetable).length > 0 ? Array.from({ length: PERIOD_COUNT }, (_, i) => i + 1) : [];

  const addTeacher = (name: string, subjects: Omit<Subject, "id">[]) => {
    const newTeacher: Teacher = {
      id: crypto.randomUUID(),
      name,
      subjects: subjects.map(s => ({ ...s, id: crypto.randomUUID() })),
    };
    setTeachers((prev) => [...prev, newTeacher]);
  };

  const removeTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((teacher) => teacher.id !== id));
  };
  
  const parseAndSetTimetable = (jsonString: string) => {
    try {
        const parsed = JSON.parse(jsonString);
        // AI might return various structures, we normalize it.
        const normalizedTimetable: TimetableData = {};
        
        for (const day of DAYS) {
            normalizedTimetable[day] = new Array(PERIOD_COUNT).fill(null);
            
            // Heuristic check for different possible structures from AI
            const dayData = parsed[day] || parsed[day.toLowerCase()];

            if (Array.isArray(dayData)) {
                dayData.forEach((item: any, index: number) => {
                    if (index < PERIOD_COUNT && item.subject && item.teacher) {
                         normalizedTimetable[day][item.period - 1] = {
                            id: crypto.randomUUID(),
                            subject: item.subject,
                            teacher: item.teacher,
                         };
                    } else if (index < PERIOD_COUNT && item && typeof item === 'object') {
                        // If period is not specified, assume array index is period
                        const subject = item.subject || item.course;
                        const teacher = item.teacher || item.instructor;
                        if(subject && teacher) {
                            normalizedTimetable[day][index] = {
                                id: crypto.randomUUID(),
                                subject,
                                teacher,
                            };
                        }
                    }
                });
            }
        }
        setTimetable(normalizedTimetable);
    } catch (error) {
        console.error("Failed to parse timetable JSON:", error);
        throw new Error("Received an invalid timetable format from the AI.");
    }
  }

  const generateTimetable = async () => {
    const timetableJson = await handleGenerateTimetable(teachers);
    parseAndSetTimetable(timetableJson);
  };
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    setTimetable(prev => {
        const newTimetable = JSON.parse(JSON.stringify(prev));

        const targetSession = newTimetable[to.day][to.period];

        // Place dragged session in new slot
        newTimetable[to.day][to.period] = session;

        // If target slot was occupied, move its session to original slot, otherwise clear original slot
        newTimetable[from.day][from.period] = targetSession || null;

        return newTimetable;
    });
  }

  const findConflicts = () => {
    const newConflicts: Conflict[] = [];
    if (Object.keys(timetable).length === 0) {
      setConflicts([]);
      return;
    }

    for (const day of DAYS) {
      for (let period = 0; period < PERIOD_COUNT; period++) {
        const sessionsInSlot: { session: TimetableSession, day: string, period: number }[] = [];
        
        // This check is simple, a more complex one would check all day/periods
        for (const d of DAYS) {
            for(let p = 0; p < PERIOD_COUNT; p++){
                const session = timetable[d]?.[p];
                if(session && session.teacher) {
                    sessionsInSlot.push({session, day: d, period: p});
                }
            }
        }

        const teacherUsage: { [key: string]: string[] } = {};

        for(const {session, day, period} of sessionsInSlot) {
            const key = `${day}-${period}`;
            if (!teacherUsage[key]) {
                teacherUsage[key] = [];
            }
            teacherUsage[key].push(session.teacher);
        }

        for (const key in teacherUsage) {
          const teachersInSlot = teacherUsage[key];
          const teacherCounts = teachersInSlot.reduce((acc, teacher) => {
            acc[teacher] = (acc[teacher] || 0) + 1;
            return acc;
          }, {} as {[key: string]: number});

          for (const teacher in teacherCounts) {
            if (teacherCounts[teacher] > 1) {
              // Find all sessions with this conflicting teacher at this slot
              Object.values(timetable).flat().filter(s => s && s.teacher === teacher && timetable[key.split('-')[0]][parseInt(key.split('-')[1])] === s).forEach(conflictSession => {
                if(conflictSession) {
                    newConflicts.push({
                      id: conflictSession.id,
                      type: "teacher",
                      message: `Teacher ${teacher} is double-booked.`,
                    });
                }
              });
            }
          }
        }
      }
    }
    setConflicts(newConflicts);
  };
  
  useEffect(() => {
    findConflicts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable]);

  const isConflict = (sessionId: string) => {
    return conflicts.some(c => c.id === sessionId);
  }

  return (
    <TimetableContext.Provider
      value={{
        teachers,
        addTeacher,
        removeTeacher,
        timetable,
        days,
        periods,
        generateTimetable,
        moveSession,
        conflicts,
        isConflict,
      }}
    >
      {children}
    </TimetableContext.Provider>
  );
}

export const useTimetable = (): TimetableContextType => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error("useTimetable must be used within a TimetableProvider");
  }
  return context;
};
