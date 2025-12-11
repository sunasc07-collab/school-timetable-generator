
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import type { Teacher, Subject, TimetableData, TimetableSession, Conflict, TimeSlot, Timetable } from "@/lib/types";

type ViewMode = 'class' | 'teacher';

type TimetableContextType = {
  timetables: Timetable[];
  activeTimetable: Timetable | null;
  allTeachers: Teacher[];
  addTimetable: (name: string) => void;
  removeTimetable: (timetableId: string) => void;
  renameTimetable: (timetableId: string, newName: string) => void;
  setActiveTimetableId: (id: string | null) => void;

  addTeacher: (teacherData: Teacher) => void;
  removeTeacher: (teacherId: string) => void;
  updateTeacher: (teacherData: Teacher) => void;
  
  generateTimetable: () => void;
  clearTimetable: () => void;
  moveSession: (session: TimetableSession, from: { day: string, period: number }, to: { day: string, period: number }) => void;
  resolveConflicts: () => void;
  isConflict: (sessionId: string) => boolean;
  
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
};

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
    { period: 1, time: "8:10 - 8:50" },
    { period: 2, time: "8:50 - 9:30" },
    { period: 3, time: "9:30 - 10:10" },
    { period: null, time: "10:10 - 10:40", isBreak: true, label: "Short Break" },
    { period: 4, time: "10:40 - 11:20" },
    { period: 5, time: "11:20 - 12:00" },
    { period: 6, time: "12:00 - 12:40" },
    { period: null, time: "12:40 - 1:30", isBreak: true, label: "Lunch Break" },
    { period: 7, time: "1:30 - 2:10" },
    { period: 8, time: "2:10 - 2:40" },
    { period: 9, time: "2:40 - 3:10" },
];
const PERIOD_COUNT = DEFAULT_TIME_SLOTS.filter(ts => !ts.isBreak).length;

const getConsecutivePeriods = (): number[][] => {
    const consecutive: number[][] = [];
    let teachingPeriods: number[] = [];
    DEFAULT_TIME_SLOTS.forEach(slot => {
        if(slot.period !== null) {
            teachingPeriods.push(slot.period - 1);
        }
    });

    for(let i = 0; i < teachingPeriods.length - 1; i++){
        const currentPeriodIndex = teachingPeriods[i];
        
        const currentSlotIndex = DEFAULT_TIME_SLOTS.findIndex(s => s.period === currentPeriodIndex + 1);
        if (currentSlotIndex === -1 || currentSlotIndex + 1 >= DEFAULT_TIME_SLOTS.length) continue;

        const nextSlot = DEFAULT_TIME_SLOTS[currentSlotIndex + 1];

        if(nextSlot && nextSlot.period !== null) {
             const nextPeriodIndex = nextSlot.period -1;
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

const createNewTimetable = (name: string, id?: string): Timetable => ({
    id: id || crypto.randomUUID(),
    name,
    timetable: {},
    classes: [],
    conflicts: [],
    days: DEFAULT_DAYS,
    timeSlots: DEFAULT_TIME_SLOTS,
})

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [timetables, setTimetables] = usePersistentState<Timetable[]>("timetables_data_v3", []);
  const [allTeachers, setAllTeachers] = usePersistentState<Teacher[]>("all_teachers_v3", []);
  const [activeTimetableId, setActiveTimetableId] = usePersistentState<string | null>("active_timetable_id_v3", null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode_v3', 'class');
  
  useEffect(() => {
    if (timetables.length === 0) {
        const defaultTimetable = createNewTimetable("Secondary");
        setTimetables([defaultTimetable]);
        setActiveTimetableId(defaultTimetable.id);
    } else if (!activeTimetableId || !timetables.some(t => t.id === activeTimetableId)) {
        setActiveTimetableId(timetables[0]?.id || null);
    }
  }, [timetables, activeTimetableId, setTimetables, setActiveTimetableId]);


  const updateTimetable = (timetableId: string, updates: Partial<Timetable>) => {
      setTimetables(prev => prev.map(t => t.id === timetableId ? { ...t, ...updates } : t));
  }

  const addTimetable = (name: string) => {
      const newTimetable = createNewTimetable(name);
      setTimetables(prev => [...prev, newTimetable]);
      setActiveTimetableId(newTimetable.id);
  }

  const removeTimetable = (timetableId: string) => {
      setTimetables(prev => {
          const newTimetables = prev.filter(t => t.id !== timetableId);
          if (activeTimetableId === timetableId) {
              setActiveTimetableId(newTimetables[0]?.id || null);
          }
          return newTimetables;
      });
      setAllTeachers(prev => prev.map(teacher => ({
        ...teacher,
        schoolSections: teacher.schoolSections.filter(id => id !== timetableId)
      })));
  }
  
  const renameTimetable = (timetableId: string, newName: string) => {
      updateTimetable(timetableId, { name: newName });
  }

  const addTeacher = (teacherData: Teacher) => {
    setAllTeachers(prev => [...prev, teacherData]);
    teacherData.schoolSections.forEach(timetableId => {
        const timetable = timetables.find(t => t.id === timetableId);
        if (timetable) {
          updateTimetable(timetableId, { timetable: {}, conflicts: [] });
        }
    })
  };

  const removeTeacher = (teacherId: string) => {
    const teacher = allTeachers.find(t => t.id === teacherId);
    if (teacher) {
        teacher.schoolSections.forEach(timetableId => {
             const timetable = timetables.find(t => t.id === timetableId);
             if (timetable) {
               updateTimetable(timetableId, { timetable: {}, conflicts: [] });
             }
        });
    }
    setAllTeachers(prev => prev.filter(t => t.id !== teacherId));
  };
  
  const updateTeacher = (teacherData: Teacher) => {
    const oldTeacher = allTeachers.find(t => t.id === teacherData.id);
    setAllTeachers(prev => prev.map(t => t.id === teacherData.id ? teacherData : t));
    
    const allInvolvedSections = new Set([...(oldTeacher?.schoolSections || []), ...teacherData.schoolSections]);
    
    allInvolvedSections.forEach(timetableId => {
        const timetable = timetables.find(t => t.id === timetableId);
        if (timetable) {
          updateTimetable(timetableId, { timetable: {}, conflicts: [] });
        }
    });
  };

  const activeTimetable = timetables.find(t => t.id === activeTimetableId) || null;
  const activeTeachers = activeTimetable ? allTeachers.filter(t => t.schoolSections.includes(activeTimetable.id)) : [];

  const generateTimetable = useCallback(() => {
    if(!activeTimetable) return;

    const classSet = new Set<string>();
    const requiredSessions: { [key: string]: { subject: string; teacher: string }[] } = {};

    activeTeachers.forEach(teacher => {
        teacher.subjects.forEach(subject => {
            subject.assignments.forEach(assignment => {
                if (assignment.grades.length === 0 || assignment.arms.length === 0) return;

                const processClass = (className: string, periods: number) => {
                    classSet.add(className);
                    if (!requiredSessions[className]) {
                        requiredSessions[className] = [];
                    }
                    for (let i = 0; i < periods; i++) {
                        requiredSessions[className].push({ subject: subject.name, teacher: teacher.name });
                    }
                };

                if (assignment.groupArms) {
                    assignment.grades.forEach(grade => {
                        const className = `${grade} ${assignment.arms.join(', ')}`;
                        processClass(className, assignment.periods);
                    });
                } else {
                    assignment.grades.forEach(grade => {
                        assignment.arms.forEach(arm => {
                            const className = `${grade} ${arm}`;
                            processClass(className, assignment.periods);
                        });
                    });
                }
            });
        });
    });

    const sortedClasses = Array.from(classSet).sort();

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
    
    sessionsToPlace.sort((a, b) => (b.isDouble ? 1 : 0) - (a.isDouble ? 1 : 0));
    
    const newTimetable: TimetableData = {};
    DEFAULT_DAYS.forEach(day => { newTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods();

    function solve(board: TimetableData, sessions: TimetableSession[]): TimetableData | null {
        if (sessions.length === 0) return board;

        const session = sessions[0];
        const remainingSessions = sessions.slice(1);
        
        const dayUsage = DEFAULT_DAYS.map(day => ({ day, count: board[day].flat().filter(s => s.className === session.className && s.subject === session.subject).length }));
        const shuffledDays = dayUsage.sort((a, b) => a.count - b.count).map(d => d.day);

        for (const day of shuffledDays) {
            if (session.isDouble) {
                const partner = remainingSessions.find(s => s.id === session.id);
                if (!partner) continue;

                const otherSessions = remainingSessions.filter(s => s.id !== session.id);
                const shuffledConsecutive = CONSECUTIVE_PERIODS.slice().sort(() => Math.random() - 0.5);

                for (const [p1, p2] of shuffledConsecutive) {
                    if (isValidPlacement(board, session, day, p1) && isValidPlacement(board, partner, day, p2)) {
                        board[day][p1].push(session);
                        board[day][p2].push(partner);
                        
                        const result = solve(board, otherSessions);
                        if (result) return result;

                        board[day][p1] = board[day][p1].filter(s => s.id !== session.id);
                        board[day][p2] = board[day][p2].filter(s => s.id !== partner.id);
                    }
                }
            } else {
                 const shuffledPeriods = Array.from({length: PERIOD_COUNT}, (_, i) => i).sort(() => Math.random() - 0.5);
                 for (const period of shuffledPeriods) {
                    if (isValidPlacement(board, session, day, period)) {
                        board[day][period].push(session);
                        const result = solve(board, remainingSessions);
                        if (result) return result;
                        board[day][period] = board[day][period].filter(s => s.id !== session.id);
                    }
                }
            }
        }
        return null;
    }

    function isValidPlacement(board: TimetableData, session: TimetableSession, day: string, period: number): boolean {
        const slot = board[day]?.[period];
        if (!slot || slot.some(s => s.teacher === session.teacher) || slot.some(s => s.className === session.className)) return false;

        const daySessions = board[day].flat();
        
        if (session.isDouble && daySessions.some(s => s.className === session.className && s.isDouble && s.id !== session.id)) return false;

        const subjectPeriodsOnDay = daySessions.filter(s => s.className === session.className && s.subject === session.subject).length;
        if ( (session.isDouble && subjectPeriodsOnDay > 0) || (!session.isDouble && subjectPeriodsOnDay >= 2)) return false;

        return true;
    }
    
    let finalTimetable = solve(newTimetable, sessionsToPlace);
    
    if (!finalTimetable) {
        finalTimetable = newTimetable; // reset board
        const placedIds = new Set<string>();
        sessionsToPlace.forEach(session => {
             if (placedIds.has(session.id)) return;
             
             let placed = false;
             for (const day of DEFAULT_DAYS) {
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

    updateTimetable(activeTimetable.id, { 
        timetable: finalTimetable || newTimetable,
        classes: sortedClasses,
        days: DEFAULT_DAYS,
        timeSlots: DEFAULT_TIME_SLOTS
    });
  }, [activeTimetable, activeTeachers]);


  const clearTimetable = () => {
    if (!activeTimetable) return;
    updateTimetable(activeTimetable.id, { timetable: {}, classes: [], conflicts: [] });
  }
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    if (!activeTimetable) return;

    const newTimetableData = JSON.parse(JSON.stringify(activeTimetable.timetable));
    
    const fromSlot = newTimetableData[from.day]?.[from.period];
    if (fromSlot) {
        const sessionIndex = fromSlot.findIndex((s: TimetableSession) => s.id === session.id && s.part === session.part);
        if (sessionIndex > -1) {
            fromSlot.splice(sessionIndex, 1);
        }
    }

    const toSlot = newTimetableData[to.day]?.[to.period];
    if (toSlot) {
        toSlot.push(session);
    }

    updateTimetable(activeTimetable.id, { timetable: newTimetableData });
  }

  const resolveConflicts = () => {
    if (!activeTimetable?.timetable) return;

    const currentTimetable = activeTimetable.timetable;
    const newTimetable = JSON.parse(JSON.stringify(currentTimetable));
    const allSessions: TimetableSession[] = [];
    Object.values(newTimetable).forEach((day: any) => day.forEach((slot: TimetableSession[]) => allSessions.push(...slot)));

    const emptyTimetable: TimetableData = {};
    DEFAULT_DAYS.forEach(day => { emptyTimetable[day] = Array.from({ length: PERIOD_COUNT }, () => []); });
    
    const placedSessionIds = new Set<string>();
    const CONSECUTIVE_PERIODS = getConsecutivePeriods();

    allSessions.sort((a,b) => (b.isDouble ? 1:0) - (a.isDouble ? 1:0));

    allSessions.forEach(session => {
        if (session.isDouble) {
            if (placedSessionIds.has(session.id)) return;
            
            const partner = allSessions.find(s => s.id === session.id && s.part !== session.part);
            if (!partner) return;

            let moved = false;
            for (const day of DEFAULT_DAYS) {
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

             if (!moved) {
                 for (const day of DEFAULT_DAYS) {
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
        for (const day of DEFAULT_DAYS) {
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

        if (!moved) {
            for (const day of DEFAULT_DAYS) {
                for (let period = 0; period < PERIOD_COUNT; period++) {
                     if (emptyTimetable[day][period].length < 2) {
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
    updateTimetable(activeTimetable.id, { timetable: emptyTimetable });
};

  useEffect(() => {
    timetables.forEach(timetable => {
        if (!timetable || !timetable.id || Object.keys(timetable.timetable).length === 0) {
            if (timetable && timetable.id && timetable.conflicts.length > 0) updateTimetable(timetable.id, { conflicts: [] });
            return;
        }

        const identifiedConflicts = new Map<string, Conflict>();
        const CONSECUTIVE_PERIODS = getConsecutivePeriods();

        for (const day of timetable.days) {
            for (let period = 0; period < PERIOD_COUNT; period++) {
                const slotSessions = timetable.timetable[day]?.[period];
                if (!slotSessions || slotSessions.length <= 1) continue;

                const teachersInSlot = new Set<string>();
                const classesInSlot = new Set<string>();
                
                for (const session of slotSessions) {
                    if (teachersInSlot.has(session.teacher)) {
                        slotSessions.forEach(s => {
                            if (s.teacher === session.teacher) identifiedConflicts.set(s.id, { id: s.id, type: 'teacher', message: `Teacher ${s.teacher} is double-booked.` });
                        });
                    }
                    teachersInSlot.add(session.teacher);

                    if (classesInSlot.has(session.className)) {
                        slotSessions.forEach(s => {
                            if (s.className === session.className) identifiedConflicts.set(s.id, { id: s.id, type: 'class', message: `Class ${s.className} is double-booked.` });
                        });
                    }
                    classesInSlot.add(session.className);
                }
            }
        }
        
        const doublePeriodParts = new Map<string, {session: TimetableSession, day: string, period: number}>();
        for (const day of timetable.days) {
            for (let period = 0; period < PERIOD_COUNT; period++) {
                const slotSessions = timetable.timetable[day]?.[period] || [];
                for (const session of slotSessions) {
                    if (session.isDouble) {
                        const key = `${session.id}-${session.part}`;
                        doublePeriodParts.set(key, { session, day, period });
                    }
                }
            }
        }

        const checkedDoubles = new Set<string>();
        doublePeriodParts.forEach(({session}) => {
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
                identifiedConflicts.set(session.id, { id: session.id, type: 'class', message: `Incomplete double period for ${session.subject}.` });
            }
        });

        const newConflicts = Array.from(identifiedConflicts.values());
        if (JSON.stringify(newConflicts) !== JSON.stringify(timetable.conflicts)) {
            updateTimetable(timetable.id, { conflicts: newConflicts });
        }
    });

  }, [timetables, setTimetables]);

  const isConflict = (sessionId: string) => {
    return activeTimetable?.conflicts.some(c => c.id === sessionId) || false;
  }
  
  const augmentedActiveTimetable = activeTimetable ? {
      ...activeTimetable,
      teachers: activeTeachers,
  } : null;

  return (
    <TimetableContext.Provider
      value={{
        timetables,
        activeTimetable: augmentedActiveTimetable,
        allTeachers,
        addTimetable,
        removeTimetable,
        renameTimetable,
        setActiveTimetableId,
        addTeacher,
        removeTeacher,
        updateTeacher,
        generateTimetable,
        clearTimetable,
        moveSession,
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


