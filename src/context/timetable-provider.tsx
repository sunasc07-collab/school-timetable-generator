
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import type { Teacher, TimetableData, TimetableSession, Conflict, TimeSlot, Timetable, ViewMode, SubjectAssignment } from "@/lib/types";

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
    { period: null, time: '10:00-10:20', isBreak: true, label: 'SHORT-BREAK' },
    { period: 4, time: '10:20-11:00' },
    { period: 5, time: '11:00-11:40' },
    { period: 6, time: '11:40-12:20' },
    { period: null, time: '12:20-13:00', isBreak: true, label: 'LUNCH' },
    { period: 7, time: '13:00-13:40' },
    { period: 8, time: '13:40-14:20' },
    { period: 9, time: '14:20-15:00' },
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

type PlacementUnit = TimetableSession | TimetableSession[] | { session: TimetableSession; partner: TimetableSession };

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [timetables, setTimetables] = usePersistentState<Timetable[]>("timetables_data_v11", []);
  const [allTeachers, setAllTeachers] = usePersistentState<Teacher[]>("all_teachers_v11", []);
  const [activeTimetableId, setActiveTimetableId] = usePersistentState<string | null>("active_timetable_id_v11", null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode_v11', 'class');
  
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

    const allRequiredSessions: (SubjectAssignment & { teacher: string })[] = [];
    
    teachers.forEach(teacher => {
        teacher.assignments.forEach(assignment => {
            if (assignment.schoolId !== schoolId) return;
            if (assignment.subject.toLowerCase() === 'assembly') return;

            allRequiredSessions.push({ ...assignment, teacher: teacher.name });
        });
    });
    
    const sessionsToPlace: PlacementUnit[] = [];
    const optionGroups = new Map<string, TimetableSession[]>();
    const singleSessions: TimetableSession[] = [];
    const doubleSessionPairs = new Map<string, { part1?: TimetableSession, part2?: TimetableSession}>();

    allRequiredSessions.forEach(req => {
        const { subject, teacher, periods, grades, arms, isCore, optionGroup } = req;
        grades.forEach(grade => {
            const classArms = arms && arms.length > 0 ? arms : [''];
            classArms.forEach(arm => {
                const className = `${grade} ${arm}`.trim();
                let remainingPeriods = periods;
                
                if (optionGroup) {
                    const groupKey = `${className}-${optionGroup}`;
                    if (!optionGroups.has(groupKey)) {
                        optionGroups.set(groupKey, []);
                    }
                     optionGroups.get(groupKey)!.push({
                         id: crypto.randomUUID(), subject, teacher, className, classes: [className], isDouble: false, isCore, optionGroup
                    });
                    
                    return; // Handled by option group logic
                }
                
                while (remainingPeriods >= 2) {
                    const doubleId = crypto.randomUUID();
                    if (!doubleSessionPairs.has(doubleId)) doubleSessionPairs.set(doubleId, {});
                    doubleSessionPairs.get(doubleId)!.part1 = { id: doubleId, subject, teacher, className, classes: [className], isDouble: true, part: 1, isCore, optionGroup };
                    doubleSessionPairs.get(doubleId)!.part2 = { id: doubleId, subject, teacher, className, classes: [className], isDouble: true, part: 2, isCore, optionGroup };
                    remainingPeriods -= 2;
                }

                for (let i = 0; i < remainingPeriods; i++) {
                    singleSessions.push({ id: crypto.randomUUID(), subject, teacher, className, classes: [className], isDouble: false, isCore, optionGroup });
                }
            });
        });
    });

    doubleSessionPairs.forEach(pair => {
      if(pair.part1 && pair.part2) {
        sessionsToPlace.push({ session: pair.part1, partner: pair.part2 });
      }
    });
    
    optionGroups.forEach((group) => {
        if(group.length > 0) {
            sessionsToPlace.push(group);
        }
    });

    sessionsToPlace.push(...singleSessions);

    sessionsToPlace.sort((a,b) => {
        const sizeA = Array.isArray(a) ? a.length : (('session' in a) ? 2 : 1);
        const sizeB = Array.isArray(b) ? b.length : (('session' in b) ? 2 : 1);
        return sizeB - sizeA;
    });

    const classSet = new Set<string>();
    allRequiredSessions.forEach(req => {
        req.grades.forEach(grade => {
            const classArms = req.arms && req.arms.length > 0 ? req.arms : [''];
            classArms.forEach(arm => {
                const className = `${grade} ${arm}`.trim();
                classSet.add(className);
            });
        });
    });
    const sortedClasses = Array.from(classSet).sort();
    
    const newTimetable: TimetableData = {};
    days.forEach(day => { newTimetable[day] = Array.from({ length: periodCount }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods(timeSlots);
    const lastTwoPeriods = [periodCount - 2, periodCount - 1];
    const isSecondary = schoolName.toLowerCase().includes('secondary');

    function isValidPlacement(board: TimetableData, session: TimetableSession, day: string, period: number): boolean {
        const slot = board[day]?.[period];
        if (!slot) return false;
        
        // 1. Teacher conflict
        if (slot.some(s => s.teacher === session.teacher)) {
            return false;
        }

        // 2. Class conflict
        const sessionsForClass = slot.filter(s => s.className === session.className);
        
        // A core subject is being placed
        if (session.isCore) {
            if (sessionsForClass.length > 0) return false;
        } 
        // An optional subject is being placed
        else if (session.optionGroup) {
            // Can't place if a core subject is already there
            if (sessionsForClass.some(s => s.isCore)) return false;
            // Can't place if another subject from the same option group is there
            if (sessionsForClass.some(s => s.optionGroup === session.optionGroup)) return false;
        }
        // A non-core, non-optional subject is being placed (treat like core)
        else {
             if (sessionsForClass.length > 0) return false;
        }
        
        // 3. Subject per day limit
        const subjectsOnDayForClass = board[day].flat().filter(s => s.className === session.className && s.subject === session.subject);
        if (subjectsOnDayForClass.length >= 2) {
             return false;
        }

        return true;
    }
    
    function solve(board: TimetableData, units: PlacementUnit[]): [boolean, TimetableData] {
        if (units.length === 0) return [true, board];

        const unit = units[0];
        const remainingUnits = units.slice(1);
        const shuffledDays = [...days].sort(() => Math.random() - 0.5);

        if ('session' in unit) { // Double Period
            const { session, partner } = unit;
            const shuffledConsecutive = [...CONSECUTIVE_PERIODS].sort(() => Math.random() - 0.5);

            for (const day of shuffledDays) {
                for (const [p1, p2] of shuffledConsecutive) {
                    if (isValidPlacement(board, session, day, p1) && isValidPlacement(board, partner, day, p2)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][p1].push(session);
                        newBoard[day][p2].push(partner);
                        const [solved, finalBoard] = solve(newBoard, remainingUnits);
                        if (solved) return [true, finalBoard];
                    }
                }
            }
        } else if (Array.isArray(unit)) { // Optional Group
            const sessionGroup = unit as TimetableSession[];
            if (sessionGroup.length === 0) return solve(board, remainingUnits);

            const shuffledPeriods = Array.from({ length: periodCount }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const day of shuffledDays) {
                for (const period of shuffledPeriods) {
                    const canPlaceGroup = sessionGroup.every(session => isValidPlacement(board, session, day, period));
                    if (canPlaceGroup) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        sessionGroup.forEach(session => newBoard[day][period].push(session));
                        const [solved, finalBoard] = solve(newBoard, remainingUnits);
                        if (solved) return [true, finalBoard];
                    }
                }
            }
        } else { // Single Session
            const session = unit as TimetableSession;
            const shuffledPeriods = Array.from({ length: periodCount }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const day of shuffledDays) {
                for (const period of shuffledPeriods) {
                    if (isValidPlacement(board, session, day, period)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][period].push(session);
                        const [solved, finalBoard] = solve(newBoard, remainingUnits);
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
        console.error("Solver failed. Not all sessions could be placed.");
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
  }, [activeTimetable]);


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
          return !slot.some(s => s.subject === 'Assembly');
        }

        const sessionsForClassInSlot = slot.filter(s => s.className === session.className);
        if (sessionsForClassInSlot.length > 0) {
            const isPlacingCore = session.isCore || !session.optionGroup;
            const hasCoreInSlot = sessionsForClassInSlot.some(s => s.isCore || !s.optionGroup);

            if (isPlacingCore || hasCoreInSlot) {
                return false;
            }
            
            const optionGroupsInSlot = new Set(sessionsForClassInSlot.map(s => s.optionGroup).filter(Boolean));
            if (session.optionGroup && optionGroupsInSlot.has(session.optionGroup)) {
                return false;
            }
        }
        
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
        if (timetable && timetable.id && timetable.conflicts.length > 0) {
            updateTimetable(timetable.id, { conflicts: [] });
        }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetables]);

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

    


    