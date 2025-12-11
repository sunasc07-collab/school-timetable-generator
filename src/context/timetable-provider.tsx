
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
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.warn(`Error setting localStorage key “${key}”:`, error);
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
    const doubleSessions: TimetableSession[] = [];
    const singleSessions: TimetableSession[] = [];

    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
              if (assignment.grades.length === 0 || assignment.arms.length === 0) return;
              
              const numDouble = assignment.doublePeriods || 0;
              const numSingle = assignment.periods - (numDouble * 2);

              const processClass = (className: string) => {
                  classSet.add(className);
                  for (let i = 0; i < numDouble; i++) {
                      const doubleId = crypto.randomUUID();
                      doubleSessions.push({ id: doubleId, subject: subject.name, teacher: teacher.name, className, isDouble: true, part: 1 });
                      doubleSessions.push({ id: doubleId, subject: subject.name, teacher: teacher.name, className, isDouble: true, part: 2 });
                  }
                  for (let i = 0; i < numSingle; i++) {
                      singleSessions.push({ id: crypto.randomUUID(), subject: subject.name, teacher: teacher.name, className, isDouble: false });
                  }
              }

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

    const newTimetable: TimetableData = {};
    for (const day of DAYS) {
        newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []);
    }
    
    // --- Placement Logic ---
    const dailyDoubleCount: { [className: string]: { [day: string]: number } } = {};
    Array.from(classSet).forEach(c => {
        dailyDoubleCount[c] = {};
        DAYS.forEach(d => dailyDoubleCount[c][d] = 0);
    });

    // 1. Place double sessions
    const placedDoubleSessionIds = new Set<string>();
    doubleSessions.filter(s => s.part === 1).forEach(sessionPart1 => {
        const sessionPart2 = doubleSessions.find(s => s.id === sessionPart1.id && s.part === 2)!;
        let placed = false;
        
        // Shuffle days and periods for randomness
        const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
        const shuffledConsecutivePeriods = [...CONSECUTIVE_PERIODS].sort(() => Math.random() - 0.5);

        for (const day of shuffledDays) {
            if (dailyDoubleCount[sessionPart1.className][day] > 0) continue;

            for (const p of shuffledConsecutivePeriods) {
                const period1 = p[0];
                const period2 = p[1];

                const slot1 = newTimetable[day][period1];
                const slot2 = newTimetable[day][period2];

                const teacherConflict = slot1.some(s => s.teacher === sessionPart1.teacher) || slot2.some(s => s.teacher === sessionPart1.teacher);
                const classConflict = slot1.some(s => s.className === sessionPart1.className) || slot2.some(s => s.className === sessionPart1.className);
                
                if (!teacherConflict && !classConflict) {
                    slot1.push(sessionPart1);
                    slot2.push(sessionPart2);
                    dailyDoubleCount[sessionPart1.className][day]++;
                    placedDoubleSessionIds.add(sessionPart1.id);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
    });

    // Brute force place any unplaced doubles
    doubleSessions.filter(s => s.part === 1 && !placedDoubleSessionIds.has(s.id)).forEach(sessionPart1 => {
        const sessionPart2 = doubleSessions.find(s => s.id === sessionPart1.id && s.part === 2)!;
        let placed = false;
        for (const day of DAYS) {
            for (const p of CONSECUTIVE_PERIODS) {
                if(newTimetable[day][p[0]].length === 0 && newTimetable[day][p[1]].length === 0) { // Simple check, can be improved
                    newTimetable[day][p[0]].push(sessionPart1);
                    newTimetable[day][p[1]].push(sessionPart2);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
    });
    
    // 2. Place single sessions
    const allSessions = [...singleSessions];
    const availableSlots: {day: string, period: number}[] = [];
    DAYS.forEach(day => {
        for(let period = 0; period < PERIOD_COUNT; period++) {
            availableSlots.push({day, period});
        }
    });

    allSessions.forEach(session => {
        let placed = false;
        for(let i=0; i<availableSlots.length; i++) {
            const { day, period } = availableSlots[i];
            const slot = newTimetable[day][period];
            const teacherConflict = slot.some(s => s.teacher === session.teacher);
            const classConflict = slot.some(s => s.className === session.className);
            if (!teacherConflict && !classConflict) {
                slot.push(session);
                placed = true;
                break;
            }
        }

        // Force place if no ideal spot was found
        if (!placed) {
            for (const day of DAYS) {
                for (let period = 0; period < PERIOD_COUNT; period++) {
                     newTimetable[day][period].push(session);
                     placed = true;
                     break;
                }
                if (placed) break;
            }
        }
    });

    setClasses(Array.from(classSet).sort());
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
            const sessionIndex = fromSlot.findIndex((s: TimetableSession) => s.id === session.id);
            if (sessionIndex > -1) {
                fromSlot.splice(sessionIndex, 1);
            }
        }

        const toSlot = newTimetable[to.day]?.[to.period];
        if (toSlot) {
            toSlot.push(session);
        }

        // Handle double periods
        if (session.isDouble) {
            const otherPart = session.part === 1 ? 2 : 1;
            let otherSessionFrom: { day: string; period: number } | null = null;
            
            // Find the other part of the double period to remove it
            Object.keys(newTimetable).forEach(day => {
                newTimetable[day].forEach((slot: TimetableSession[], period: number) => {
                    const otherSessionIndex = slot.findIndex(s => s.id === session.id && s.part === otherPart);
                    if (otherSessionIndex > -1) {
                        otherSessionFrom = { day, period };
                        slot.splice(otherSessionIndex, 1);
                    }
                });
            });

            // Place the other part adjacent to the new location
            const otherToPeriod = to.period + (session.part === 1 ? 1 : -1);
            if (otherToPeriod >= 0 && otherToPeriod < PERIOD_COUNT) {
                 const otherToSlot = newTimetable[to.day]?.[otherToPeriod];
                 if (otherToSlot) {
                    otherToSlot.push({ ...session, part: otherPart as 1 | 2 });
                 }
            }
        }

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
