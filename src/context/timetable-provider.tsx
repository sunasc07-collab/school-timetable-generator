
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
    setTeachers(currentTeachers => {
        const newTimetable: TimetableData = {};
        for (const day of DAYS) {
            newTimetable[day] = new Array(PERIOD_COUNT).fill(null);
        }

        const allSessions: TimetableSession[] = [];
        currentTeachers.forEach(teacher => {
            teacher.subjects.forEach(subject => {
                subject.assignments.forEach(assignment => {
                  if (assignment.grades.length === 0 || assignment.arms.length === 0) return;

                  if (assignment.groupArms) {
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
        
        allSessions.sort(() => Math.random() - 0.5);

        for (const session of allSessions) {
            let placed = false;
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
        
        setTimetable(newTimetable);

        // This is important to trigger re-render if teachers state is what generateTimetable depends on
        return currentTeachers; 
    });
  }, []); // No dependencies, it will get the current `teachers` from the `setTeachers` updater function.


  useEffect(() => {
    if (teachers.length > 0) {
      generateTimetable();
    } else {
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

    // This map will store teacher and class bookings for each slot.
    // Key: "day-period", Value: { teachers: Set<string>, classes: Set<string> }
    const slotBookings = new Map<string, { teachers: Set<string>; classes: Set<string> }>();

    for (const day of DAYS) {
      for (let period = 0; period < PERIOD_COUNT; period++) {
        const session = timetable[day]?.[period];
        if (!session) continue;
        
        const slotKey = `${day}-${period}`;
        if (!slotBookings.has(slotKey)) {
          slotBookings.set(slotKey, { teachers: new Set(), classes: new Set() });
        }
        
        const booking = slotBookings.get(slotKey)!;

        // Check for teacher conflict
        if (booking.teachers.has(session.teacher)) {
          // This teacher is already booked in this slot, find all sessions with this teacher in this slot and mark them
           for (const d of DAYS) {
                for (let p = 0; p < PERIOD_COUNT; p++) {
                    const conflictSession = timetable[d]?.[p];
                    if (conflictSession && d === day && p === period && conflictSession.teacher === session.teacher) {
                         identifiedConflicts.set(conflictSession.id, { id: conflictSession.id, type: 'teacher', message: `Teacher ${conflictSession.teacher} is double-booked.` });
                    }
                }
           }
        }
        booking.teachers.add(session.teacher);

        // Check for class conflict
        if (booking.classes.has(session.className)) {
          // This class is already booked in this slot
           for (const d of DAYS) {
                for (let p = 0; p < PERIOD_COUNT; p++) {
                    const conflictSession = timetable[d]?.[p];
                    if (conflictSession && d === day && p === period && conflictSession.className === session.className) {
                         identifiedConflicts.set(conflictSession.id, { id: conflictSession.id, type: 'class', message: `Class ${conflictSession.className} is double-booked.` });
                    }
                }
           }
        }
        booking.classes.add(session.className);
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
