
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
                          for (let j = 0; j < assignment.periods; j++) {
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

    // Shuffle sessions for random placement
    allSessions.sort(() => Math.random() - 0.5);

    for (const session of allSessions) {
        let placed = false;
        // Create a shuffled list of all available slots
        const availableSlots = [];
        for (const day of DAYS) {
            for (let period = 0; period < PERIOD_COUNT; period++) {
                availableSlots.push({ day, period });
            }
        }
        availableSlots.sort(() => Math.random() - 0.5);

        // Iterate through shuffled slots to find a valid placement
        for (const { day, period } of availableSlots) {
            if (!newTimetable[day][period]) { // Check if the slot is empty
                // Check for conflicts ONLY in the target period across all days for that teacher/class
                let teacherIsBusy = false;
                let classIsBusy = false;

                // A simpler check: is the teacher or class busy on this specific day and period?
                // The main conflict check is done by iterating through the timetable later.
                // For generation, we check the whole day's schedule for that teacher/class.
                 for (let p = 0; p < PERIOD_COUNT; p++) {
                    const scheduledSession = newTimetable[day][p];
                    if (scheduledSession) {
                        if (scheduledSession.teacher === session.teacher) {
                            teacherIsBusy = true;
                        }
                        if (scheduledSession.className === session.className) {
                            classIsBusy = true;
                        }
                    }
                 }
                 
                 // This simplified check is often too restrictive. 
                 // Let's check for direct conflicts in the same slot on other days, but the main problem is teacher/class busy for the whole day.
                 // Correct logic should be: Check if teacher or class is busy AT THAT SPECIFIC DAY AND PERIOD.
                 // The previous implementation was checking the entire day array which is wrong.
                 
                 const teacherConflict = Object.values(newTimetable).some(daySchedule => daySchedule[period]?.teacher === session.teacher);
                 const classConflict = Object.values(newTimetable).some(daySchedule => daySchedule[period]?.className === session.className);

                 // Let's try an even simpler approach that is more correct for basic generation.
                 // Is the teacher busy for that entire day? Is the class busy for that entire day?
                 const isTeacherBusyOnDay = newTimetable[day].some(s => s?.teacher === session.teacher);
                 const isClassBusyOnDay = newTimetable[day].some(s => s?.className === session.className);


                if (!isTeacherBusyOnDay && !isClassBusyOnDay) {
                     newTimetable[day][period] = session;
                     placed = true;
                     break; // Exit the slots loop once placed
                }
            }
        }
        
        if (!placed) {
            // Fallback: If the session couldn't be placed without a same-day conflict,
            // find the very first empty slot regardless of same-day conflicts.
            // Conflicts will be flagged later.
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
            
            // Check for teacher and class conflicts within the same slot across the whole timetable
            for (const otherDay of DAYS) {
                for (let otherPeriod = 0; otherPeriod < PERIOD_COUNT; otherPeriod++) {
                    // Skip self
                    if (day === otherDay && period === otherPeriod) continue;

                    const otherSession = timetable[otherDay]?.[otherPeriod];
                    if (!otherSession) continue;

                    // Check for conflicts in the same time slot (period) but on different days
                    if (period === otherPeriod) {
                         if (otherSession.teacher === currentSession.teacher) {
                            identifiedConflicts.set(currentSession.id, { id: currentSession.id, type: 'teacher', message: `Teacher ${currentSession.teacher} is double-booked in the same period on ${day} and ${otherDay}.` });
                            identifiedConflicts.set(otherSession.id, { id: otherSession.id, type: 'teacher', message: `Teacher ${otherSession.teacher} is double-booked in the same period on ${day} and ${otherDay}.` });
                         }
                         if (otherSession.className === currentSession.className) {
                            identifiedConflicts.set(currentSession.id, { id: currentSession.id, type: 'class', message: `Class ${currentSession.className} is double-booked in the same period on ${day} and ${otherDay}.` });
                             identifiedConflicts.set(otherSession.id, { id: otherSession.id, type: 'class', message: `Class ${otherSession.className} is double-booked in the same period on ${day} and ${otherDay}.` });
                         }
                    }
                }
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
