
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
    console.log("--- TIMETABLE GENERATION STARTED ---");
    if (!activeTimetable) {
      console.error("DEBUG: No active timetable. Aborting.");
      return;
    }

    const activeTeachers = allTeachers.filter(t => t.assignments.some(a => a.schoolId === activeTimetable.id));
    console.log(`DEBUG: Found ${activeTeachers.length} active teachers for school ${activeTimetable.name}`);
    const { timeSlots, days, name: schoolName, id: schoolId } = activeTimetable;
    const periodCount = timeSlots.filter(ts => !ts.isBreak).length;
    let newConflicts: Conflict[] = [];

    const allRequiredAssignments: (SubjectAssignment & { teacher: string; className: string })[] = [];
    const classSet = new Set<string>();

    activeTeachers.forEach(teacher => {
        teacher.assignments.forEach(origAssignment => {
            if (origAssignment.schoolId !== schoolId || origAssignment.subject.toLowerCase() === 'assembly') return;
            
            const grades = origAssignment.grades.length > 0 ? origAssignment.grades : [""];
            grades.forEach(grade => {
                const arms = origAssignment.arms.length > 0 ? origAssignment.arms : [""];
                arms.forEach(arm => {
                    const className = `${grade} ${arm}`.trim();
                    if(className) classSet.add(className);

                    const newAssignment = {
                        ...origAssignment,
                        id: origAssignment.id || crypto.randomUUID(),
                        teacher: teacher.name,
                        className: className
                    };
                    allRequiredAssignments.push(newAssignment);
                });
            });
        });
    });

    console.log(`DEBUG: Total required assignments flattened: ${allRequiredAssignments.length}`, allRequiredAssignments);

    const singleSessions: SingleSessionUnit[] = [];
    const doubleSessions: DoubleSessionUnit[] = [];
    const nonOptionalAssignments = allRequiredAssignments.filter(a => !a.optionGroup);
    
    nonOptionalAssignments.forEach(req => {
        let remainingPeriods = req.periods;
        const className = req.className;
        if (!className) return;

        while (remainingPeriods >= 2) {
            const doubleId = crypto.randomUUID();
            const sessionPart1: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: true, part: 1 };
            const sessionPart2: TimetableSession = { id: doubleId, subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: true, part: 2 };
            doubleSessions.push({ session: sessionPart1, partner: sessionPart2 });
            remainingPeriods -= 2;
        }
        for (let i = 0; i < remainingPeriods; i++) {
            singleSessions.push({ id: crypto.randomUUID(), subject: req.subject, teacher: req.teacher, className, classes: [className], isDouble: false });
        }
    });

    console.log(`DEBUG: Created ${singleSessions.length} single sessions and ${doubleSessions.length} double sessions.`);

    const optionBlocks: OptionBlockUnit[] = [];
    const optionalAssignments = allRequiredAssignments.filter(a => a.optionGroup);
    console.log("DEBUG: Raw Optional Assignments:", optionalAssignments);

    const groupedOptions = optionalAssignments.reduce((acc, assignment) => {
        const key = `${assignment.schoolId}-${assignment.optionGroup}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(assignment);
        return acc;
    }, {} as Record<string, typeof optionalAssignments>);

    console.log(`DEBUG: Grouped options by school and group name:`, groupedOptions);

    Object.values(groupedOptions).forEach(assignmentsInGroup => {
        if (assignmentsInGroup.length === 0) return;

        const maxPeriods = Math.max(0, ...assignmentsInGroup.map(a => a.periods));
        const groupDetails = assignmentsInGroup[0];
        console.log(`DEBUG: Processing Option Group '${groupDetails.optionGroup}' for ${maxPeriods} periods.`);

        for (let periodIndex = 0; periodIndex < maxPeriods; periodIndex++) {
            const blockId = `option-block-${groupDetails.optionGroup}-${periodIndex}-${crypto.randomUUID()}`;
            console.log(`DEBUG: Creating block ${periodIndex + 1}/${maxPeriods} for group '${groupDetails.optionGroup}' with ID ${blockId}`);
            let blockSessions: TimetableSession[] = [];
            const teachersInThisBlock = new Set<string>();
            const classesInThisBlock = new Set<string>();

            assignmentsInGroup.forEach(assignment => {
                if (assignment.periods > periodIndex) {
                    // Pre-solver conflict check
                    if (teachersInThisBlock.has(assignment.teacher)) {
                        const conflictMsg = `Pre-solver conflict: Teacher ${assignment.teacher} is double-booked in Option ${assignment.optionGroup} for this period.`;
                        console.warn("DEBUG: " + conflictMsg);
                        newConflicts.push({ id: assignment.id || blockId, type: 'teacher', message: conflictMsg });
                        return; // Skip this conflicting assignment for this block
                    }
                    if (classesInThisBlock.has(assignment.className)) {
                        const conflictMsg = `Pre-solver conflict: Class ${assignment.className} has multiple subjects in Option ${assignment.optionGroup} for this period.`;
                        console.warn("DEBUG: " + conflictMsg);
                        newConflicts.push({ id: assignment.id || blockId, type: 'class', message: conflictMsg });
                        return; // Skip this conflicting assignment for this block
                    }

                    teachersInThisBlock.add(assignment.teacher);
                    classesInThisBlock.add(assignment.className);

                    blockSessions.push({
                        id: blockId,
                        subject: `Option ${assignment.optionGroup}`,
                        actualSubject: assignment.subject,
                        teacher: assignment.teacher,
                        className: assignment.className,
                        classes: [assignment.className],
                        isDouble: false,
                        optionGroup: assignment.optionGroup,
                    });
                }
            });
            
            if (blockSessions.length > 0) {
                 console.log(`DEBUG: Adding block with ${blockSessions.length} sessions to optionBlocks array.`, blockSessions);
                 optionBlocks.push({
                    id: blockId,
                    sessions: blockSessions,
                    optionGroup: groupDetails.optionGroup!,
                 });
            } else {
                 console.log(`DEBUG: Created an empty option block for group ${groupDetails.optionGroup}, period ${periodIndex}. This might be an error or by design if period counts differ.`);
            }
        }
    });
    console.log(`DEBUG: Finished creating ${optionBlocks.length} option blocks.`, optionBlocks);
    
    const sessionsToPlace: PlacementUnit[] = [...doubleSessions, ...singleSessions, ...optionBlocks];
    console.log(`DEBUG: Total units to place in solver: ${sessionsToPlace.length}`, sessionsToPlace);
    const sortedClasses = Array.from(classSet).sort();
    
    const newTimetable: TimetableData = {};
    days.forEach(day => { newTimetable[day] = Array.from({ length: periodCount }, () => []); });

    const CONSECUTIVE_PERIODS = getConsecutivePeriods(timeSlots);

    function isValidPlacement(board: TimetableData, unit: PlacementUnit, day: string, period: number): boolean {
        const checkSession = (session: TimetableSession, p: number) => {
            const slot = board[day]?.[p];
            if (!slot) {
                console.warn(`DEBUG: [isValidPlacement] Invalid slot [${day}, ${p}].`);
                return false;
            }

            if (slot.some(s => s.teacher === session.teacher)) {
                // console.log(`DEBUG: [isValidPlacement] Teacher conflict: ${session.teacher} in [${day}, ${p}].`);
                return false;
            }
            if (slot.some(s => s.classes.some(c => session.classes.includes(c)))) {
                // console.log(`DEBUG: [isValidPlacement] Class conflict: ${session.classes.join(',')} in [${day}, ${p}].`);
                return false;
            }
            
            for (const existingPeriod of board[day]) {
              if (existingPeriod.some(existingSession =>
                  existingSession.className === session.className &&
                  (existingSession.actualSubject || existingSession.subject) === (session.actualSubject || session.session.subject)
              )) {
                  // console.log(`DEBUG: [isValidPlacement] Same day subject conflict: ${(session.actualSubject || session.subject)} for ${session.className} on ${day}.`);
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
            if (!unit.sessions || unit.sessions.length === 0) {
                console.warn("DEBUG: [isValidPlacement] called with an empty option block. This should not happen.");
                return false;
            }
            // All sessions in an option block must be valid for this slot
            return unit.sessions.every(session => checkSession(session, period));
        } else { // Single Session
            return checkSession(unit, period);
        }
    }
    
    let solveCounter = 0;
    function solve(board: TimetableData, units: PlacementUnit[], depth: number): [boolean, TimetableData] {
        solveCounter++;
        if (solveCounter > 500000) { 
             console.error("DEBUG: SOLVER TIMEOUT. Exceeded max iterations. Aborting.");
             return [false, board];
        }
        if (units.length === 0) {
            console.log("DEBUG: SOLVER SUCCESS! All units placed.");
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
                        const [solved, finalBoard] = solve(newBoard, remainingUnits, depth + 1);
                        if (solved) return [true, finalBoard];
                    }
                }
            } else if ('sessions' in unit) { // Option Block
                 for (let period = 0; period < periodCount; period++) {
                    if (isValidPlacement(board, unit, day, period)) {
                       const newBoard = JSON.parse(JSON.stringify(board));
                       newBoard[day][period].push(...unit.sessions);
                       const [solved, finalBoard] = solve(newBoard, remainingUnits, depth + 1);
                       if (solved) return [true, finalBoard];
                    }
                }
            } else { // Single Session
                for (let period = 0; period < periodCount; period++) {
                     if (isValidPlacement(board, unit, day, period)) {
                        const newBoard = JSON.parse(JSON.stringify(board));
                        newBoard[day][period].push(unit);
                        const [solved, finalBoard] = solve(newBoard, remainingUnits, depth + 1);
                        if (solved) return [true, finalBoard];
                    }
                }
            }
        }
        // console.log(`DEBUG: [Depth ${depth}] Could not place unit, backtracking.`, unit);
        return [false, board];
    }
    
    console.log("--- CALLING SOLVER ---");
    let boardCopy = JSON.parse(JSON.stringify(newTimetable));
    const [isSolved, solvedBoard] = solve(boardCopy, sessionsToPlace, 0);
    console.log(`--- SOLVER FINISHED --- Success: ${isSolved}`);
    
    if (!isSolved) {
        console.error("DEBUG: Solver failed to find a solution. The constraints may be too high or there's a logic error in placement rules.");
        newConflicts.push({ id: 'solver-fail', type: 'class', message: 'Could not generate a valid timetable. Check for too many constraints or conflicting assignments.' });
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

    console.log("--- TIMETABLE GENERATION COMPLETE --- Updating state.");
    updateTimetable(activeTimetable.id, { 
        timetable: finalTimetable || {},
        classes: sortedClasses,
        conflicts: newConflicts,
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

    const conflictIds = new Set(activeTimetable.conflicts.map(c => c.id).filter(Boolean));
    if (conflictIds.size === 0) {
        updateTimetable(activeTimetable.id, { conflicts: [] });
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

    updateTimetable(activeTimetable.id, { conflicts: [] });
  };

  useEffect(() => {
    if (!activeTimetable || !activeTimetable.timetable || Object.keys(activeTimetable.timetable).length === 0) {
        if(activeTimetable?.conflicts.length > 0 && !activeTimetable.conflicts.some(c => c.id === 'solver-fail')) {
             if (activeTimetable) {
                updateTimetable(activeTimetable.id, { conflicts: [] });
             }
        }
        return;
    }
  }, [activeTimetable, updateTimetable]);


  const isConflict = (sessionId: string) => {
    if (!activeTimetable || !activeTimetable.conflicts) return false;
    return activeTimetable.conflicts.some(c => c.id === sessionId || sessionId.includes(c.id));
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

    