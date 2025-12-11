
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
    const allSessions: TimetableSession[] = [];

    // 1. Collect all sessions
    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                if (assignment.grades.length === 0 || assignment.arms.length === 0) return;

                const processClass = (className: string) => {
                    classSet.add(className);
                    for (let i = 0; i < assignment.periods; i++) {
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

    // 2. Initialize structures
    const newTimetable: TimetableData = {};
    const teacherAvailability: { [key: string]: boolean[][] } = {};
    const classAvailability: { [key: string]: boolean[][] } = {};
    const classSubjectPeriodsPerDay: { [className: string]: { [subject: string]: number[] } } = {};
    const unplacedSessions: TimetableSession[] = [];

    DAYS.forEach(day => { newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []); });
    teachers.forEach(t => { teacherAvailability[t.name] = Array.from({ length: DAYS.length }, () => Array(PERIOD_COUNT).fill(true)); });
    Array.from(classSet).forEach(c => {
        classAvailability[c] = Array.from({ length: DAYS.length }, () => Array(PERIOD_COUNT).fill(true));
        classSubjectPeriodsPerDay[c] = {};
    });

    // 3. Shuffle sessions for randomness
    const shuffledSessions = allSessions.sort(() => Math.random() - 0.5);

    // 4. Place all sessions
    for (const session of shuffledSessions) {
        let placed = false;

        if (!classSubjectPeriodsPerDay[session.className][session.subject]) {
            classSubjectPeriodsPerDay[session.className][session.subject] = Array(DAYS.length).fill(0);
        }

        const sortedDays = [...DAYS].sort((a, b) => {
            const dayIndexA = DAYS.indexOf(a);
            const dayIndexB = DAYS.indexOf(b);
            const countA = classSubjectPeriodsPerDay[session.className][session.subject][dayIndexA];
            const countB = classSubjectPeriodsPerDay[session.className][session.subject][dayIndexB];
            if (countA !== countB) return countA - countB;
            return Math.random() - 0.5;
        });

        for (const day of sortedDays) {
            const dayIndex = DAYS.indexOf(day);

            if (classSubjectPeriodsPerDay[session.className][session.subject][dayIndex] >= 2) {
                continue;
            }

            const shuffledPeriods = [...Array(PERIOD_COUNT).keys()].sort(() => Math.random() - 0.5);
            for (const periodIndex of shuffledPeriods) {
                if (teacherAvailability[session.teacher][dayIndex][periodIndex] && classAvailability[session.className][dayIndex][periodIndex]) {
                    newTimetable[day][periodIndex].push(session);
                    teacherAvailability[session.teacher][dayIndex][periodIndex] = false;
                    classAvailability[session.className][dayIndex][periodIndex] = false;
                    classSubjectPeriodsPerDay[session.className][session.subject][dayIndex]++;
                    placed = true;
                    break; 
                }
            }
            if (placed) break;
        }

        if (!placed) {
            unplacedSessions.push(session);
        }
    }

    // 5. Force-place any remaining sessions
    for (const session of unplacedSessions) {
        let forced = false;
        for (const day of DAYS) {
            for (let period = 0; period < PERIOD_COUNT; period++) {
                if (newTimetable[day][period].length < 2) { // Find a slot that's not overly crowded
                    newTimetable[day][period].push(session);
                    forced = true;
                    break;
                }
            }
            if (forced) break;
        }
        // If still not placed, put it in the first slot as a last resort
        if (!forced) {
            newTimetable[DAYS[0]][0].push(session);
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
            let otherSessionFromDay: string | null = null;
            let otherSessionFromPeriod: number | null = null;
            
            // Find and remove the other part
            Object.keys(newTimetable).forEach(day => {
                newTimetable[day].forEach((slot: TimetableSession[], period: number) => {
                    const otherSessionIndex = slot.findIndex(s => s.id === session.id && s.part === otherPart);
                    if (otherSessionIndex > -1) {
                        slot.splice(otherSessionIndex, 1);
                        otherSessionFromDay = day;
                        otherSessionFromPeriod = period;
                    }
                });
            });
            
            // Try to place the other part adjacent to the new location
            const potentialOtherPeriods = [to.period + 1, to.period -1];
            let placedOtherPart = false;

            for (const otherPeriod of potentialOtherPeriods) {
                const isValidPair = CONSECUTIVE_PERIODS.some(p => 
                    (p[0] === to.period && p[1] === otherPeriod) ||
                    (p[1] === to.period && p[0] === otherPeriod)
                );

                if (isValidPair && otherPeriod >= 0 && otherPeriod < PERIOD_COUNT) {
                     const otherToSlot = newTimetable[to.day]?.[otherPeriod];
                     if (otherToSlot) {
                        otherToSlot.push({ ...session, part: otherPart as 1 | 2 });
                        placedOtherPart = true;
                        break;
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
        if (!timetable[day]) continue;
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
                    if (part2) {
                        identifiedConflicts.set(part2.id, { id: part2.id, type: 'class', message: `Broken double period for ${part2.subject} in ${part2.className}`});
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
