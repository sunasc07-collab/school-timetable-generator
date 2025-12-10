
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
              if (assignment.grades.length === 0 || assignment.arms.length === 0) return;

              if (assignment.groupArms) {
                // Grouped Arms: Create one set of sessions for all grades and arms combined.
                assignment.grades.forEach(grade => {
                    const className = `${grade} ${assignment.arms.join(', ')}`;
                    for (let i = 0; i < assignment.periods; i++) {
                        allSessions.push({
                            id: crypto.randomUUID(),
                            subject: subject.name,
                            teacher: teacher.name,
                            className: className,
                            isDouble: false,
                        });
                    }
                });
              } else {
                 // Individual Arms: Create sessions for each grade and arm pair separately.
                  assignment.grades.forEach(grade => {
                      assignment.arms.forEach(arm => {
                          const className = `${grade} ${arm}`;
                          for (let i = 0; i < assignment.periods; i++) {
                              allSessions.push({
                                  id: crypto.randomUUID(),
                                  subject: subject.name,
                                  teacher: teacher.name,
                                  className: className,
                                  isDouble: false,
                              });
                          }
                      });
                  });
              }
            });
        });
    });

    // Shuffle and place sessions randomly
    allSessions.sort(() => Math.random() - 0.5);

    for (const session of allSessions) {
        let placed = false;
        // Try to place randomly multiple times
        for (let i = 0; i < DAYS.length * PERIOD_COUNT; i++) {
            const day = DAYS[Math.floor(Math.random() * DAYS.length)];
            const period = Math.floor(Math.random() * PERIOD_COUNT);

            if (!newTimetable[day][period]) {
                const teacherIsBusy = newTimetable[day].some(s => s?.teacher === session.teacher && s !== null);
                const classIsBusy = newTimetable[day].some(s => s?.className === session.className && s !== null);

                if (!teacherIsBusy && !classIsBusy) {
                     newTimetable[day][period] = session;
                     placed = true;
                     break;
                }
            }
        }
        if (!placed) {
            // Fallback: find the first available slot
            for (const day of DAYS) {
                for(let period = 0; period < PERIOD_COUNT; period++) {
                    if(!newTimetable[day][period]) {
                        const teacherIsBusy = newTimetable[day].some(s => s?.teacher === session.teacher && s !== null);
                        const classIsBusy = newTimetable[day].some(s => s?.className === session.className && s !== null);
                        if (!teacherIsBusy && !classIsBusy) {
                            newTimetable[day][period] = session;
                            placed = true;
                            break;
                        }
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

    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const currentSession = timetable[day]?.[period];
            if (!currentSession) continue;
            
            // Check for conflicts in the same time slot
            for (let p2 = period + 1; p2 < PERIOD_COUNT; p2++) {
                 const otherSession = timetable[day]?.[p2];
                 if (!otherSession) continue;
            }

            const sessionsInSlot = Object.values(timetable).map(d => d[period]).filter(Boolean);

            const teacherBookings = new Map<string, TimetableSession[]>();
            const classBookings = new Map<string, TimetableSession[]>();

            for (const s of sessionsInSlot) {
                if (s) {
                    // Teacher conflict
                    if (!teacherBookings.has(s.teacher)) teacherBookings.set(s.teacher, []);
                    teacherBookings.get(s.teacher)!.push(s);
                    
                    // Class conflict
                    if (!classBookings.has(s.className)) classBookings.set(s.className, []);
                    classBookings.get(s.className)!.push(s);
                }
            }

             teacherBookings.forEach((sessions, teacher) => {
                if (sessions.length > 1) {
                    sessions.forEach(s => identifiedConflicts.set(s.id, { id: s.id, type: 'teacher', message: `Teacher ${teacher} is double-booked.` }));
                }
            });

            classBookings.forEach((sessions, className) => {
                if (sessions.length > 1) {
                    sessions.forEach(s => identifiedConflicts.set(s.id, { id: s.id, type: 'class', message: `Class ${className} is double-booked.` }));
                }
            });
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
