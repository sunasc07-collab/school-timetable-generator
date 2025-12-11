
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
    console.log("Starting timetable generation...");
    const classSet = new Set<string>();
    let sessionsToPlace: TimetableSession[] = [];

    // 1. Collect all sessions that need to be placed
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
                      sessionsToPlace.push({ id: doubleId, subject: subject.name, teacher: teacher.name, className, isDouble: true, part: 1 });
                  }
                  for (let i = 0; i < numSingle; i++) {
                      sessionsToPlace.push({ id: crypto.randomUUID(), subject: subject.name, teacher: teacher.name, className, isDouble: false });
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

    const doubleSessions = sessionsToPlace.filter(s => s.isDouble).map(s => ({...s, isDouble: true, part: 1 as const}));
    const singleSessions = sessionsToPlace.filter(s => !s.isDouble);

    // Shuffle for randomness
    const shuffledDoubles = doubleSessions.sort(() => Math.random() - 0.5);
    const shuffledSingles = singleSessions.sort(() => Math.random() - 0.5);
    const allSessions = [...shuffledDoubles, ...shuffledSingles];

    
    // 2. Initialize an empty timetable
    let newTimetable: TimetableData = {};
    for (const day of DAYS) {
        newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []);
    }

    // 3. Backtracking solver
    const solve = (currentTimetable: TimetableData, sessions: TimetableSession[]): TimetableData | null => {
        if (sessions.length === 0) {
            return currentTimetable; // Success
        }

        const session = sessions[0];
        const remainingSessions = sessions.slice(1);
        
        // --- Double Period Logic ---
        if (session.isDouble) {
            for (const day of DAYS) {
                // Check if this class already has a double period on this day
                const hasDoubleOnDay = Object.values(currentTimetable[day]).flat().some(
                    s => s.isDouble && s.className === session.className
                );
                if (hasDoubleOnDay) continue;

                for (const p of CONSECUTIVE_PERIODS) {
                    const period1 = p[0];
                    const period2 = p[1];
                    
                    const slot1 = currentTimetable[day][period1];
                    const slot2 = currentTimetable[day][period2];

                    const isTeacherAvailable = !slot1.some(s => s.teacher === session.teacher) && !slot2.some(s => s.teacher === session.teacher);
                    const isClassAvailable = !slot1.some(s => s.className === session.className) && !slot2.some(s => s.className === session.className);

                    if (isTeacherAvailable && isClassAvailable) {
                        const nextTimetable = JSON.parse(JSON.stringify(currentTimetable));
                        nextTimetable[day][period1].push({ ...session, part: 1 });
                        nextTimetable[day][period2].push({ ...session, part: 2 });
                        
                        const result = solve(nextTimetable, remainingSessions);
                        if (result) return result;
                    }
                }
            }
        } 
        // --- Single Period Logic ---
        else {
             for (const day of DAYS) {
                for (let period = 0; period < PERIOD_COUNT; period++) {
                    const slot = currentTimetable[day][period];
                    
                    const isTeacherAvailable = !slot.some(s => s.teacher === session.teacher);
                    const isClassAvailable = !slot.some(s => s.className === session.className);

                    if (isTeacherAvailable && isClassAvailable) {
                         const nextTimetable = JSON.parse(JSON.stringify(currentTimetable));
                         nextTimetable[day][period].push(session);

                         const result = solve(nextTimetable, remainingSessions);
                         if (result) return result;
                    }
                }
            }
        }
        
        return null; // Backtrack
    };

    const solvedTimetable = solve(newTimetable, allSessions);

    if (solvedTimetable) {
        console.log("Timetable generated successfully!");
        setClasses(Array.from(classSet).sort());
        setTimetable(solvedTimetable);
    } else {
        console.error("Failed to generate a valid timetable. Some constraints might be too restrictive.");
        // Fallback: just place everything to show the user what conflicts
        let fallbackTimetable: TimetableData = {};
        for (const day of DAYS) {
            fallbackTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []);
        }
        let dayIndex = 0;
        let periodIndex = 0;
        
        const getNextSlot = () => {
            const day = DAYS[dayIndex];
            const period = periodIndex;
            periodIndex = (periodIndex + 1) % PERIOD_COUNT;
            if(periodIndex === 0) dayIndex = (dayIndex + 1) % DAYS.length;
            return { day, period };
        }

        allSessions.forEach(s => {
             if (s.isDouble) {
                const sessionPart1 = {...s, part: 1 as const};
                const sessionPart2 = {...s, part: 2 as const};
                const {day, period} = getNextSlot();
                fallbackTimetable[day][period].push(sessionPart1);
                const {day: day2, period: period2} = getNextSlot();
                fallbackTimetable[day2][period2].push(sessionPart2);
            } else {
                 const {day, period} = getNextSlot();
                 fallbackTimetable[day][period].push(s);
            }
        });
        setClasses(Array.from(classSet).sort());
        setTimetable(fallbackTimetable);
    }
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

        // Handle double periods
        if (session.isDouble) {
            const otherPart = session.part === 1 ? 2 : 1;
            
            // Find the other part of the double period to remove it
            Object.keys(newTimetable).forEach(day => {
                newTimetable[day].forEach((slot: TimetableSession[]) => {
                    const otherSessionIndex = slot.findIndex(s => s.id === session.id && s.part === otherPart);
                    if (otherSessionIndex > -1) {
                        slot.splice(otherSessionIndex, 1);
                    }
                });
            });
            
            // Try to place the other part adjacent to the new location
            const isConsecutivePair = CONSECUTIVE_PERIODS.some(p => 
                (p[0] === to.period && p[1] === to.period + 1) || 
                (p[1] === to.period && p[0] === to.period - 1)
            );

            if(isConsecutivePair) {
                const otherToPeriod = to.period + (session.part === 1 ? 1 : -1);
                if (otherToPeriod >= 0 && otherToPeriod < PERIOD_COUNT) {
                     const otherToSlot = newTimetable[to.day]?.[otherToPeriod];
                     if (otherToSlot) {
                        otherToSlot.push({ ...session, part: otherPart as 1 | 2 });
                     }
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
    
    // Check for broken double periods
    const sessionParts = new Map<string, TimetableSession & {day: string, period: number}>();
    for (const day of DAYS) {
        for(let period = 0; period < PERIOD_COUNT; period++) {
            const slot = timetable[day][period];
            slot.forEach(session => {
                if(session.isDouble){
                    sessionParts.set(`${session.id}-${session.part}`, {...session, day, period});
                }
            });
        }
    }

    for(const [key, part1] of sessionParts.entries()) {
        if (part1.part === 1) {
            const part2Key = `${part1.id}-2`;
            const part2 = sessionParts.get(part2Key);
            if (!part2) {
                 identifiedConflicts.set(part1.id, { id: part1.id, type: 'class', message: `Broken double period for ${part1.subject} in ${part1.className}`});
            } else {
                 const isSameDay = part1.day === part2.day;
                 const areConsecutive = CONSECUTIVE_PERIODS.some(p => 
                    (p[0] === part1.period && p[1] === part2.period) || 
                    (p[0] === part2.period && p[1] === part1.period)
                 );
                 if (!isSameDay || !areConsecutive) {
                    identifiedConflicts.set(part1.id, { id: part1.id, type: 'class', message: `Broken double period for ${part1.subject} in ${part1.className}`});
                    identifiedConflicts.set(part2.id, { id: part2.id, type: 'class', message: `Broken double period for ${part2.subject} in ${part2.className}`});
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

    