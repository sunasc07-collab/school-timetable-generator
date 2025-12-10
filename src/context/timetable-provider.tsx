
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict, TimeSlot, SubjectAssignment } from "@/lib/types";

type TimetableContextType = {
  teachers: Teacher[];
  addTeacher: (name: string, subjects: Omit<Subject, "id">[]) => void;
  removeTeacher: (id: string) => void;
  updateTeacher: (id: string, name: string, subjects: Subject[]) => void;
  timetable: TimetableData;
  days: string[];
  timeSlots: TimeSlot[];
  generateTimetable: () => void;
  moveSession: (session: TimetableSession, from: { day: string, period: number }, to: { day: string, period: number }) => void;
  conflicts: Conflict[];
  isConflict: (sessionId: string) => boolean;
};

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

const defaultTeachers: Teacher[] = [];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const TIME_SLOTS: TimeSlot[] = [
  { period: 1, time: "8:00 - 8:40" },
  { period: 2, time: "8:40 - 9:20" },
  { period: 3, time: "9:20 - 10:00" },
  { period: null, time: "10:00 - 10:30", isBreak: true, label: "Short Break" },
  { period: 4, time: "10:30 - 11:10" },
  { period: 5, time: "11:10 - 11:50" },
  { period: 6, time: "11:50 - 12:30" },
  { period: null, time: "12:30 - 1:30", isBreak: true, label: "Lunch Break" },
  { period: 7, time: "1:30 - 2:10" },
  { period: 8, time: "2:10 - 2:50" },
  { period: 9, time: "2:50 - 3:30" },
];
const PERIOD_COUNT = TIME_SLOTS.filter(ts => !ts.isBreak).length;


export function TimetableProvider({ children }: { children: ReactNode }) {
  const [teachers, setTeachers] = useState<Teacher[]>(defaultTeachers);
  const [timetable, setTimetable] = useState<TimetableData>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const generateTimetable = useCallback(() => {
    const newTimetable: TimetableData = {};
    for (const day of DAYS) {
        newTimetable[day] = new Array(PERIOD_COUNT).fill(null);
    }

    const allSessions: TimetableSession[] = [];
    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                assignment.grades.forEach(grade => {
                    assignment.armGroups.forEach(armGroup => {
                        const className = `${grade} ${armGroup.arms.join(', ')}`;
                        for (let i = 0; i < armGroup.periods; i++) {
                            allSessions.push({
                                id: crypto.randomUUID(),
                                subject: subject.name,
                                teacher: teacher.name,
                                className: className,
                                isDouble: false, // Doubles not handled in this basic generation
                            });
                        }
                    });
                });
            });
        });
    });

    // Shuffle and place sessions randomly
    allSessions.sort(() => Math.random() - 0.5);

    for (const session of allSessions) {
        let placed = false;
        for (let i = 0; i < DAYS.length * PERIOD_COUNT; i++) {
            const day = DAYS[Math.floor(Math.random() * DAYS.length)];
            const period = Math.floor(Math.random() * PERIOD_COUNT);

            if (!newTimetable[day][period]) {
                // Simplistic check, real conflict check is more complex
                const teacherConflict = newTimetable[day].some(s => s?.teacher === session.teacher);
                const classConflict = newTimetable[day].some(s => s?.className === session.className);
                if (!teacherConflict && !classConflict) {
                     newTimetable[day][period] = session;
                     placed = true;
                     break;
                }
            }
        }
        if (!placed) {
            // Find any empty slot if random placement fails too many times
            for (const day of DAYS) {
                for(let period = 0; period < PERIOD_COUNT; period++) {
                    if(!newTimetable[day][period]) {
                        newTimetable[day][period] = session;
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
        }
    }

    setTimetable(newTimetable);
  }, [teachers]);

  useEffect(() => {
    // Auto-generate timetable when teachers change and there are teachers
    if (teachers.length > 0) {
      generateTimetable();
    } else {
      // Clear timetable if there are no teachers
      setTimetable({});
    }
  }, [teachers, generateTimetable]);


  const days = Object.keys(timetable).length > 0 ? DAYS : [];
  const timeSlots = Object.keys(timetable).length > 0 ? TIME_SLOTS : [];

  const addTeacher = (name: string, subjects: Omit<Subject, "id">[]) => {
    const newTeacher: Teacher = {
      id: crypto.randomUUID(),
      name,
      subjects: subjects.map(s => ({ 
          ...s, 
          id: s.id || crypto.randomUUID(),
          assignments: s.assignments.map(a => ({
            ...a,
            id: a.id || crypto.randomUUID(),
            armGroups: a.armGroups.map(ag => ({
                ...ag,
                id: ag.id || crypto.randomUUID()
            }))
          })),
      })),
    };
    setTeachers((prev) => [...prev, newTeacher]);
  };

  const removeTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((teacher) => teacher.id !== id));
  };
  
  const updateTeacher = (id: string, name: string, subjects: Subject[]) => {
    setTeachers(prev => prev.map(t => t.id === id ? { id, name, subjects } : t));
  };
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    setTimetable(prev => {
        const newTimetable = JSON.parse(JSON.stringify(prev));
        
        const sourceCell = newTimetable[from.day][from.period];
        const targetCell = newTimetable[to.day][to.period];

        if (sourceCell && sourceCell.id !== session.id) {
           let found = false;
            for(const day of DAYS) {
                for(let p = 0; p < PERIOD_COUNT; p++) {
                    if (newTimetable[day][p] && newTimetable[day][p].id === session.id) {
                        from.day = day;
                        from.period = p;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        newTimetable[from.day][from.period] = targetCell;
        newTimetable[to.day][to.period] = session;

        return newTimetable;
    });
  }

  useEffect(() => {
    if (Object.keys(timetable).length === 0) {
      setConflicts([]);
      return;
    }

    const identifiedConflicts = new Map<string, Conflict>();

    const teacherSlotUsage = new Map<string, TimetableSession>(); // key: `day-period` -> session for a teacher
    const classSlotUsage = new Map<string, TimetableSession>();   // key: `day-period` -> session for a class

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const session = timetable[day]?.[period];
            if (!session) continue;

            const teacherKey = `${day}-${period}-${session.teacher}`;
            if (teacherSlotUsage.has(teacherKey)) {
                const conflictingSession = teacherSlotUsage.get(teacherKey)!;
                identifiedConflicts.set(session.id, { id: session.id, type: 'teacher', message: `Teacher ${session.teacher} is double-booked.` });
                identifiedConflicts.set(conflictingSession.id, { id: conflictingSession.id, type: 'teacher', message: `Teacher ${conflictingSession.teacher} is double-booked.` });
            } else {
                teacherSlotUsage.set(teacherKey, session);
            }

            const classKey = `${day}-${period}-${session.className}`;
            if (classSlotUsage.has(classKey)) {
                const conflictingSession = classSlotUsage.get(classKey)!;
                identifiedConflicts.set(session.id, { id: session.id, type: 'class', message: `Class ${session.className} is double-booked.` });
                identifiedConflicts.set(conflictingSession.id, { id: conflictingSession.id, type: 'class', message: `Class ${conflictingSession.className} is double-booked.` });
            } else {
                classSlotUsage.set(classKey, session);
            }
        }
    }


    setConflicts(Array.from(identifiedConflicts.values()));

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
        updateTeacher,
        timetable,
        days,
        timeSlots,
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
