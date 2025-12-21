
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import type { Teacher, TimetableData, TimetableSession, Conflict, TimeSlot, Timetable, ViewMode } from "@/lib/types";

type TimetableContextType = {
  timetables: Timetable[];
  activeTimetable: (Timetable & { teachers: Teacher[] }) | null;
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

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_TIMESLOTS: TimeSlot[] = [
    { period: 1, time: '8:00-8:40' },
    { period: 2, time: '8:40-9:20' },
    { period: 3, time: '9:20-10:00' },
    { period: 4, time: '10:00-10:20', isBreak: true, label: 'SHORT-BREAK' },
    { period: 5, time: '10:20-11:00' },
    { period: 6, time: '11:00-11:40' },
    { period: 7, time: '11:40-12:20' },
    { period: null, time: '12:20-13:10', isBreak: true, label: 'LUNCH' },
    { period: 8, time: '13:10-13:50' },
    { period: 9, time: '13:50-14:20' },
    { period: 10, time: '14:20-14:50' },
];

const usePersistentState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
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

const createNewTimetable = (name: string, id?: string): Timetable => {
    return {
        id: id || crypto.randomUUID(),
        name,
        timetable: {},
        classes: [],
        conflicts: [],
        days: DEFAULT_DAYS,
        timeSlots: DEFAULT_TIMESLOTS,
    };
}

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [timetables, setTimetables] = usePersistentState<Timetable[]>("timetables_data_v10", []);
  const [allTeachers, setAllTeachers] = usePersistentState<Teacher[]>("all_teachers_v10", []);
  const [activeTimetableId, setActiveTimetableId] = usePersistentState<string | null>("active_timetable_id_v10", null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode_v10', 'class');
  
  useEffect(() => {
    setTimetables(prev => 
      prev.map(t => ({
        ...t,
        timeSlots: DEFAULT_TIMESLOTS,
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const resetTimetableForSchool = useCallback((schoolId: string) => {
    setTimetables(prev => {
        const schoolExists = prev.some(t => t.id === schoolId);
        if (!schoolExists) return prev;

        return prev.map(t => {
            if (t.id === schoolId) {
                return {
                  ...t,
                  timetable: {},
                  classes: [],
                  conflicts: [],
                };
            }
            return t;
        });
    });
  }, [setTimetables]);


  useEffect(() => {
    if (timetables.length === 0) {
        const defaultTimetable = createNewTimetable("New School");
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
      setAllTeachers(prev => {
          return prev.map(teacher => ({
              ...teacher,
              assignments: teacher.assignments.filter(a => a.schoolId !== timetableId)
          })).filter(teacher => teacher.assignments.length > 0);
      });
      setTimetables(prev => {
          const newTimetables = prev.filter(t => t.id !== timetableId);
          if (activeTimetableId === timetableId) {
              setActiveTimetableId(newTimetables[0]?.id || null);
          }
          return newTimetables;
      });
  }
  
  const renameTimetable = (timetableId: string, newName: string) => {
      updateTimetable(timetableId, { name: newName });
  }

  const addTeacher = useCallback((teacherData: Teacher) => {
    setAllTeachers(prev => [...prev, teacherData]);
    const schoolIds = new Set(teacherData.assignments.map(a => a.schoolId));
    schoolIds.forEach(schoolId => {
        resetTimetableForSchool(schoolId);
    });
  }, [setAllTeachers, resetTimetableForSchool]);

  const removeTeacher = useCallback((teacherId: string) => {
    const teacher = allTeachers.find(t => t.id === teacherId);
    if (teacher) {
        const schoolIds = new Set(teacher.assignments.map(a => a.schoolId));
        schoolIds.forEach(schoolId => {
            resetTimetableForSchool(schoolId);
        });
    }
    setAllTeachers(prev => prev.filter(t => t.id !== teacherId));
  }, [allTeachers, setAllTeachers, resetTimetableForSchool]);
  
  const updateTeacher = useCallback((teacherData: Teacher) => {
    const oldTeacher = allTeachers.find(t => t.id === teacherData.id);
    const schoolIdsToReset = new Set<string>();

    teacherData.assignments.forEach(a => schoolIdsToReset.add(a.schoolId));
    oldTeacher?.assignments.forEach(a => schoolIdsToReset.add(a.schoolId));

    setAllTeachers(prev => prev.map(t => t.id === teacherData.id ? teacherData : t));

    schoolIdsToReset.forEach(schoolId => {
       resetTimetableForSchool(schoolId);
    });
  }, [allTeachers, setAllTeachers, resetTimetableForSchool]);


  const activeTimetableRaw = timetables.find(t => t.id === activeTimetableId) || null;
  const activeTeachers = activeTimetableRaw 
      ? allTeachers.filter(t => t.assignments.some(a => a.schoolId === activeTimetableRaw.id))
      : [];

  const activeTimetable = activeTimetableRaw ? {
      ...activeTimetableRaw,
      teachers: activeTeachers,
  } : null;

  const getConsecutivePeriods = (slots: TimeSlot[]): number[][] => {
    const consecutive: number[][] = [];
    const teachingPeriods: { originalIndex: number, newIndex: number}[] = [];
    let periodCounter = 0;
    slots.forEach((slot, originalIndex) => {
        if(!slot.isBreak) {
            teachingPeriods.push({ originalIndex: originalIndex, newIndex: periodCounter });
            periodCounter++;
        }
    });

    for(let i = 0; i < teachingPeriods.length - 1; i++){
        const current = teachingPeriods[i];
        const next = teachingPeriods[i+1];
        
        if (current.originalIndex + 1 === next.originalIndex) {
             consecutive.push([current.newIndex, next.newIndex]);
        }
    }
    return consecutive;
  }
  
  const generateTimetable = useCallback(() => {
    if (!activeTimetable) return;

    const { timeSlots, days, teachers, name: schoolName, id: schoolId } = activeTimetable;
    const periodCount = timeSlots.filter(ts => !ts.isBreak).length;

    const allRequiredSessions: { subject: string; teacher: string; className: string; periods: number; }[] = [];
    
    teachers.forEach(teacher => {
        teacher.assignments.forEach(assignment => {
            if (assignment.schoolId !== schoolId) return;

            const { grades, subject, periods } = assignment;
            if (!grades || grades.length === 0 || !subject || !periods || periods <= 0) return;
            
            if (subject.toLowerCase() === 'assembly') {
              return; // Assembly is handled separately
            }

            const arms = assignment.arms || [];
            grades.forEach(grade => {
                if (arms.length > 0) {
                    arms.forEach(arm => {
                        const className = `${grade} ${arm}`;
                        allRequiredSessions.push({ subject, teacher: teacher.name, className, periods });
                    });
                } else {
                    const className = grade;
                    allRequiredSessions.push({ subject, teacher: teacher.name, className, periods });
                }
            });
        });
    });


    const classSet = new Set<string>();
    allRequiredSessions.forEach(req => classSet.add(req.className));
    const sortedClasses = Array.from(classSet).sort();

    const sessionsToPlace: TimetableSession[] = [];
    allRequiredSessions.forEach(req => {
        let remainingPeriods = req.periods;
        while (remainingPeriods >= 2) {
            const doubleId = crypto.randomUUID();
            sessionsToPlace.push({ id: doubleId, subject: req.subject, teacher: req.teacher, className: req.className, classes: [req.className], isDouble: true, part: 1 });
            sessionsToPlace.push({ id: doubleId, subject: req.subject, teacher: req.teacher, className: req.className, classes: [req.className], isDouble: true, part: 2 });
            remainingPeriods -= 2;
        }
        if (remainingPeriods > 0) {
            sessionsToPlace.push({ id: crypto.randomUUID(), subject: req.subject, teacher: req.teacher, className: req.className, classes: [req.className], isDouble: false });
        }
    });

    sessionsToPlace.sort((a, b) => (b.isDouble ? 1 : 0) - (a.isDouble ? 1 : 0));

    const newTimetable: TimetableData = {};
    days.forEach(day => { newTimetable[day] = Array.from({ length: periodCount }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods(timeSlots);
    const lastTwoPeriods = [periodCount - 2, periodCount - 1];
    const isSecondary = schoolName.toLowerCase().includes('secondary');

    function isValidPlacement(board: TimetableData, session: TimetableSession, day: string, period: number): boolean {
        if (isSecondary && day === 'Fri' && lastTwoPeriods.includes(period) && session.subject.toLowerCase() !== 'sports') {
            return false;
        }

        const slot = board[day]?.[period];
        if (!slot) return false;

        if (slot.some(s => s.teacher === session.teacher)) return false;
        if (slot.some(s => s.className === session.className)) return false;

        const daySessionsForClass = board[day].flat().filter(s => s.className === session.className);
        const subjectPeriodsOnDay = daySessionsForClass.filter(s => s.subject === session.subject).length;

        if (session.isDouble && subjectPeriodsOnDay > 0) return false;
        if (!session.isDouble && subjectPeriodsOnDay >= 2) return false;

        return true;
    }
    
    function solve(board: TimetableData, sessions: TimetableSession[]): [boolean, TimetableData] {
        if (sessions.length === 0) {
            return [true, board];
        }

        const session = sessions[0];
        const shuffledDays = [...days].sort(() => Math.random() - 0.5);

        if (session.isDouble) {
            const partnerIndex = sessions.findIndex(s => s.id === session.id && s.part !== session.part);
            if (partnerIndex === -1) { 
                 const remainingSessions = sessions.slice(1);
                 return solve(board, remainingSessions);
            }
            const partner = sessions[partnerIndex];
            
            const otherSessions = sessions.filter((s, i) => i !== 0 && i !== partnerIndex);
            const shuffledConsecutive = [...CONSECUTIVE_PERIODS].sort(() => Math.random() - 0.5);

            for (const day of shuffledDays) {
                for (const [p1, p2] of shuffledConsecutive) {
                    if (isValidPlacement(board, session, day, p1) && isValidPlacement(board, partner, day, p2)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][p1].push(session);
                        newBoard[day][p2].push(partner);

                        const [solved, finalBoard] = solve(newBoard, otherSessions);
                        if (solved) return [true, finalBoard];
                    }
                }
            }
        } else { // Single session
            const remainingSessions = sessions.slice(1);
            const shuffledPeriods = Array.from({ length: periodCount }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const day of shuffledDays) {
                for (const period of shuffledPeriods) {
                    if (isValidPlacement(board, session, day, period)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][period].push(session);
                        
                        const [solved, finalBoard] = solve(newBoard, remainingSessions);
                        if (solved) return [true, finalBoard];
                    }
                }
            }
        }
        
        return [false, board];
    }
    
    let boardCopy = JSON.parse(JSON.stringify(newTimetable));
    const [isSolved, solvedBoard] = solve(boardCopy, sessionsToPlace);
    let finalTimetable = solvedBoard;
    
    if (!isSolved) {
        const placedSessionIds = new Set<string>();
        Object.values(finalTimetable).forEach(daySlots => daySlots.forEach(slot => slot.forEach(s => placedSessionIds.add(s.id))));
        
        const unplacedSessions = sessionsToPlace.filter(s => !placedSessionIds.has(s.id));
        
        unplacedSessions.forEach(session => {
            let placed = false;
             for (const day of days) {
                for (let period = 0; period < periodCount; period++) {
                     if (isSecondary && day === 'Fri' && lastTwoPeriods.includes(period)) continue;
                     if(finalTimetable[day][period].length === 0){
                        finalTimetable[day][period].push(session);
                        placed = true;
                        break;
                     }
                }
                if(placed) break;
            }
            if (!placed) {
                 for (const day of days) {
                    for (let period = 0; period < periodCount; period++) {
                        if (isSecondary && day === 'Fri' && lastTwoPeriods.includes(period)) continue;
                        finalTimetable[day][period].push(session);
                        placed = true;
                        break;
                    }
                    if (placed) break;
                }
            }
        });
    }

    if (finalTimetable && isSecondary) {
      sortedClasses.forEach(className => {
          if (!className.toLowerCase().includes('a-level')) {
              const sportsSession1: TimetableSession = {
                  id: `${crypto.randomUUID()}-sports-${className}`,
                  subject: 'Sports',
                  teacher: 'Sports Coach',
                  className: className,
                  classes: [className],
                  isDouble: true,
                  part: 1,
              };
              const sportsSession2: TimetableSession = {
                  id: sportsSession1.id,
                  subject: 'Sports',
                  teacher: 'Sports Coach',
                  className: className,
                  classes: [className],
                  isDouble: true,
                  part: 2,
              };
              if(finalTimetable['Fri']?.[periodCount-2] && finalTimetable['Fri']?.[periodCount-1]) {
                finalTimetable['Fri'][periodCount - 2].push(sportsSession1);
                finalTimetable['Fri'][periodCount - 1].push(sportsSession2);
              }
          }
      });
    }

    updateTimetable(activeTimetable.id, { 
        timetable: finalTimetable || {},
        classes: sortedClasses,
        conflicts: [],
    });
  }, [allTeachers, activeTimetable]);


  const clearTimetable = () => {
    if (!activeTimetable) return;
    updateTimetable(activeTimetable.id, { timetable: {}, classes: [], conflicts: [] });
  }
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    if (!activeTimetable?.timetable) return;

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
    if (!activeTimetable?.timetable || !activeTimetable.conflicts) return;
    const periodCount = activeTimetable.timeSlots.filter(ts => !ts.isBreak).length;
    const days = activeTimetable.days;

    const currentTimetable = JSON.parse(JSON.stringify(activeTimetable.timetable));
    const conflicts = activeTimetable.conflicts;
    const conflictingSessionIds = new Set(conflicts.map(c => c.id));

    const unplacedSessions: TimetableSession[] = [];
    const cleanTimetable: TimetableData = {};
    days.forEach(day => { cleanTimetable[day] = Array.from({ length: periodCount }, () => []); });

    days.forEach(day => {
        currentTimetable[day]?.forEach((slot: TimetableSession[], period: number) => {
            const validSessionsInSlot = slot.filter(session => !conflictingSessionIds.has(session.id));
            const conflictingSessionsInSlot = slot.filter(session => conflictingSessionIds.has(session.id));
            
            cleanTimetable[day][period] = validSessionsInSlot;
            unplacedSessions.push(...conflictingSessionsInSlot);
        });
    });

    const uniqueUnplaced = unplacedSessions.filter((session, index, self) =>
        index === self.findIndex((s) => (
            s.id === session.id && s.part === session.part
        ))
    );

    uniqueUnplaced.sort((a,b) => (b.isDouble ? 1:0) - (a.isDouble ? 1:0));

    const CONSECUTIVE_PERIODS = getConsecutivePeriods(activeTimetable.timeSlots);
    const lastTwoPeriods = [periodCount - 2, periodCount - 1];
    const isSecondarySchool = activeTimetable.name.toLowerCase().includes('secondary');

    function isValidPlacement(board: TimetableData, session: TimetableSession, day: string, period: number): boolean {
        if (isSecondarySchool && day === 'Fri' && lastTwoPeriods.includes(period) && session.subject.toLowerCase() !== 'sports') return false;

        const slot = board[day]?.[period];
        if (!slot) return false;
        if (slot.some(s => s.teacher === session.teacher && s.subject !== 'Assembly')) return false;
        
        if (session.subject === 'Assembly') {
          // Check if any other class is already having assembly
          return !slot.some(s => s.subject === 'Assembly');
        }

        if (slot.some(s => s.classes.some(c => session.classes.includes(c)))) return false;
        
        return true;
    }

    const placedIds = new Set<string>();

    uniqueUnplaced.forEach(session => {
        if (placedIds.has(session.id) || session.subject.toLowerCase() === 'sports') return;

        if (session.isDouble) {
            const partner = uniqueUnplaced.find(s => s.id === session.id && s.part !== session.part);
            if (!partner) return;

            let placed = false;
            for (const day of days) {
                for (const [p1, p2] of CONSECUTIVE_PERIODS) {
                    if (isValidPlacement(cleanTimetable, session, day, p1) && isValidPlacement(cleanTimetable, partner, day, p2)) {
                        cleanTimetable[day][p1].push(session);
                        cleanTimetable[day][p2].push(partner);
                        placedIds.add(session.id);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
        } else {
            let placed = false;
            for (const day of days) {
                for (let period = 0; period < periodCount; period++) {
                    if (isValidPlacement(cleanTimetable, session, day, period)) {
                        cleanTimetable[day][period].push(session);
                        placedIds.add(session.id);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
        }
    });

    updateTimetable(activeTimetable.id, { timetable: cleanTimetable });
};


  useEffect(() => {
    timetables.forEach(timetable => {
        if (!timetable || !timetable.id || timetable.timetable === null || Object.keys(timetable.timetable).length === 0) {
            if (timetable && timetable.id && timetable.conflicts.length > 0) updateTimetable(timetable.id, { conflicts: [] });
            return;
        }

        const identifiedConflicts = new Map<string, Conflict>();
        const CONSECUTIVE_PERIODS = getConsecutivePeriods(timetable.timeSlots);
        const periodCount = timetable.timeSlots.filter(ts => !ts.isBreak).length;

        for (const day of timetable.days) {
            for (let period = 0; period < periodCount; period++) {
                const slotSessions = timetable.timetable[day]?.[period];
                if (!slotSessions || slotSessions.length <= 1) continue;

                const teachersInSlot = new Set<string>();
                const classesInSlot = new Set<string>();
                
                for (const session of slotSessions) {
                    if (session.subject === 'Assembly') continue;

                    if (teachersInSlot.has(session.teacher)) {
                        slotSessions.forEach(s => {
                            if (s.teacher === session.teacher) identifiedConflicts.set(s.id, { id: s.id, type: 'teacher', message: `Teacher ${s.teacher} is double-booked.` });
                        });
                    }
                    teachersInSlot.add(session.teacher);

                    for (const c of session.classes) {
                         if (classesInSlot.has(c)) {
                            slotSessions.forEach(s => {
                                if (s.classes.includes(c)) {
                                    identifiedConflicts.set(s.id, { id: s.id, type: 'class', message: `Class ${c} is double-booked.` });
                                }
                            });
                        }
                        classesInSlot.add(c);
                    }
                }
            }
        }
        
        const doublePeriodParts = new Map<string, {session: TimetableSession, day: string, period: number}>();
        for (const day of timetable.days) {
            let periodIndex = 0;
            for (const slot of timetable.timeSlots) {
                if(slot.isBreak) continue;
                const slotSessions = timetable.timetable[day]?.[periodIndex] || [];
                for (const session of slotSessions) {
                    if (session.isDouble) {
                        const key = `${session.id}-${session.part}`;
                        doublePeriodParts.set(key, { session, day, period: periodIndex });
                    }
                }
                periodIndex++;
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
  
  return (
    <TimetableContext.Provider
      value={{
        timetables,
        activeTimetable,
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
