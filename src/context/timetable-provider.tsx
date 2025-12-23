
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from "react";
import type { Teacher, TimetableData, TimetableSession, Conflict, TimeSlot, Timetable, ViewMode, SubjectAssignment } from "@/lib/types";

type TimetableContextType = {
  timetables: Timetable[];
  activeTimetable: Timetable | null;
  activeTimetableId: string | null;
  allTeachers: Teacher[];
  addTimetable: (name: string) => void;
  removeTimetable: (timetableId: string) => void;
  renameTimetable: (timetableId: string, newName: string) => void;
  setActiveTimetableId: (id: string | null) => void;

  addTeacher: (teacherData: Omit<Teacher, 'assignments'> & { assignments: Omit<SubjectAssignment, 'id'>[] }) => void;
  removeTeacher: (teacherId: string) => void;
  updateTeacher: (teacherData: Omit<Teacher, 'assignments'> & { assignments: Omit<SubjectAssignment, 'id'>[] }) => void;
  
  generateTimetable: () => void;
  clearTimetable: () => void;
  moveSession: (session: TimetableSession, from: { day: string; period: number }, to: { day: string; period: number }) => void;
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
  const [timetables, setTimetables] = usePersistentState<Timetable[]>("timetables_data_v13", []);
  const [allTeachers, setAllTeachers] = usePersistentState<Teacher[]>("all_teachers_v13", []);
  const [activeTimetableId, setActiveTimetableId] = usePersistentState<string | null>("active_timetable_id_v13", null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode_v13', 'class');
  
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


  const updateTimetable = useCallback((timetableId: string, updates: Partial<Timetable>) => {
      setTimetables(prev => prev.map(t => t.id === timetableId ? { ...t, ...updates } : t));
  }, [setTimetables]);

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

  const addTeacher = useCallback((teacherData: Omit<Teacher, 'id' | 'assignments'> & { assignments: Omit<SubjectAssignment, 'id'>[] }) => {
    const newTeacher: Teacher = {
        id: crypto.randomUUID(),
        name: teacherData.name,
        assignments: teacherData.assignments.map(a => ({...a, id: crypto.randomUUID()})),
    };
    setAllTeachers(prev => [...prev, newTeacher]);
    const schoolIds = new Set(newTeacher.assignments.map(a => a.schoolId));
    schoolIds.forEach(schoolId => {
        resetTimetableForSchool(schoolId);
    });
  }, [setAllTeachers, resetTimetableForSchool]);

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

  const activeTimetable = useMemo(() => {
    const currentTimetable = timetables.find(t => t.id === activeTimetableId);
    return currentTimetable || null;
  }, [activeTimetableId, timetables]);


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

    const activeTeachers = allTeachers.filter(t => t.assignments.some(a => a.schoolId === activeTimetable.id));
    const { timeSlots, days, name: schoolName, id: schoolId } = activeTimetable;
    const periodCount = timeSlots.filter(ts => !ts.isBreak).length;

    const allRequiredSessions: (SubjectAssignment & { teacher: string })[] = [];
    activeTeachers.forEach(teacher => {
        teacher.assignments.forEach(assignment => {
            if (assignment.schoolId !== schoolId || assignment.subject.toLowerCase() === 'assembly') return;
            allRequiredSessions.push({ ...assignment, teacher: teacher.name });
        });
    });

    const sessionsToPlace: PlacementUnit[] = [];
    const classSet = new Set<string>();

    const coreAssignments = allRequiredSessions.filter(req => !req.optionGroup);
    coreAssignments.forEach(req => {
        const className = `${req.grades[0]} ${req.arms[0] || ''}`.trim();
        classSet.add(className);
        let remainingPeriods = req.periods;
        while (remainingPeriods >= 2) {
            const doubleId = crypto.randomUUID();
            const sessionPart1: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: true, part: 1, isCore: req.isCore, optionGroup: req.optionGroup };
            const sessionPart2: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: true, part: 2, isCore: req.isCore, optionGroup: req.optionGroup };
            sessionsToPlace.push({ session: sessionPart1, partner: sessionPart2 });
            remainingPeriods -= 2;
        }
        for (let i = 0; i < remainingPeriods; i++) {
            sessionsToPlace.push({ id: crypto.randomUUID(), subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: false, isCore: req.isCore, optionGroup: req.optionGroup });
        }
    });

    const optionalAssignments = allRequiredSessions.filter(req => req.optionGroup);
    const optionGroupsByPeriod = new Map<string, Map<number, TimetableSession[]>>();

    optionalAssignments.forEach(assign => {
      const groupKey = assign.optionGroup!;
      const className = `${assign.grades[0]} ${assign.arms[0] || ''}`.trim();
      classSet.add(className);
      for (let i = 0; i < assign.periods; i++) {
        if (!optionGroupsByPeriod.has(groupKey)) {
          optionGroupsByPeriod.set(groupKey, new Map());
        }
        const groupPeriodMap = optionGroupsByPeriod.get(groupKey)!;
        if (!groupPeriodMap.has(i)) {
          groupPeriodMap.set(i, []);
        }
        const periodBlock = groupPeriodMap.get(i)!;
        periodBlock.push({
          id: crypto.randomUUID(),
          subject: `Option ${groupKey}`,
          actualSubject: assign.subject,
          teacher: assign.teacher,
          className: className,
          classes: [className],
          isDouble: false,
          isCore: false,
          optionGroup: assign.optionGroup,
        });
      }
    });

    optionGroupsByPeriod.forEach((periodMap) => {
        periodMap.forEach((block) => {
            if (block.length > 0) {
                sessionsToPlace.push(block);
            }
        });
    });

    sessionsToPlace.sort((a, b) => {
        const sizeA = Array.isArray(a) ? a.length : (('session' in a) ? 2 : 1);
        const sizeB = Array.isArray(b) ? b.length : (('session' in b) ? 2 : 1);
        if (sizeB !== sizeA) return sizeB - sizeA;

        const isCoreA = (Array.isArray(a) ? (a[0]?.isCore) : ('session' in a ? a.session.isCore : a.isCore)) || false;
        const isCoreB = (Array.isArray(b) ? (b[0]?.isCore) : ('session' in b ? b.session.isCore : b.isCore)) || false;

        if (isCoreA && !isCoreB) return -1;
        if (!isCoreA && isCoreB) return 1;

        return 0;
    });

    const sortedClasses = Array.from(classSet).sort();
    
    const newTimetable: TimetableData = {};
    days.forEach(day => { newTimetable[day] = Array.from({ length: periodCount }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods(timeSlots);
    const isSecondary = schoolName.toLowerCase().includes('secondary');

    function isValidPlacement(board: TimetableData, session: TimetableSession, day: string, period: number): boolean {
        const slot = board[day]?.[period];
        if (!slot) return false;
    
        if (slot.some(s => s.teacher === session.teacher)) {
            return false; // Teacher clash
        }
    
        for (const c of session.classes) {
            if (slot.some(s => s.classes.includes(c))) {
                return false; // Class clash
            }
        }
    
        const subjectToCheck = session.optionGroup ? session.subject : session.actualSubject || session.subject;
        for (const classToCheck of session.classes) {
            for (const existingPeriod of board[day]) {
                for (const existingSession of existingPeriod) {
                    if (existingSession.classes.includes(classToCheck)) {
                        const existingSubject = existingSession.optionGroup ? existingSession.subject : existingSession.actualSubject || existingSession.subject;
                        if (existingSubject === subjectToCheck) {
                            if (!session.isDouble && !existingSession.isDouble) {
                                return false; // Same single subject on same day for same class
                            }
                            if (session.id !== existingSession.id) {
                                return false; // Different sessions of the same subject
                            }
                        }
                    }
                }
            }
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
                if (!isValidPlacement(board, session, day, 0) && !isValidPlacement(board, partner, day, 0)) continue;

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
        } else if (Array.isArray(unit)) { // Option group block
            const sessionGroup = unit as TimetableSession[];
            if (sessionGroup.length === 0) return solve(board, remainingUnits);
            
            const shuffledPeriods = Array.from({ length: periodCount }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const day of shuffledDays) {
                if (sessionGroup.some(s => !isValidPlacement(board, s, day, 0))) continue;

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
        }
        else { // Single Session
            const session = unit as TimetableSession;
            const shuffledPeriods = Array.from({ length: periodCount }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const day of shuffledDays) {
                if (!isValidPlacement(board, session, day, 0)) continue;
                
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
  }, [updateTimetable, activeTimetable, allTeachers]);


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
    if (!activeTimetable || !activeTimetable.conflicts || activeTimetable.conflicts.length === 0) return;

    const newTimetable = JSON.parse(JSON.stringify(activeTimetable.timetable));
    const conflictIds = new Set(activeTimetable.conflicts.map(c => c.id));

    for (const day in newTimetable) {
        for (const period of newTimetable[day]) {
            for (let i = period.length - 1; i >= 0; i--) {
                if (conflictIds.has(period[i].id)) {
                    period.splice(i, 1);
                }
            }
        }
    }
    updateTimetable(activeTimetable.id, { timetable: newTimetable, conflicts: [] });
  };

  useEffect(() => {
    if (!activeTimetable) return;

    if (!activeTimetable.timetable || Object.keys(activeTimetable.timetable).length === 0) {
        if(activeTimetable.conflicts.length > 0) {
            updateTimetable(activeTimetable.id, { conflicts: [] });
        }
        return;
    }
    
    const currentConflicts = activeTimetable.conflicts || [];
    if (currentConflicts.length > 0) {
        updateTimetable(activeTimetable.id, { conflicts: [] });
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimetable?.timetable]);


  const isConflict = (sessionId: string) => {
    if (!activeTimetable || !activeTimetable.conflicts) return false;
    return activeTimetable.conflicts.some(c => c.id === sessionId);
  }
  
  return (
    <TimetableContext.Provider
      value={{
        timetables,
        activeTimetable,
        activeTimetableId,
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

    