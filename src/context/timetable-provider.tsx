
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict, TimeSlot } from "@/lib/types";

type ViewMode = 'class' | 'teacher';

type TimetableContextType = {
  teachers: Teacher[];
  addTeacher: (name: string, subjects: Omit<Subject, "id">[]) => void;
  removeTeacher: (id: string) => void;
  updateTeacher: (id: string, name: string, subjects: Subject[]) => void;
  timetable: TimetableData;
  classes: string[];
  days: string[];
  timeSlots: TimeSlot[];
  generateTimetable: () => void;
  clearTimetable: () => void;
  moveSession: (session: TimetableSession, from: { day: string, period: number }, to: { day: string, period: number }) => void;
  conflicts: Conflict[];
  isConflict: (sessionId: string) => boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  resolveConflicts: () => void;
};

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

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
const CONSECUTIVE_PERIODS: number[][] = [[0,1], [1,2], [3,4], [4,5], [6,7], [7,8]];

const usePersistentState = <T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState(() => {
        if (typeof window === 'undefined') {
            return defaultValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key “${key}”:`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(key, JSON.stringify(state));
            } catch (error) {
                console.warn(`Error setting localStorage key “${key}”:`, error);
            }
        }
    }, [key, state]);

    return [state, setState];
};

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [teachers, setTeachers] = usePersistentState<Teacher[]>("timetable_teachers", []);
  const [timetable, setTimetable] = usePersistentState<TimetableData>("timetable_data", {});
  const [classes, setClasses] = usePersistentState<string[]>("timetable_classes", []);

  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode', 'class');

  const generateTimetable = useCallback(() => {
    const classSet = new Set<string>();
    const allRequiredSessions: TimetableSession[] = [];

    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                if (assignment.grades.length === 0 || assignment.arms.length === 0) return;

                const processClass = (className: string) => {
                    classSet.add(className);
                    for (let i = 0; i < assignment.periods; i++) {
                        allRequiredSessions.push({ id: crypto.randomUUID(), subject: subject.name, teacher: teacher.name, className, isDouble: false });
                    }
                };

                if (assignment.groupArms) {
                    assignment.grades.forEach(grade => {
                        const className = `${grade} ${assignment.arms.join(', ')}`;
                        processClass(className);
                    });
                } else {
                    assignment.grades.forEach(grade => {
                        assignment.arms.forEach(arm => {
                            const className = `${grade} ${arm}`;
                            processClass(className);
                        });
                    });
                }
            });
        });
    });

    const sortedClasses = Array.from(classSet).sort();
    setClasses(sortedClasses);

    const newTimetable: TimetableData = {};
    DAYS.forEach(day => { newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []); });

    const classSubjectPeriodsPerDay: { [className: string]: { [subject: string]: number[] } } = {};
    sortedClasses.forEach(c => { classSubjectPeriodsPerDay[c] = {}; });
    
    const shuffledSessions = allRequiredSessions.sort(() => Math.random() - 0.5);

    let currentDayIndex = 0;
    let currentPeriodIndex = 0;

    for (const session of shuffledSessions) {
        let placed = false;
        // Start searching from the last placement spot
        for (let d = 0; d < DAYS.length; d++) {
            const dayIndex = (currentDayIndex + d) % DAYS.length;
            const day = DAYS[dayIndex];

            if (!classSubjectPeriodsPerDay[session.className][session.subject]) {
                classSubjectPeriodsPerDay[session.className][session.subject] = Array(DAYS.length).fill(0);
            }

            for (let p = 0; p < PERIOD_COUNT; p++) {
                const periodIndex = (currentPeriodIndex + p) % PERIOD_COUNT;
                
                if (newTimetable[day][periodIndex].length === 0) { // Simple placement in first empty slot
                     if (classSubjectPeriodsPerDay[session.className][session.subject][dayIndex] < 2) {
                        newTimetable[day][periodIndex].push(session);
                        classSubjectPeriodsPerDay[session.className][session.subject][dayIndex]++;
                        placed = true;
                        currentDayIndex = dayIndex;
                        currentPeriodIndex = periodIndex;
                        break;
                    }
                }
            }
            if (placed) break;
        }

        // If strict check fails, just place it anywhere it fits.
        if (!placed) {
            for (const day of DAYS) {
                for (let periodIndex = 0; periodIndex < PERIOD_COUNT; periodIndex++) {
                    if(newTimetable[day][periodIndex].length === 0) {
                        newTimetable[day][periodIndex].push(session);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
        }
        
        // As a last resort, force-place it, creating a conflict.
        if (!placed) {
             newTimetable[DAYS[0]][0].push(session);
        }
    }

    setTimetable(newTimetable);
  }, [teachers, setClasses, setTimetable]);


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
    setTimetable({});
    setClasses([]);
  };
  
  const updateTeacher = (id: string, name: string, subjects: Subject[]) => {
    setTeachers(prev => prev.map(t => t.id === id ? { id, name, subjects } : t));
    setTimetable({});
    setClasses([]);
  };

  const clearTimetable = () => {
    setTimetable({});
    setClasses([]);
  }
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    setTimetable(prev => {
        const newTimetable = JSON.parse(JSON.stringify(prev));
        
        const fromSlot = newTimetable[from.day]?.[from.period];
        if (fromSlot) {
            const sessionIndex = fromSlot.findIndex((s: TimetableSession) => s.id === session.id && s.part === session.part);
            if (sessionIndex > -1) {
                fromSlot.splice(sessionIndex, 1);
            }
        }

        const toSlot = newTimetable[to.day]?.[to.period];
        if (toSlot) {
            toSlot.push(session);
        }

        return newTimetable;
    });
  }

  const resolveConflicts = () => {
    setTimetable(currentTimetable => {
        const newTimetable = JSON.parse(JSON.stringify(currentTimetable));
        const conflictsToResolve = [...conflicts];

        conflictsToResolve.forEach(conflict => {
            const sessionsInConflictSlot: {session: TimetableSession, day: string, period: number}[] = [];
            
            // Find the location of all sessions involved in this conflict
            Object.entries(newTimetable).forEach(([day, daySlots]) => {
                (daySlots as TimetableSession[][]).forEach((slot, period) => {
                    slot.forEach(session => {
                        if (session.id === conflict.id) {
                            sessionsInConflictSlot.push({session, day, period});
                        }
                    });
                });
            });
            
            if (sessionsInConflictSlot.length === 0) return;
            const origin = sessionsInConflictSlot[0];
            const originalSlot = newTimetable[origin.day][origin.period];

            // Keep the first session, try to move the others
            const sessionsToMove = originalSlot.slice(1);
            newTimetable[origin.day][origin.period] = [originalSlot[0]]; // Keep only first session

            sessionsToMove.forEach((sessionToMove: TimetableSession) => {
                let moved = false;
                for (const day of DAYS) {
                    for (let period = 0; period < PERIOD_COUNT; period++) {
                         // Check if target slot is empty and suitable
                        if (newTimetable[day][period].length === 0) {
                            newTimetable[day][period].push(sessionToMove);
                            moved = true;
                            break;
                        }
                    }
                    if (moved) break;
                }
                 // If it couldn't be moved to an empty slot, put it back to create a different conflict.
                 if (!moved) {
                     newTimetable[origin.day][origin.period].push(sessionToMove);
                 }
            });
        });

        return newTimetable;
    });
};

  useEffect(() => {
    if (Object.keys(timetable).length === 0) {
      setConflicts([]);
      return;
    }

    const identifiedConflicts = new Map<string, Conflict>();

    for (const day of DAYS) {
      for (let period = 0; period < PERIOD_COUNT; period++) {
        const slotSessions = timetable[day]?.[period];
        if (!slotSessions || slotSessions.length <= 1) continue;

        const teachersInSlot = new Set<string>();
        const classesInSlot = new Set<string>();
        
        for (const session of slotSessions) {
            // Teacher conflict
            if (teachersInSlot.has(session.teacher)) {
                slotSessions.forEach(s => {
                    if (s.teacher === session.teacher) {
                        identifiedConflicts.set(s.id, { id: s.id, type: 'teacher', message: `Teacher ${s.teacher} is double-booked.` });
                    }
                });
            }
            teachersInSlot.add(session.teacher);

            // Class conflict
            if (classesInSlot.has(session.className)) {
                slotSessions.forEach(s => {
                    if (s.className === session.className) {
                        identifiedConflicts.set(s.id, { id: s.id, type: 'class', message: `Class ${s.className} is double-booked.` });
                    }
                });
            }
            classesInSlot.add(session.className);
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
        classes,
        days,
        timeSlots,
        generateTimetable,
        clearTimetable,
        moveSession,
        conflicts,
        isConflict,
        viewMode,
        setViewMode,
        resolveConflicts,
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
