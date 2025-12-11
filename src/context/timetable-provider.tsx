
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
    const allSessions: TimetableSession[] = [];

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
                        allSessions.push({ id: doubleId, subject: subject.name, teacher: teacher.name, className, isDouble: true, part: 1 });
                        allSessions.push({ id: doubleId, subject: subject.name, teacher: teacher.name, className, isDouble: true, part: 2 });
                    }
                    for (let i = 0; i < numSingle; i++) {
                        allSessions.push({ id: crypto.randomUUID(), subject: subject.name, teacher: teacher.name, className, isDouble: false });
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

    // 2. Initialize an empty timetable and tracking structures
    const newTimetable: TimetableData = {};
    const teacherAvailability: { [key: string]: boolean[][] } = {};
    const classAvailability: { [key: string]: boolean[][] } = {};
    const classDoublePeriodDays: { [key: string]: Set<string> } = {};

    DAYS.forEach((day, dayIndex) => {
        newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []);
    });

    teachers.forEach(t => {
        teacherAvailability[t.name] = Array.from({ length: DAYS.length }, () => Array(PERIOD_COUNT).fill(true));
    });

    Array.from(classSet).forEach(c => {
        classAvailability[c] = Array.from({ length: DAYS.length }, () => Array(PERIOD_COUNT).fill(true));
        classDoublePeriodDays[c] = new Set();
    });
    
    // 3. Separate sessions and shuffle for randomness
    const doubleSessions = allSessions.filter(s => s.isDouble).sort(() => Math.random() - 0.5);
    const singleSessions = allSessions.filter(s => !s.isDouble).sort(() => Math.random() - 0.5);

    // 4. Place double periods first
    const placedDoubleIds = new Set<string>();
    for (const session of doubleSessions) {
        if (placedDoubleIds.has(session.id)) continue;

        let placed = false;
        // Shuffle days to avoid piling up at the start of the week
        const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);

        for (const day of shuffledDays) {
            if (placed) break;
            if (classDoublePeriodDays[session.className]?.has(day)) continue;

            const dayIndex = DAYS.indexOf(day);
            // Shuffle consecutive periods to try different slots
            const shuffledConsecutive = [...CONSECUTIVE_PERIODS].sort(() => Math.random() - 0.5);

            for (const p of shuffledConsecutive) {
                const [p1, p2] = p;
                
                const teacherFree = teacherAvailability[session.teacher][dayIndex][p1] && teacherAvailability[session.teacher][dayIndex][p2];
                const classFree = classAvailability[session.className][dayIndex][p1] && classAvailability[session.className][dayIndex][p2];

                if (teacherFree && classFree) {
                    const part1 = { ...session, part: 1 as const };
                    const part2 = { ...session, part: 2 as const };

                    newTimetable[day][p1].push(part1);
                    newTimetable[day][p2].push(part2);
                    
                    teacherAvailability[session.teacher][dayIndex][p1] = false;
                    teacherAvailability[session.teacher][dayIndex][p2] = false;
                    classAvailability[session.className][dayIndex][p1] = false;
                    classAvailability[session.className][dayIndex][p2] = false;

                    classDoublePeriodDays[session.className].add(day);
                    placedDoubleIds.add(session.id);
                    placed = true;
                    break;
                }
            }
        }
    }
    
    // 5. Place single periods
    for (const session of singleSessions) {
       let placed = false;
       for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
           if (placed) break;
           const day = DAYS[dayIndex];
           for (let periodIndex = 0; periodIndex < PERIOD_COUNT; periodIndex++) {
               const teacherFree = teacherAvailability[session.teacher][dayIndex][periodIndex];
               const classFree = classAvailability[session.className][dayIndex][periodIndex];

               if (teacherFree && classFree) {
                   newTimetable[day][periodIndex].push(session);
                   teacherAvailability[session.teacher][dayIndex][periodIndex] = false;
                   classAvailability[session.className][dayIndex][periodIndex] = false;
                   placed = true;
                   break;
               }
           }
       }
    }

    // This part handles unplaced sessions by forcing them into slots, creating conflicts
    const remainingSessions = allSessions.filter(s => {
        if (s.isDouble) return !placedDoubleIds.has(s.id);
        
        return !Object.values(newTimetable).flat().flat().some(placed => placed.id === s.id)
    });
    
    // Brute-force place any remaining sessions
    if (remainingSessions.length > 0) {
        let dayIndex = 0;
        let periodIndex = 0;
        
        const remainingSingles = remainingSessions.filter(s => !s.isDouble);
        for(const session of remainingSingles) {
             let placed = false;
             for (let i = 0; i < DAYS.length * PERIOD_COUNT && !placed; i++) {
                const day = DAYS[dayIndex];
                 if (newTimetable[day][periodIndex].length < 2) { // Allow some overlap
                    newTimetable[day][periodIndex].push(session);
                    placed = true;
                 }
                periodIndex = (periodIndex + 1) % PERIOD_COUNT;
                if (periodIndex === 0) dayIndex = (dayIndex + 1) % DAYS.length;
             }
        }

        const remainingDoubles = remainingSessions.filter(s => s.isDouble && s.part === 1);
        for(const session of remainingDoubles) {
            let placed = false;
            for (let i = 0; i < DAYS.length * CONSECUTIVE_PERIODS.length && !placed; i++) {
                const day = DAYS[dayIndex];
                const p = CONSECUTIVE_PERIODS[periodIndex % CONSECUTIVE_PERIODS.length];
                const [p1, p2] = p;

                if (newTimetable[day][p1].length < 2 && newTimetable[day][p2].length < 2) {
                     newTimetable[day][p1].push({...session, part: 1});
                     newTimetable[day][p2].push({...session, part: 2});
                     placed = true;
                }

                periodIndex++;
                if (periodIndex % CONSECUTIVE_PERIODS.length === 0) dayIndex = (dayIndex + 1) % DAYS.length;
            }
        }
    }


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

    