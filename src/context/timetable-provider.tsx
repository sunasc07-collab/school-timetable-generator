
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict, TimeSlot } from "@/lib/types";

type ViewMode = 'class' | 'teacher';

type TimetableContextType = {
  teachers: Teacher[];
  addTeacher: (name: string, totalPeriods: number, subjects: Omit<Subject, "id">[]) => void;
  removeTeacher: (id: string) => void;
  updateTeacher: (id: string, name: string, totalPeriods: number, subjects: Subject[]) => void;
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
  { period: 1, time: "8:10 - 8:50" },
  { period: 2, time: "8:50 - 9:30" },
  { period: 3, time: "9:30 - 10:10" },
  { period: null, time: "10:10 - 10:35", isBreak: true, label: "Short Break" },
  { period: 4, time: "10:35 - 11:15" },
  { period: 5, time: "11:15 - 11:55" },
  { period: 6, time: "11:55 - 12:35" },
  { period: null, time: "12:35 - 1:20", isBreak: true, label: "Lunch Break" },
  { period: 7, time: "1:20 - 2:00" },
  { period: 8, time: "2:00 - 2:35" },
  { period: 9, time: "2:35 - 3:10" },
];
const PERIOD_COUNT = TIME_SLOTS.filter(ts => !ts.isBreak).length;

const getConsecutivePeriods = (): number[][] => {
    const consecutive: number[][] = [];
    const teachingPeriods: number[] = [];
    TIME_SLOTS.forEach(slot => {
        if(slot.period !== null) {
            teachingPeriods.push(slot.period - 1);
        }
    });

    for(let i = 0; i < teachingPeriods.length - 1; i++){
        // This check assumes teachingPeriods are sorted, which they are from TIME_SLOTS
        const currentPeriodIndex = teachingPeriods[i];
        const nextPeriodIndex = teachingPeriods[i+1];
        
        // Find original slot indices to check if they are visually consecutive
        const currentSlotIndex = TIME_SLOTS.findIndex(s => s.period === currentPeriodIndex + 1);
        const nextSlotIndex = TIME_SLOTS.findIndex(s => s.period === nextPeriodIndex + 1);

        if(nextSlotIndex === currentSlotIndex + 1) {
            consecutive.push([currentPeriodIndex, nextPeriodIndex]);
        }
    }
    return consecutive;
}

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
    const requiredSessions: { [key: string]: { subject: string; teacher: string }[] } = {};

    teachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                if (assignment.grades.length === 0 || assignment.arms.length === 0) return;

                const processClass = (className: string) => {
                    classSet.add(className);
                    if (!requiredSessions[className]) {
                        requiredSessions[className] = [];
                    }
                    for (let i = 0; i < assignment.periods; i++) {
                        requiredSessions[className].push({ subject: subject.name, teacher: teacher.name });
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

    // Group into single and double sessions
    const sessionsToPlace: TimetableSession[] = [];
    Object.keys(requiredSessions).forEach(className => {
        const subjectCounts: { [key: string]: { teacher: string; count: number } } = {};
        requiredSessions[className].forEach(session => {
            const key = `${session.subject}|${session.teacher}`;
            if (!subjectCounts[key]) {
                subjectCounts[key] = { teacher: session.teacher, count: 0 };
            }
            subjectCounts[key].count++;
        });

        Object.entries(subjectCounts).forEach(([key, { teacher, count }]) => {
            const [subject] = key.split('|');
            let remaining = count;
            while (remaining >= 2) {
                const doubleId = crypto.randomUUID();
                sessionsToPlace.push({ id: doubleId, subject, teacher, className, isDouble: true, part: 1 });
                sessionsToPlace.push({ id: doubleId, subject, teacher, className, isDouble: true, part: 2 });
                remaining -= 2;
            }
            if (remaining > 0) {
                sessionsToPlace.push({ id: crypto.randomUUID(), subject, teacher, className, isDouble: false });
            }
        });
    });
    
    // Prioritize double periods
    sessionsToPlace.sort((a, b) => (b.isDouble ? 1 : 0) - (a.isDouble ? 1 : 0));
    
    const newTimetable: TimetableData = {};
    DAYS.forEach(day => { newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods();

    function solve(board: TimetableData, sessions: TimetableSession[]): TimetableData | null {
        if (sessions.length === 0) {
            return board; // Success
        }

        const session = sessions[0];
        const remainingSessions = sessions.slice(1);
        
        const dayUsage = DAYS.map(day => ({ day, count: board[day].flat().filter(s => s.className === session.className && s.subject === session.subject).length }));
        const shuffledDays = dayUsage.sort((a, b) => a.count - b.count).map(d => d.day);

        for (const day of shuffledDays) {
            if (session.isDouble) {
                const partner = remainingSessions.find(s => s.id === session.id);
                if (!partner) continue; // Should not happen

                const otherSessions = remainingSessions.filter(s => s.id !== session.id);
                const shuffledConsecutive = CONSECUTIVE_PERIODS.slice().sort(() => Math.random() - 0.5);

                for (const [p1, p2] of shuffledConsecutive) {
                    if (isValidPlacement(board, session, day, p1) && isValidPlacement(board, partner, day, p2)) {
                        board[day][p1].push(session);
                        board[day][p2].push(partner);
                        
                        const result = solve(board, otherSessions);
                        if (result) return result;

                        // Backtrack
                        board[day][p1] = board[day][p1].filter(s => s.id !== session.id);
                        board[day][p2] = board[day][p2].filter(s => s.id !== partner.id);
                    }
                }
            } else { // Single period
                 const shuffledPeriods = Array.from({length: PERIOD_COUNT}, (_, i) => i).sort(() => Math.random() - 0.5);
                 for (const period of shuffledPeriods) {
                    if (isValidPlacement(board, session, day, period)) {
                        board[day][period].push(session);

                        const result = solve(board, remainingSessions);
                        if (result) return result;
                        
                        // Backtrack
                        board[day][period] = board[day][period].filter(s => s.id !== session.id);
                    }
                }
            }
        }
        return null; // No solution found from this path
    }

    function isValidPlacement(board: TimetableData, session: TimetableSession, day: string, period: number): boolean {
        // Teacher and Class availability
        const slot = board[day]?.[period];
        if (!slot || slot.some(s => s.teacher === session.teacher) || slot.some(s => s.className === session.className)) {
            return false;
        }

        const daySessions = board[day].flat();
        
        // One double per day per class rule
        if (session.isDouble && daySessions.some(s => s.className === session.className && s.isDouble && s.id !== session.id)) {
            return false;
        }

        // Max 2 periods of same subject per day rule
        const subjectPeriodsOnDay = daySessions.filter(s => s.className === session.className && s.subject === session.subject).length;
        if ( (session.isDouble && subjectPeriodsOnDay > 0) || (!session.isDouble && subjectPeriodsOnDay >= 2)) {
             return false;
        }

        return true;
    }
    
    let finalTimetable = solve(newTimetable, sessionsToPlace);
    
    // If solver fails, fall back to simple placement to at least show all periods
    if (!finalTimetable) {
        finalTimetable = newTimetable; // reset board
        const placedIds = new Set<string>();
        sessionsToPlace.forEach(session => {
             if (placedIds.has(session.id)) return;
             
             let placed = false;
             for (const day of DAYS) {
                for (let period = 0; period < PERIOD_COUNT; period++) {
                    if (session.isDouble) {
                        const partner = sessionsToPlace.find(s => s.id === session.id && s.part !== session.part);
                        if (!partner) continue;
                        const p2 = period + 1;
                        if (CONSECUTIVE_PERIODS.some(p => p[0] === period && p[1] === p2)) {
                            finalTimetable![day][period].push({...session, part: 1});
                            finalTimetable![day][p2].push({...partner, part: 2});
                            placed = true;
                            placedIds.add(session.id);
                            break;
                        }
                    } else {
                        finalTimetable![day][period].push(session);
                        placed = true;
                        placedIds.add(session.id);
                        break;
                    }
                }
                 if(placed) break;
             }
        })
    }

    setTimetable(finalTimetable || newTimetable);
  }, [teachers, setClasses, setTimetable]);


  const days = Object.keys(timetable).length > 0 ? DAYS : [];
  const timeSlots = Object.keys(timetable).length > 0 ? TIME_SLOTS : [];

  const addTeacher = (name: string, totalPeriods: number, subjects: Omit<Subject, "id">[]) => {
    const newTeacher: Teacher = {
      id: crypto.randomUUID(),
      name,
      totalPeriods,
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
  
  const updateTeacher = (id: string, name: string, totalPeriods: number, subjects: Subject[]) => {
    setTeachers(prev => prev.map(t => t.id === id ? { id, name, totalPeriods, subjects } : t));
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
        const CONSECUTIVE_PERIODS = getConsecutivePeriods();

        // Sort to attempt placing more constrained sessions first
        allSessions.sort((a,b) => (b.isDouble ? 1:0) - (a.isDouble ? 1:0));

        allSessions.forEach(session => {
            if (session.isDouble) {
                if (placedSessionIds.has(session.id)) return;
                
                const partner = allSessions.find(s => s.id === session.id && s.part !== session.part);
                if (!partner) return; // Should not happen with valid data

                let moved = false;
                for (const day of DAYS) {
                    for (const p of CONSECUTIVE_PERIODS) {
                        const [p1, p2] = p;
                        const teacherIsFree = !emptyTimetable[day][p1].some(s => s.teacher === session.teacher) && !emptyTimetable[day][p2].some(s => s.teacher === session.teacher);
                        const classIsFree = !emptyTimetable[day][p1].some(s => s.className === session.className) && !emptyTimetable[day][p2].some(s => s.className === session.className);
                        if(teacherIsFree && classIsFree) {
                            emptyTimetable[day][p1].push({...session, part: 1});
                            emptyTimetable[day][p2].push({...partner, part: 2});
                            placedSessionIds.add(session.id);
                            moved = true;
                            break;
                        }
                    }
                    if (moved) break;
                }

                // Force place if no ideal slot found
                 if (!moved) {
                     for (const day of DAYS) {
                        for (const p of CONSECUTIVE_PERIODS) {
                           const [p1, p2] = p;
                            if (emptyTimetable[day][p1].length < 2 && emptyTimetable[day][p2].length < 2) {
                                emptyTimetable[day][p1].push({...session, part: 1});
                                emptyTimetable[day][p2].push({...partner, part: 2});
                                placedSessionIds.add(session.id);
                                moved = true;
                                break;
                            }
                        }
                        if (moved) break;
                    }
                }
            }
        });

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
    const CONSECUTIVE_PERIODS = getConsecutivePeriods();

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

             if(part1.day !== part2.day || !CONSECUTIVE_PERIODS.some(p => (p[0] === part1.period && p[1] === part2.period) || (p[0] === part2.period && p[1] === part1.period))) {
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

    