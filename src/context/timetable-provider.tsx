
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

  addTeacher: (teacherData: Teacher) => void;
  removeTeacher: (teacherId: string) => void;
  updateTeacher: (teacherData: Teacher) => void;
  
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

type SingleSessionUnit = TimetableSession;
type DoubleSessionUnit = { session: TimetableSession; partner: TimetableSession };
type OptionBlockUnit = TimetableSession[];
type PlacementUnit = SingleSessionUnit | DoubleSessionUnit | OptionBlockUnit;

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [timetables, setTimetables] = usePersistentState<Timetable[]>("timetables_data_v20", []);
  const [allTeachers, setAllTeachers] = usePersistentState<Teacher[]>("all_teachers_v20", []);
  const [activeTimetableId, setActiveTimetableId] = usePersistentState<string | null>("active_timetable_id_v20", null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode_v20', 'class');
  
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

  const processTeacherData = (teacherData: Teacher): Teacher => {
    const processedAssignments: SubjectAssignment[] = [];
    teacherData.assignments.forEach(assignment => {
        const grades = assignment.grades || [];
        const arms = assignment.arms && assignment.arms.length > 0 ? assignment.arms : [null];
        
        grades.forEach(grade => {
            arms.forEach(arm => {
                processedAssignments.push({
                    ...assignment,
                    id: crypto.randomUUID(),
                    grades: [grade],
                    arms: arm ? [arm] : [],
                });
            });
        });
    });

    return {
        ...teacherData,
        id: teacherData.id || crypto.randomUUID(),
        assignments: processedAssignments,
    };
  }

 const addTeacher = useCallback((teacherData: Teacher) => {
    const newTeacher = processTeacherData(teacherData);
    setAllTeachers(prev => [...prev, newTeacher]);
    const schoolIds = new Set(newTeacher.assignments.map(a => a.schoolId));
    schoolIds.forEach(schoolId => {
        resetTimetableForSchool(schoolId);
    });
}, [setAllTeachers, resetTimetableForSchool]);

const updateTeacher = useCallback((teacherData: Teacher) => {
    const oldTeacher = allTeachers.find(t => t.id === teacherData.id);
    const schoolIdsToReset = new Set<string>();

    const updatedTeacher = processTeacherData(teacherData);

    oldTeacher?.assignments.forEach(a => schoolIdsToReset.add(a.schoolId));
    updatedTeacher.assignments.forEach(a => schoolIdsToReset.add(a.schoolId));
    
    setAllTeachers(prev => prev.map(t => t.id === teacherData.id ? updatedTeacher : t));
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
    const classSet = new Set<string>();

    activeTeachers.forEach(teacher => {
        teacher.assignments.forEach(assignment => {
            if (assignment.schoolId !== schoolId || assignment.subject.toLowerCase() === 'assembly') return;

            const className = `${assignment.grades[0]} ${assignment.arms[0] || ''}`.trim();
            classSet.add(className);
            allRequiredSessions.push({ ...assignment, teacher: teacher.name });
        });
    });

    const singleSessions: SingleSessionUnit[] = [];
    const doubleSessions: DoubleSessionUnit[] = [];
    const optionalAssignments = allRequiredSessions.filter(req => req.optionGroup);
    const coreAssignments = allRequiredSessions.filter(req => !req.optionGroup);

    coreAssignments.forEach(req => {
        let remainingPeriods = req.periods;
        const className = `${req.grades[0]} ${req.arms[0] || ''}`.trim();
        
        while (remainingPeriods >= 2) {
            const doubleId = crypto.randomUUID();
            const sessionPart1: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: true, part: 1, isCore: req.isCore };
            const sessionPart2: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: true, part: 2, isCore: req.isCore };
            doubleSessions.push({ session: sessionPart1, partner: sessionPart2 });
            remainingPeriods -= 2;
        }
        for (let i = 0; i < remainingPeriods; i++) {
            singleSessions.push({ id: crypto.randomUUID(), subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: false, isCore: req.isCore });
        }
    });
    
    const optionBlocks: OptionBlockUnit[] = [];
    const conflicts: Conflict[] = [];
    
    const optionGroups = [...new Set(optionalAssignments.map(a => a.optionGroup))].filter(Boolean);

    optionGroups.forEach(group => {
      const assignmentsForGroup = optionalAssignments.filter(a => a.optionGroup === group);
      const maxPeriods = Math.max(...assignmentsForGroup.map(a => a.periods), 0);

      for (let i = 0; i < maxPeriods; i++) {
        const block: OptionBlockUnit = [];
        const teachersInBlock = new Set<string>();
        const classesInBlock = new Set<string>();
        const sessionsForThisPeriod = assignmentsForGroup.filter(a => i < a.periods);

        sessionsForThisPeriod.forEach(session => {
            if (!session) return; // Safeguard

            const className = `${session.grades[0]} ${session.arms[0] || ''}`.trim();

            if (teachersInBlock.has(session.teacher)) {
                conflicts.push({ id: session.id, type: 'teacher', message: `Teacher ${session.teacher} is double-booked in Option Group ${group}.`});
            }
            if (classesInBlock.has(className)) {
                conflicts.push({ id: session.id, type: 'class', message: `Class ${className} has multiple subjects in Option Group ${group}.`});
            }
            
            teachersInBlock.add(session.teacher);
            classesInBlock.add(className);

            block.push({
                id: session.id + `_period_${i}`,
                subject: `Option ${group}`,
                actualSubject: session.subject,
                teacher: session.teacher,
                className: className,
                classes: [className],
                isDouble: false,
                optionGroup: group,
            });
        });
        
        if (block.length > 0) {
            optionBlocks.push(block);
        }
      }
    });

    if (conflicts.length > 0) {
        updateTimetable(activeTimetable.id, { conflicts });
        return;
    }

    const sessionsToPlace: PlacementUnit[] = [...doubleSessions, ...optionBlocks, ...singleSessions];
    const sortedClasses = Array.from(classSet).sort();
    
    const newTimetable: TimetableData = {};
    days.forEach(day => { newTimetable[day] = Array.from({ length: periodCount }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods(timeSlots);

    function isValidPlacement(board: TimetableData, unit: PlacementUnit, day: string, period: number): boolean {
        const checkSession = (session: TimetableSession, p: number) => {
            const slot = board[day]?.[p];
            if (!slot) return false;

            if (slot.some(s => s.teacher === session.teacher)) return false;
            if (slot.some(s => s.classes.some(c => session.classes.includes(c)))) return false;
            
            const subjectToCheck = session.optionGroup ? `Option ${session.optionGroup}` : session.subject;
            for (const existingPeriod of board[day]) {
              if (existingPeriod.some(s => {
                  const existingSubject = s.optionGroup ? `Option ${s.optionGroup}` : s.subject;
                  return s.className === session.className && existingSubject === subjectToCheck;
              })) {
                  return false;
              }
            }
            return true;
        };

        if (Array.isArray(unit)) { // OptionBlock
            return unit.every(session => {
                const slot = board[day]?.[period];
                if (!slot) return false;
                if (slot.some(s => s.teacher === session.teacher)) return false;
                if (slot.some(s => s.classes.some(c => session.classes.includes(c)))) return false;

                const subjectToCheck = `Option ${session.optionGroup}`;
                for (const existingPeriod of board[day]) {
                  if (existingPeriod.some(s => s.className === session.className && (s.optionGroup ? `Option ${s.optionGroup}` : s.subject) === subjectToCheck)) {
                      return false;
                  }
                }
                return true;
            });
        } else if ('session' in unit) { // Double Period
            const { session, partner } = unit;
            const partnerPeriod = CONSECUTIVE_PERIODS.find(p => p[0] === period)?.[1];
            if (partnerPeriod === undefined) return false;
            return checkSession(session, period) && checkSession(partner, partnerPeriod);
        } else { // Single Session
            return checkSession(unit, period);
        }
    }
    
    function solve(board: TimetableData, units: PlacementUnit[]): [boolean, TimetableData] {
        if (units.length === 0) return [true, board];

        const unit = units[0];
        const remainingUnits = units.slice(1);
        const shuffledDays = [...days].sort(() => Math.random() - 0.5);

        for (const day of shuffledDays) {
            if (Array.isArray(unit)) { // Option Block
                const shuffledPeriods = Array.from({ length: periodCount }, (_, i) => i).sort(() => Math.random() - 0.5);
                for (const period of shuffledPeriods) {
                    if (isValidPlacement(board, unit, day, period)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        unit.forEach(session => newBoard[day][period].push(session));
                        const [solved, finalBoard] = solve(newBoard, remainingUnits);
                        if (solved) return [true, finalBoard];
                    }
                }
            } else if ('session' in unit) { // Double Period
                const shuffledConsecutive = [...CONSECUTIVE_PERIODS].sort(() => Math.random() - 0.5);
                for (const [p1, p2] of shuffledConsecutive) {
                    if (isValidPlacement(board, unit, day, p1)) {
                         const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][p1].push(unit.session);
                        newBoard[day][p2].push(unit.partner);
                        const [solved, finalBoard] = solve(newBoard, remainingUnits);
                        if (solved) return [true, finalBoard];
                    }
                }
            } else { // Single Session
                const shuffledPeriods = Array.from({ length: periodCount }, (_, i) => i).sort(() => Math.random() - 0.5);
                for (const period of shuffledPeriods) {
                     if (isValidPlacement(board, unit, day, period)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][period].push(unit);
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
        conflicts.push({ id: 'solver-fail', type: 'class', message: 'Could not generate a valid timetable. Check for too many constraints.' });
        updateTimetable(activeTimetable.id, { timetable: {}, conflicts, classes: [] });
        return;
    }

    const isSecondary = schoolName.toLowerCase().includes('secondary');
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
    if (!activeTimetable || !activeTimetable.timetable || Object.keys(activeTimetable.timetable).length === 0) {
        if(activeTimetable?.conflicts.length > 0) {
            updateTimetable(activeTimetable.id, { conflicts: [] });
        }
        return;
    }
    // This effect is to re-validate conflicts on any change.
    // We can add more robust validation here as needed.
    // For now, let's just clear stale conflicts.
    if (activeTimetable.conflicts.some(c => c.id === 'solver-fail')) {
        return; // Don't clear solver-fail messages automatically
    }
     if (activeTimetable.conflicts.length > 0) {
        // A simple way to clear conflicts on any timetable change, might need more specific logic
        // updateTimetable(activeTimetable.id, { conflicts: [] });
     }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimetable?.id, activeTimetable?.timetable]);


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

    

    
