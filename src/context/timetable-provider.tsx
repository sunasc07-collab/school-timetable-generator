
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
type OptionBlockUnit = { sessions: TimetableSession[]; optionGroup: string, id: string };

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

  const activeTimetable = useMemo(() => {
    const currentTimetable = timetables.find(t => t.id === activeTimetableId);
    return currentTimetable || null;
  }, [activeTimetableId, timetables]);
  
  const updateTimetable = useCallback((timetableId: string, updates: Partial<Timetable>) => {
      setTimetables(prev => prev.map(t => t.id === timetableId ? { ...t, ...updates } : t));
  }, [setTimetables]);

  const findConflicts = useCallback((timetableData: TimetableData, timetableId: string) => {
    const currentTT = timetables.find(t => t.id === timetableId);
    if (!currentTT || !timetableData || Object.keys(timetableData).length === 0) {
        if(currentTT) updateTimetable(timetableId, { conflicts: [] });
        return;
    }
    
    const { days, timeSlots } = currentTT;
    const periodCount = timeSlots.filter(ts => !ts.isBreak).length;
    const newConflicts: Conflict[] = [];

    for (const day of days) {
        for (let period = 0; period < periodCount; period++) {
            const slot = timetableData[day]?.[period];
            if (!slot || slot.length <= 1) continue;

            const teacherClashes = new Map<string, TimetableSession[]>();
            const classClashes = new Map<string, TimetableSession[]>();

            for (const session of slot) {
                if (teacherClashes.has(session.teacher)) {
                    teacherClashes.get(session.teacher)!.push(session);
                } else {
                    teacherClashes.set(session.teacher, [session]);
                }
                
                for (const className of session.classes) {
                    if (classClashes.has(className)) {
                        classClashes.get(className)!.push(session);
                    } else {
                        classClashes.set(className, [session]);
                    }
                }
            }

            teacherClashes.forEach((sessions, teacher) => {
                if (sessions.length > 1) {
                    sessions.forEach(session => {
                        newConflicts.push({
                            id: session.id,
                            type: 'teacher',
                            message: `Teacher ${teacher} is double-booked on ${day} at period ${period + 1}.`,
                        });
                    });
                }
            });
            
            classClashes.forEach((sessions, className) => {
                if (sessions.length > 1) {
                    sessions.forEach(session => {
                        newConflicts.push({
                            id: session.id,
                            type: 'class',
                            message: `Class ${className} is double-booked on ${day} at period ${period + 1}.`,
                        });
                    });
                }
            });
        }
    }
    updateTimetable(timetableId, { conflicts: newConflicts });
  }, [updateTimetable, timetables]);


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
    const newTeacher = { ...teacherData, id: teacherData.id || crypto.randomUUID() };
    setAllTeachers(prev => [...prev, newTeacher]);
    const schoolIds = new Set(newTeacher.assignments.map(a => a.schoolId));
    schoolIds.forEach(schoolId => {
      resetTimetableForSchool(schoolId);
    });
  }, [setAllTeachers, resetTimetableForSchool]);
  
  const updateTeacher = useCallback((teacherData: Teacher) => {
      const oldTeacher = allTeachers.find(t => t.id === teacherData.id);
      const schoolIdsToReset = new Set<string>();
  
      if (oldTeacher) {
          oldTeacher.assignments.forEach(a => schoolIdsToReset.add(a.schoolId));
      }
      teacherData.assignments.forEach(a => schoolIdsToReset.add(a.schoolId));
      
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
    let newConflicts: Conflict[] = [];

    // --- 1. Flatten all assignments ---
    const allRequiredAssignments: (SubjectAssignment & { teacher: string; className: string })[] = [];
    const classSet = new Set<string>();

    activeTeachers.forEach(teacher => {
        teacher.assignments.forEach(origAssignment => {
            if (origAssignment.schoolId !== schoolId || origAssignment.subject.toLowerCase() === 'assembly') return;

            const expandedAssignments = origAssignment.grades.flatMap(grade => {
                const arms = origAssignment.arms && origAssignment.arms.length > 0 ? origAssignment.arms : [""];
                return arms.map(arm => ({
                    ...origAssignment,
                    id: origAssignment.id || crypto.randomUUID(),
                    teacher: teacher.name,
                    className: `${grade} ${arm}`.trim(),
                    grades: [grade], 
                    arms: arm ? [arm] : [],
                }));
            });

            expandedAssignments.forEach(req => {
                if (req.className) classSet.add(req.className);
                allRequiredAssignments.push(req);
            });
        });
    });
    
    // --- 2. Create Single and Double Sessions for Core Subjects ---
    const singleSessions: SingleSessionUnit[] = [];
    const doubleSessions: DoubleSessionUnit[] = [];
    const nonOptionalAssignments = allRequiredAssignments.filter(a => !a.optionGroup);
    
    nonOptionalAssignments.forEach(req => {
        let remainingPeriods = req.periods;
        if (!req.className) return;

        while (remainingPeriods >= 2) {
            const doubleId = crypto.randomUUID();
            const sessionPart1: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className: req.className, classes: [req.className], isDouble: true, part: 1, isCore: req.isCore };
            const sessionPart2: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className: req.className, classes: [req.className], isDouble: true, part: 2, isCore: req.isCore };
            doubleSessions.push({ session: sessionPart1, partner: sessionPart2 });
            remainingPeriods -= 2;
        }
        for (let i = 0; i < remainingPeriods; i++) {
            singleSessions.push({ id: crypto.randomUUID(), subject: req.subject, teacher: req.teacher, className: req.className, classes: [req.className], isDouble: false, isCore: req.isCore });
        }
    });

    // --- 3. Create Option Blocks ---
    const optionBlocks: OptionBlockUnit[] = [];
    const optionalAssignments = allRequiredAssignments.filter(a => a.optionGroup);

    const groupedOptions = optionalAssignments.reduce((acc, assignment) => {
        // Group by school, option group, AND grade to handle Grade 10 Opt A vs Grade 11 Opt A
        const gradeKey = assignment.grades[0] || 'nograde';
        const key = `${assignment.schoolId}-${assignment.optionGroup}-${gradeKey}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(assignment);
        return acc;
    }, {} as Record<string, typeof optionalAssignments>);
    
    for (const groupKey in groupedOptions) {
        const assignmentsInGroup = groupedOptions[groupKey];
        if (assignmentsInGroup.length === 0) continue;
        
        const groupDetails = assignmentsInGroup[0];
        const optionGroupName = groupDetails.optionGroup!;

        const maxPeriods = Math.max(0, ...assignmentsInGroup.map(a => a.periods));
        
        for (let periodIndex = 0; periodIndex < maxPeriods; periodIndex++) {
            const blockId = `option-block-${groupKey}-${periodIndex}-${crypto.randomUUID()}`;
            
            const blockSessions: TimetableSession[] = [];
            const teachersInThisBlock = new Set<string>();
            const classesInThisBlock = new Set<string>();

            for (const assignment of assignmentsInGroup) {
                if (assignment.periods > periodIndex) {
                    if (teachersInThisBlock.has(assignment.teacher)) {
                        newConflicts.push({ id: assignment.id || blockId, type: 'teacher', message: `Pre-solver conflict: Teacher ${assignment.teacher} is double-booked within Option Group ${optionGroupName} for ${assignment.className}.` });
                        continue;
                    }
                    if (classesInThisBlock.has(assignment.className)) {
                        newConflicts.push({ id: assignment.id || blockId, type: 'class', message: `Pre-solver conflict: Class ${assignment.className} has multiple subjects in Option Group ${optionGroupName}.` });
                        continue; 
                    }
                    
                    teachersInThisBlock.add(assignment.teacher);
                    classesInThisBlock.add(assignment.className);
                    
                    blockSessions.push({
                        id: blockId,
                        subject: `Option ${optionGroupName}`,
                        actualSubject: assignment.subject,
                        teacher: assignment.teacher,
                        className: assignment.className,
                        classes: [assignment.className],
                        isDouble: false,
                        optionGroup: optionGroupName,
                    });
                }
            }
            
            if (blockSessions.length > 0) {
                 optionBlocks.push({
                    id: blockId,
                    sessions: blockSessions,
                    optionGroup: optionGroupName,
                 });
            }
        }
    }
    
    // --- 4. Prepare for Solver ---
    const sessionsToPlace: PlacementUnit[] = [...doubleSessions, ...singleSessions, ...optionBlocks];
    const sortedClasses = Array.from(classSet).sort();
    
    const newTimetable: TimetableData = {};
    days.forEach(day => { newTimetable[day] = Array.from({ length: periodCount }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods(timeSlots);
    
    // --- 5. Solver Logic ---
    function isValidPlacement(board: TimetableData, unit: PlacementUnit, day: string, period: number): boolean {
        const checkSession = (session: TimetableSession, p: number) => {
            const slot = board[day]?.[p];
            if (!slot) return false;

            if (slot.some(s => s.teacher === session.teacher)) return false;
            
            const sessionClasses = session.optionGroup ? session.classes : [session.className];
            if (slot.some(s => s.classes.some(c => sessionClasses.includes(c)))) return false;
            
            for (const existingPeriod of board[day]) {
              if (existingPeriod.some(existingSession =>
                  existingSession.className === session.className &&
                  (existingSession.actualSubject || existingSession.subject) === (session.actualSubject || session.subject)
              )) {
                  return false;
              }
            }
            return true;
        };

        if ('partner' in unit) { // Double Period
            const { session, partner } = unit;
            const partnerPeriod = CONSECUTIVE_PERIODS.find(p => p[0] === period)?.[1];
            if (partnerPeriod === undefined) return false;
            return checkSession(session, period) && checkSession(partner, partnerPeriod);
        } else if ('sessions' in unit) { // Option Block
            if (!unit.sessions || unit.sessions.length === 0) return false;
            return unit.sessions.every(session => checkSession(session, period));
        } else { // Single Session
            return checkSession(unit, period);
        }
    }
    
    function solve(board: TimetableData, units: PlacementUnit[]): [boolean, TimetableData] {
        if (units.length === 0) {
            return [true, board];
        }

        const unit = units[0];
        const remainingUnits = units.slice(1);
        
        for (const day of days) {
            if ('partner' in unit) { // Double Period
                for (const [p1, p2] of CONSECUTIVE_PERIODS) {
                    if (isValidPlacement(board, unit, day, p1)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][p1].push(unit.session);
                        newBoard[day][p2].push(unit.partner);
                        const [solved, finalBoard] = solve(newBoard, remainingUnits);
                        if (solved) return [true, finalBoard];
                    }
                }
            } else if ('sessions' in unit) { // Option Block
                 for (let period = 0; period < periodCount; period++) {
                    if (isValidPlacement(board, unit, day, period)) {
                       const newBoard = JSON.parse(JSON.stringify(board));
                       newBoard[day][period].push(...unit.sessions);
                       const [solved, finalBoard] = solve(newBoard, remainingUnits);
                       if (solved) return [true, finalBoard];
                    }
                }
            } else { // Single Session
                for (let period = 0; period < periodCount; period++) {
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
    
    if (!isSolved) {
        newConflicts.push({ id: 'solver-fail', type: 'class', message: `Could not generate a valid timetable. Check for too many constraints or conflicting assignments.` });
        updateTimetable(activeTimetable.id, { timetable: {}, conflicts: newConflicts, classes: [] });
        return;
    }
    
    let finalTimetable = solvedBoard;

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
        conflicts: newConflicts,
    });
    findConflicts(finalTimetable, activeTimetable.id);
  }, [updateTimetable, activeTimetable, allTeachers, findConflicts]);


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
    findConflicts(newTimetableData, activeTimetable.id);
  }

  const resolveConflicts = () => {
    if (!activeTimetable || !activeTimetable.conflicts || activeTimetable.conflicts.length === 0) return;

    const conflictIds = new Set(activeTimetable.conflicts.map(c => c.id).filter(Boolean));
    if (conflictIds.size === 0) {
        if (activeTimetable) {
            updateTimetable(activeTimetable.id, { conflicts: [] });
        }
        return;
    }
    
    setAllTeachers(prev => {
        const newTeachers = [...prev];
        let wasChanged = false;
        newTeachers.forEach(teacher => {
            const originalAssignmentCount = teacher.assignments.length;
            teacher.assignments = teacher.assignments.filter(a => !conflictIds.has(a.id));
            if (teacher.assignments.length < originalAssignmentCount) {
                wasChanged = true;
            }
        });
        
        if (wasChanged) {
            if (activeTimetable) {
              updateTimetable(activeTimetable.id, { timetable: {}, classes: [], conflicts: [] });
            }
        }
        return newTeachers;
    });

    if (activeTimetable) {
        updateTimetable(activeTimetable.id, { conflicts: [] });
    }
  };

  const isConflict = (sessionId: string): boolean => {
    if (!activeTimetable || !activeTimetable.conflicts) return false;
    return activeTimetable.conflicts.some(c => c.id === sessionId || sessionId.startsWith(c.id));
  };
  
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

    