
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
    
    // 1. Figure out all required sessions from teachers config
    const requiredSessionsByClass: { [key: string]: { subject: string, teacher: string }[] } = {};

    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                if (assignment.grades.length === 0 || assignment.arms.length === 0) return;

                const processClass = (className: string) => {
                    classSet.add(className);
                    if (!requiredSessionsByClass[className]) {
                        requiredSessionsByClass[className] = [];
                    }
                    for (let i = 0; i < assignment.periods; i++) {
                        requiredSessionsByClass[className].push({ subject: subject.name, teacher: teacher.name });
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

    // 2. Group sessions into singles and doubles
    const finalSessions: TimetableSession[] = [];
    Object.keys(requiredSessionsByClass).forEach(className => {
        const sessions = requiredSessionsByClass[className];
        const subjectCounts: { [key: string]: { teacher: string, count: number } } = {};

        sessions.forEach(session => {
            const key = `${session.subject}-${session.teacher}`;
            if (!subjectCounts[key]) {
                subjectCounts[key] = { teacher: session.teacher, count: 0 };
            }
            subjectCounts[key].count++;
        });

        Object.keys(subjectCounts).forEach(key => {
            const [subjectName, teacherName] = key.split('-');
            let { count } = subjectCounts[key];
            
            // Create double periods
            while (count >= 2) {
                const doubleId = crypto.randomUUID();
                finalSessions.push({ id: doubleId, subject: subjectName, teacher: teacherName, className, isDouble: true, part: 1 });
                finalSessions.push({ id: doubleId, subject: subjectName, teacher: teacherName, className, isDouble: true, part: 2 });
                count -= 2;
            }
            // Create single periods
            if (count > 0) {
                 finalSessions.push({ id: crypto.randomUUID(), subject: subjectName, teacher: teacherName, className, isDouble: false });
            }
        });
    });

    // 3. Brute force placement
    const newTimetable: TimetableData = {};
    DAYS.forEach(day => { newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []); });
    
    const shuffledSessions = finalSessions.sort(() => Math.random() - 0.5);
    const placedDoubleIds = new Set<string>();

    const doublePeriods = shuffledSessions.filter(s => s.isDouble);
    const singlePeriods = shuffledSessions.filter(s => !s.isDouble);
    
    // Place double periods first
    for (const session of doublePeriods) {
        if (placedDoubleIds.has(session.id)) continue;

        let placed = false;
        const shuffledDays = DAYS.slice().sort(() => Math.random() - 0.5);

        for (const day of shuffledDays) {
            const shuffledConsecutivePeriods = CONSECUTIVE_PERIODS.slice().sort(() => Math.random() - 0.5);
            for (const p of shuffledConsecutivePeriods) {
                const [p1, p2] = p;

                const teacherIsFree = !newTimetable[day][p1].some(s => s.teacher === session.teacher) && !newTimetable[day][p2].some(s => s.teacher === session.teacher);
                const classIsFree = !newTimetable[day][p1].some(s => s.className === session.className) && !newTimetable[day][p2].some(s => s.className === session.className);
                const classHasNoDoubleOfSubject = !newTimetable[day].flat().some(s => s.className === session.className && s.subject === session.subject && s.isDouble);
                
                if (teacherIsFree && classIsFree && classHasNoDoubleOfSubject) {
                    newTimetable[day][p1].push({ ...session, part: 1 });
                    newTimetable[day][p2].push({ ...session, part: 2 });
                    placedDoubleIds.add(session.id);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
    }

    // Place single periods
    for (const session of singlePeriods) {
        let placed = false;
        const shuffledDays = DAYS.slice().sort(() => Math.random() - 0.5);

        for (const day of shuffledDays) {
            const subjectPeriodsOnDay = newTimetable[day].flat().filter(s => s.className === session.className && s.subject === session.subject).length;
            if (subjectPeriodsOnDay >= 2) continue;

            const shuffledPeriods = Array.from({length: PERIOD_COUNT}, (_, i) => i).sort(() => Math.random() - 0.5);

            for (const period of shuffledPeriods) {
                const teacherIsFree = !newTimetable[day][period].some(s => s.teacher === session.teacher);
                const classIsFree = !newTimetable[day][period].some(s => s.className === session.className);
                
                if (teacherIsFree && classIsFree) {
                    newTimetable[day][period].push(session);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
    }

    // Force place any remaining (shouldn't happen with enough slots)
    shuffledSessions.forEach(session => {
        let isPlaced = false;
        if(session.isDouble && placedDoubleIds.has(session.id)) {
            isPlaced = true;
        } else if (!session.isDouble) {
            // Check if single period is placed
            for (const day of DAYS) {
                for (let period = 0; period < PERIOD_COUNT; period++) {
                     if (newTimetable[day][period].some(s => s.id === session.id)) {
                        isPlaced = true;
                        break;
                    }
                }
                if(isPlaced) break;
            }
        }

        if (!isPlaced) {
            // Force place
             for (const day of DAYS) {
                for (let period = 0; period < PERIOD_COUNT; period++) {
                    newTimetable[day][period].push(session);
                    if(session.isDouble) placedDoubleIds.add(session.id);
                    isPlaced = true;
                    break;
                }
                if(isPlaced) break;
            }
        }
    });

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
        const allSessions: TimetableSession[] = [];
        Object.values(newTimetable).forEach(day => day.forEach((slot: TimetableSession[]) => allSessions.push(...slot)));

        const emptyTimetable: TimetableData = {};
        DAYS.forEach(day => { emptyTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []); });
        
        const placedSessionIds = new Set<string>();

        allSessions.forEach(session => {
            if (placedSessionIds.has(session.id)) return;

            let moved = false;
            
            // Try to find a slot where both class and teacher are free
            for (const day of DAYS) {
                for (let period = 0; period < PERIOD_COUNT; period++) {
                    const teacherIsFree = !emptyTimetable[day][period].some(s => s.teacher === session.teacher);
                    const classIsFree = !emptyTimetable[day][period].some(s => s.className === session.className);

                    if (teacherIsFree && classIsFree) {
                        emptyTimetable[day][period].push(session);
                        placedSessionIds.add(session.id);
                        moved = true;
                        break;
                    }
                }
                if (moved) break;
            }

            // If not moved, just place it anywhere to keep it on the board
            if (!moved) {
                for (const day of DAYS) {
                    for (let period = 0; period < PERIOD_COUNT; period++) {
                         if (emptyTimetable[day][period].length < 2) { // Try to limit pile-up
                            emptyTimetable[day][period].push(session);
                            placedSessionIds.add(session.id);
                            moved = true;
                            break;
                         }
                    }
                    if (moved) break;
                }
            }
        });


        return emptyTimetable;
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
    
    // Check for broken double periods
    const doublePeriodParts = new Map<string, {session: TimetableSession, day: string, period: number}>();
    for (const day of DAYS) {
        for (let period = 0; period < PERIOD_COUNT; period++) {
            const slotSessions = timetable[day]?.[period] || [];
            for (const session of slotSessions) {
                if (session.isDouble) {
                    const key = `${session.id}-${session.part}`;
                    doublePeriodParts.set(key, { session, day, period });
                }
            }
        }
    }

    const checkedDoubles = new Set<string>();
    doublePeriodParts.forEach(({session}, key) => {
        if(checkedDoubles.has(session.id)) return;
        
        const part1Key = `${session.id}-1`;
        const part2Key = `${session.id}-2`;

        if (doublePeriodParts.has(part1Key) && doublePeriodParts.has(part2Key)) {
             const part1 = doublePeriodParts.get(part1Key)!;
             const part2 = doublePeriodParts.get(part2Key)!;

             if(part1.day !== part2.day || Math.abs(part1.period - part2.period) !== 1) {
                 identifiedConflicts.set(session.id, { id: session.id, type: 'class', message: `Broken double period for ${session.subject}.` });
             }
             checkedDoubles.add(session.id);
        } else {
            // Only one part exists
            identifiedConflicts.set(session.id, { id: session.id, type: 'class', message: `Incomplete double period for ${session.subject}.` });
        }
    });


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

    
    