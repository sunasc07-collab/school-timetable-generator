
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from "react";
import type { Teacher, TimetableData, TimetableSession, Conflict, TimeSlot, Timetable, ViewMode, SubjectAssignment, LockedSession } from "@/lib/types";

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

  addLockedSession: (session: Omit<LockedSession, 'id' | 'schoolId'>) => void;
  removeLockedSession: (sessionId: string) => void;
  
  generateTimetable: () => void;
  clearTimetable: () => void;
  moveSession: (session: TimetableSession, from: { day: string; period: number }, to: { day: string; period: number }) => void;
  resolveConflicts: () => void;
  isConflict: (sessionId: string) => boolean;
  
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  updateTimeSlots: (newTimeSlots: TimeSlot[]) => void;
};

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_TIMESLOTS: TimeSlot[] = [
    { period: 1, time: '08:00-08:40', id: crypto.randomUUID() },
    { period: 2, time: '08:40-09:20', id: crypto.randomUUID() },
    { period: 3, time: '09:20-10:00', id: crypto.randomUUID() },
    { period: null, time: '10:00-10:20', isBreak: true, label: 'Short Break', id: crypto.randomUUID(), days: DEFAULT_DAYS },
    { period: 4, time: '10:20-11:00', id: crypto.randomUUID() },
    { period: 5, time: '11:00-11:40', id: crypto.randomUUID() },
    { period: 6, time: '11:40-12:20', id: crypto.randomUUID() },
    { period: null, time: '12:20-13:00', isBreak: true, label: 'Lunch', id: crypto.randomUUID(), days: DEFAULT_DAYS },
    { period: 7, time: '13:00-13:40', id: crypto.randomUUID() },
    { period: 8, time: '13:40-14:20', id: crypto.randomUUID() },
    { period: 9, time: '14:20-15:00', id: crypto.randomUUID() },
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
        error: null,
        lockedSessions: [],
    };
}

type SingleSessionUnit = TimetableSession;
type DoubleSessionUnit = { session: TimetableSession; partner: TimetableSession };
type OptionBlockUnit = { sessions: TimetableSession[]; optionGroup: string, id: string };

type PlacementUnit = SingleSessionUnit | DoubleSessionUnit | OptionBlockUnit;

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [timetables, setTimetables] = usePersistentState<Timetable[]>("timetables_data_v28", []);
  const [allTeachers, setAllTeachers] = usePersistentState<Teacher[]>("all_teachers_v28", []);
  const [activeTimetableId, setActiveTimetableId] = usePersistentState<string | null>("active_timetable_id_v28", null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('timetable_viewMode_v28', 'class');
  
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
    
    const { days } = currentTT;
    const newConflicts: Conflict[] = [];

    days.forEach(day => {
        const daySlots = timetableData[day] || [];
        daySlots.forEach(slot => {
            if (!slot || slot.length <= 1) return;
            const period = slot[0]?.period;
            if (period === undefined) return;

            const teacherClashes = new Map<string, TimetableSession[]>();
            const classClashes = new Map<string, TimetableSession[]>();

            for (const session of slot) {
                if (session.teacherId && !session.isLocked) {
                    if (!teacherClashes.has(session.teacherId)) {
                        teacherClashes.set(session.teacherId, []);
                    }
                    teacherClashes.get(session.teacherId)!.push(session);
                }
                
                for (const className of session.classes) {
                     if (!classClashes.has(className)) {
                        classClashes.set(className, []);
                    }
                    classClashes.get(className)!.push(session);
                }
            }

            teacherClashes.forEach((sessions) => {
                const uniqueSessionIds = new Set(sessions.map(s => s.id));
                if (uniqueSessionIds.size > 1) {
                    sessions.forEach(session => {
                        newConflicts.push({
                            id: session.id,
                            type: 'teacher',
                            message: `Teacher ${session.teacher} is double-booked on ${day} at period ${period}.`,
                        });
                    });
                }
            });
            
            classClashes.forEach((sessions, className) => {
                 const nonLockedSessions = sessions.filter(s => !s.isLocked);
                 if(nonLockedSessions.length <= 1) return;

                const uniqueSessionIds = new Set(nonLockedSessions.map(s => s.id));
                 if (uniqueSessionIds.size > 1) {
                    nonLockedSessions.forEach(session => {
                        newConflicts.push({
                            id: session.id,
                            type: 'class',
                            message: `Class ${className} is double-booked on ${day} at period ${period}.`,
                        });
                    });
                }
            });
        });
    });

    updateTimetable(timetableId, { conflicts: newConflicts });
  }, [updateTimetable, timetables]);
  
  useEffect(() => {
    if (timetables.length === 0) {
        const defaultTimetable = createNewTimetable("New School");
        setTimetables([defaultTimetable]);
        setActiveTimetableId(defaultTimetable.id);
    } else if (!activeTimetableId || !timetables.some(t => t.id === activeTimetableId)) {
        setActiveTimetableId(timetables[0]?.id || null);
    }
  }, [timetables, activeTimetableId, setTimetables, setActiveTimetableId]);

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
                  error: null,
                };
            }
            return t;
        });
    });
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

  const updateTimeSlots = (newTimeSlots: TimeSlot[]) => {
    if (!activeTimetable) return;
    let periodCounter = 1;
    const renumberedTimeSlots = newTimeSlots.map(slot => {
        if (!slot.isBreak) {
            return { ...slot, period: periodCounter++ };
        }
        return { ...slot, period: null };
    });
    updateTimetable(activeTimetable.id, { timeSlots: renumberedTimeSlots });
    resetTimetableForSchool(activeTimetable.id);
  }

  const addLockedSession = (session: Omit<LockedSession, 'id' | 'schoolId'>) => {
      if (!activeTimetable) return;

      const newSessions: LockedSession[] = [];
      const commonId = crypto.randomUUID();

      if (session.day === 'all_week') {
          activeTimetable.days.forEach(day => {
              newSessions.push({
                  ...session,
                  id: `${commonId}-${day}`,
                  schoolId: activeTimetable.id,
                  day: day,
                  isWeekly: true,
                  weeklyId: commonId,
              });
          });
          newSessions.push({
              ...session,
              id: commonId,
              schoolId: activeTimetable.id,
              day: 'all_week', // master entry
          });
      } else {
          newSessions.push({
              ...session,
              id: commonId,
              schoolId: activeTimetable.id,
          });
      }
      
      updateTimetable(activeTimetable.id, { lockedSessions: [...(activeTimetable.lockedSessions || []), ...newSessions] });
      resetTimetableForSchool(activeTimetable.id);
  };

  const removeLockedSession = (sessionId: string) => {
      if (!activeTimetable || !activeTimetable.lockedSessions) return;
      const sessionToRemove = activeTimetable.lockedSessions.find(s => s.id === sessionId);

      let sessionsToKeep = activeTimetable.lockedSessions;

      if(sessionToRemove?.isWeekly) {
          // It's a derived weekly session, so we need to remove all related sessions
          sessionsToKeep = sessionsToKeep.filter(s => s.weeklyId !== sessionToRemove.weeklyId);
      } else if (sessionToRemove?.day === 'all_week') {
          // It's the master weekly session
          sessionsToKeep = sessionsToKeep.filter(s => s.id !== sessionToRemove.id && s.weeklyId !== sessionToRemove.id);
      } else {
          // It's a single session
          sessionsToKeep = sessionsToKeep.filter(s => s.id !== sessionId);
      }
      
      updateTimetable(activeTimetable.id, { lockedSessions: sessionsToKeep });
      resetTimetableForSchool(activeTimetable.id);
  };
  
  const generateTimetable = useCallback(() => {
    if (!activeTimetable) return;

    // We generate for ALL schools that have teachers assigned.
    // The main logic will focus on the active school, but the validation
    // needs to be aware of all other schedules.
    const allTimetablesToGenerate = timetables.filter(t => 
        allTeachers.some(teacher => teacher.assignments.some(a => a.schoolId === t.id))
    );

    let allSolvedBoards: { [schoolId: string]: TimetableData } = {};
    let generationError: string | null = null;
    
    // Initialize all boards
    timetables.forEach(tt => {
        allSolvedBoards[tt.id] = {};
        tt.days.forEach(day => {
            allSolvedBoards[tt.id][day] = [];
        });
        (tt.lockedSessions || []).filter(ls => ls.day !== 'all_week').forEach(ls => {
            const classNames = ls.className === 'all' ? (tt.classes || []) : [ls.className];
            const lockedSlot: TimetableSession[] = [{
                id: ls.id, subject: ls.activity, className: ls.className, classes: classNames, teacher: '', isLocked: true, isDouble: false, period: ls.period, schoolId: tt.id
            }];
            
            let slot = allSolvedBoards[tt.id][ls.day].find(s => s[0]?.period === ls.period);
            if(slot) {
                slot.push(...lockedSlot);
            } else {
                allSolvedBoards[tt.id][ls.day].push(lockedSlot);
            }
        });
    });

    const allCurrentSchoolAssignments = allTeachers.flatMap(teacher => 
        teacher.assignments
            .map(a => ({ ...a, teacherId: teacher.id, teacherName: teacher.name }))
    );

    const parseTimeToMinutes = (time: string): number => {
        if (!time || !time.includes(':')) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return 0;
        return hours * 60 + minutes;
    };

    function isValidPlacement(
        boards: { [schoolId: string]: TimetableData }, 
        unit: PlacementUnit, 
        day: string, 
        period: number
    ): boolean {
        const checkSession = (session: TimetableSession, p: number) => {
            const schoolTimetable = timetables.find(t => t.id === session.schoolId);
            if (!schoolTimetable) return false;

            // Class clash check
            const targetSlot = boards[session.schoolId][day]?.find(slot => slot[0]?.period === p);
            if (targetSlot) {
                if (targetSlot.some(s => s.isLocked && (s.classes.some(c => session.classes.includes(c)) || s.className === 'all'))) {
                     return false;
                }
                if (targetSlot.some(s => s.classes.some(c => session.classes.includes(c)))) {
                     return false;
                }
            }
            
            // Teacher time-based clash detection across all schools
            if (session.teacherId) {
                const proposedTimeSlot = schoolTimetable.timeSlots.find(ts => ts.period === p);
                if (!proposedTimeSlot) return false;

                const [startStr, endStr] = proposedTimeSlot.time.split('-');
                const proposedStart = parseTimeToMinutes(startStr);
                const proposedEnd = parseTimeToMinutes(endStr);
                
                if (proposedStart >= proposedEnd) return false; // Invalid time slot definition

                for (const schoolId in boards) {
                    const board = boards[schoolId];
                    const schoolConfig = timetables.find(t => t.id === schoolId);
                    if (!schoolConfig) continue;

                    const daySchedule = board[day] || [];
                    for (const slot of daySchedule) {
                        for (const existingSession of slot) {
                            if (existingSession.teacherId === session.teacherId) {
                                const existingTimeSlot = schoolConfig.timeSlots.find(ts => ts.period === existingSession.period);
                                if (!existingTimeSlot) continue;

                                const [existingStartStr, existingEndStr] = existingTimeSlot.time.split('-');
                                const existingStart = parseTimeToMinutes(existingStartStr);
                                const existingEnd = parseTimeToMinutes(existingEndStr);
                                
                                if (existingStart >= existingEnd) continue; // Invalid existing slot

                                // Check for overlap: !(end1 <= start2 || start1 >= end2)
                                if (proposedStart < existingEnd && proposedEnd > existingStart) {
                                    return false; // Overlap detected
                                }
                            }
                        }
                    }
                }
            }

            const assignment = allCurrentSchoolAssignments.find(a => a.teacherId === session.teacherId && a.subject === (session.actualSubject || session.subject));
            if (assignment && assignment.days && assignment.days.length > 0 && !assignment.days.includes(day)) {
                return false;
            }

            return true;
        };

        if ('partner' in unit) {
            const schoolForUnit = timetables.find(t => t.id === unit.session.schoolId);
            if (!schoolForUnit) return false;
            
            const teachingPeriodsForDay = schoolForUnit.timeSlots
                .filter(ts => !ts.isBreak || !(ts.days || schoolForUnit.days).includes(day))
                .map(ts => ts.period).filter((p): p is number => p !== null).sort((a,b) => a-b);
            
            const periodSlotIndex = teachingPeriodsForDay.indexOf(period);
            if (periodSlotIndex === -1 || periodSlotIndex + 1 >= teachingPeriodsForDay.length) return false;
            
            const nextTeachingPeriod = teachingPeriodsForDay[periodSlotIndex + 1];

            const periodSlotObj = schoolForUnit.timeSlots.find(p => p.period === period);
            const nextPeriodSlotObj = schoolForUnit.timeSlots.find(p => p.period === nextTeachingPeriod);
            if (!periodSlotObj || !nextPeriodSlotObj) return false;
            
            const timeSlotIndex = schoolForUnit.timeSlots.findIndex(p => p.id === periodSlotObj.id);
            const nextTimeSlotIndex = schoolForUnit.timeSlots.findIndex(p => p.id === nextPeriodSlotObj.id);

            if(timeSlotIndex + 1 !== nextTimeSlotIndex) return false;

            return checkSession(unit.session, period) && checkSession(unit.partner, nextTeachingPeriod);
        } else if ('sessions' in unit) {
            for (const s of unit.sessions) {
              if (!checkSession(s, period)) return false;
            }
            return true;
        } else {
            return checkSession(unit, period);
        }
    }
    
    function solve(boards: { [schoolId: string]: TimetableData }, units: PlacementUnit[]): [boolean, { [schoolId: string]: TimetableData }] {
        if (units.length === 0) return [true, boards];

        const unit = units[0];
        const remainingUnits = units.slice(1);
        
        const schoolForUnit = timetables.find(t => t.id === (('sessions' in unit) ? unit.sessions[0].schoolId : unit.schoolId));
        if (!schoolForUnit) return solve(boards, remainingUnits);


        for (const day of schoolForUnit.days) {
            const schoolPeriods = (schoolForUnit.timeSlots || [])
                .filter(ts => !ts.isBreak || !(ts.days || schoolForUnit.days).includes(day))
                .map(ts => ts.period)
                .filter((p): p is number => p !== null);

            for (const period of schoolPeriods) {
                if (isValidPlacement(boards, unit, day, period)) {
                   const newBoards = JSON.parse(JSON.stringify(boards));
                   
                   const placeSession = (session: TimetableSession, p: number) => {
                       let slot = newBoards[session.schoolId][day].find((s: TimetableSession[]) => s[0]?.period === p);
                       if (slot) {
                           slot.push({ ...session, period: p });
                       } else {
                           newBoards[session.schoolId][day].push([{ ...session, period: p }]);
                       }
                   };

                   if ('partner' in unit) {
                       placeSession(unit.session, period);
                       
                       const teachingPeriodsForDay = schoolForUnit.timeSlots
                           .filter(ts => !ts.isBreak || !(ts.days || schoolForUnit.days).includes(day))
                           .map(ts => ts.period).filter((p): p is number => p !== null).sort((a,b) => a-b);
                       const periodSlotIndex = teachingPeriodsForDay.indexOf(period);
                       const partnerPeriod = teachingPeriodsForDay[periodSlotIndex + 1];

                       placeSession(unit.partner, partnerPeriod);
                   } else if ('sessions' in unit) {
                       unit.sessions.forEach(s => placeSession(s, period));
                   } else {
                       placeSession(unit, period);
                   }
                   
                   const [solved, finalBoards] = solve(newBoards, remainingUnits);
                   if (solved) return [true, finalBoards];
                }
            }
        }
        return [false, boards];
    }
    
    // Prepare all units from all schools
    const allUnits: PlacementUnit[] = [];
    const allClassSets: {[schoolId: string]: Set<string>} = {};

    allTimetablesToGenerate.forEach(tt => {
        const { id: schoolId, name: schoolName } = tt;
        const schoolAssignments = allCurrentSchoolAssignments.filter(a => a.schoolId === schoolId);
        const singleSessions: SingleSessionUnit[] = [];
        const doubleSessions: DoubleSessionUnit[] = [];
        const optionBlocks: OptionBlockUnit[] = [];
        const classSet = new Set<string>();

        const coreAssignments = schoolAssignments.filter(a => !a.optionGroup);
        const optionalAssignments = schoolAssignments.filter(a => a.optionGroup);
        
        coreAssignments.forEach(assignment => {
            assignment.grades.forEach(grade => {
                const arms = assignment.arms && assignment.arms.length > 0 ? assignment.arms : [""];
                arms.forEach(arm => {
                    const className = `${grade} ${arm}`.trim();
                    classSet.add(className);
                    let remainingPeriods = assignment.periods;
                    while (remainingPeriods >= 2) {
                        const doubleId = crypto.randomUUID();
                        doubleSessions.push({
                            session: { id: doubleId, subject: assignment.subject, teacher: assignment.teacherName, teacherId: assignment.teacherId, className, classes: [className], isDouble: true, part: 1, period: 0, schoolId },
                            partner: { id: doubleId, subject: assignment.subject, teacher: assignment.teacherName, teacherId: assignment.teacherId, className, classes: [className], isDouble: true, part: 2, period: 0, schoolId },
                        });
                        remainingPeriods -= 2;
                    }
                    for (let i = 0; i < remainingPeriods; i++) {
                        singleSessions.push({ id: crypto.randomUUID(), subject: assignment.subject, teacher: assignment.teacherName, teacherId: assignment.teacherId, className, classes: [className], isDouble: false, period: 0, schoolId });
                    }
                });
            });
        });

        const optionalGroups = new Map<string, (SubjectAssignment & { teacherId: string, teacherName: string })[]>();
        optionalAssignments.forEach(assignment => {
            const isSeniorSecondary = schoolName.toLowerCase().includes('secondary');
            if (isSeniorSecondary && assignment.grades.some(g => g.startsWith('Grade 1') || g.startsWith('A-Level'))) {
                assignment.grades.forEach(grade => {
                    const groupKey = `${schoolId}-${grade}-${assignment.optionGroup}`;
                    if (!optionalGroups.has(groupKey)) optionalGroups.set(groupKey, []);
                    optionalGroups.get(groupKey)!.push({ ...assignment, grades: [grade] });
                });
            } else {
                const groupKey = `${schoolId}-${assignment.optionGroup}`;
                if (!optionalGroups.has(groupKey)) optionalGroups.set(groupKey, []);
                optionalGroups.get(groupKey)!.push(assignment);
            }
        });

        optionalGroups.forEach((assignmentsInGroup) => {
            const firstAssignment = assignmentsInGroup[0];
            const optionGroupName = firstAssignment.optionGroup!;
            const maxPeriods = Math.max(...assignmentsInGroup.map(a => a.periods));
            for (let i = 0; i < maxPeriods; i++) {
                const blockId = crypto.randomUUID();
                const blockSessions: TimetableSession[] = [];
                const teachersInBlock = new Set<string>();
                assignmentsInGroup.filter(a => i < a.periods).forEach(assignment => {
                    if (teachersInBlock.has(assignment.teacherId)) return;
                    teachersInBlock.add(assignment.teacherId);
                    assignment.grades.forEach(grade => {
                        const arms = assignment.arms && assignment.arms.length > 0 ? assignment.arms : [""];
                        arms.forEach(arm => {
                            const className = `${grade} ${arm}`.trim();
                            classSet.add(className);
                            blockSessions.push({
                                id: blockId, subject: `Option ${optionGroupName}`, actualSubject: assignment.subject, teacher: assignment.teacherName,
                                teacherId: assignment.teacherId, className, classes: [className], isDouble: false, optionGroup: optionGroupName, period: 0, schoolId
                            });
                        });
                    });
                });
                if (blockSessions.length > 0) optionBlocks.push({ id: blockId, sessions: blockSessions, optionGroup: optionGroupName });
            }
        });

        allClassSets[schoolId] = classSet;
        allUnits.push(...singleSessions, ...doubleSessions, ...optionBlocks);
    });

    const sortedAllUnits = allUnits.sort((a, b) => ('sessions' in b ? 1 : 0) - ('sessions' in a ? 1 : 0) || ('partner' in b ? 1 : 0) - ('partner' in a ? 1 : 0));

    const [isSolved, solvedBoards] = solve(allSolvedBoards, sortedAllUnits);
    
    if (!isSolved) {
        generationError = `Could not generate a valid timetable for all schools. This is often due to conflicting teacher assignments or not enough available time slots.`;
        // Only update the active timetable with the error
        updateTimetable(activeTimetable.id, { error: generationError, timetable: {}, classes: [], conflicts: [] });
        return;
    }

    // Update all generated timetables
    for (const schoolId in solvedBoards) {
        const board = solvedBoards[schoolId];
        for (const day in board) {
            board[day].sort((a: TimetableSession[], b: TimetableSession[]) => (a[0]?.period || 0) - (b[0]?.period || 0));
        }
        updateTimetable(schoolId, { 
            timetable: board,
            classes: Array.from(allClassSets[schoolId] || []).sort(),
            conflicts: [],
            error: null,
        });
        findConflicts(board, schoolId);
    }

  }, [updateTimetable, activeTimetable, allTeachers, findConflicts, timetables]);


  const clearTimetable = () => {
    if (!activeTimetable) return;
    updateTimetable(activeTimetable.id, { timetable: {}, classes: [], conflicts: [], error: null });
  }
  
  const moveSession = (
    session: TimetableSession, 
    from: { day: string; period: number },
    to: { day: string; period: number }
  ) => {
    if (!activeTimetable?.timetable) return;

    const newTimetableData = JSON.parse(JSON.stringify(activeTimetable.timetable));
    
    const fromSlotArr = newTimetableData[from.day];
    const fromSlotIndex = fromSlotArr.findIndex((s: TimetableSession[]) => s[0]?.period === from.period);
    if (fromSlotIndex > -1) {
        const sessionIndex = fromSlotArr[fromSlotIndex].findIndex((s: TimetableSession) => s.id === session.id && s.className === session.className && s.part === session.part);
        if (sessionIndex > -1) {
            fromSlotArr[fromSlotIndex].splice(sessionIndex, 1);
            if (fromSlotArr[fromSlotIndex].length === 0) {
                fromSlotArr.splice(fromSlotIndex, 1);
            }
        }
    }

    let toSlot = newTimetableData[to.day]?.find((s: TimetableSession[]) => s[0]?.period === to.period);
    if (toSlot) {
        toSlot.push({ ...session, period: to.period });
    } else {
        if (!newTimetableData[to.day]) newTimetableData[to.day] = [];
        newTimetableData[to.day].push([{ ...session, period: to.period }]);
        newTimetableData[to.day].sort((a: TimetableSession[], b: TimetableSession[]) => (a[0]?.period || 0) - (b[0]?.period || 0));
    }
    
    updateTimetable(activeTimetable.id, { timetable: newTimetableData });
    findConflicts(newTimetableData, activeTimetable.id);
  }

  const resolveConflicts = () => {
    if (!activeTimetable) return;
    clearTimetable();
  };

  const isConflict = (sessionId: string): boolean => {
    if (!activeTimetable || !activeTimetable.conflicts) return false;
    return activeTimetable.conflicts.some(c => c.id === sessionId || sessionId.startsWith(c.id));
  };
  
  const filteredLockedSessions = useMemo(() => {
    if (!activeTimetable?.lockedSessions) return [];
    const weeklyIds = new Set(activeTimetable.lockedSessions.filter(ls => ls.day === 'all_week').map(ls => ls.id));
    return activeTimetable.lockedSessions.filter(ls => ls.day === 'all_week' || !weeklyIds.has(ls.weeklyId || ''));
  }, [activeTimetable?.lockedSessions]);

  return (
    <TimetableContext.Provider
      value={{
        timetables,
        activeTimetable: activeTimetable ? { ...activeTimetable, lockedSessions: filteredLockedSessions } : null,
        activeTimetableId,
        allTeachers,
        addTimetable,
        removeTimetable,
        renameTimetable,
        setActiveTimetableId,
        addTeacher,
        removeTeacher,
        updateTeacher,
        addLockedSession,
        removeLockedSession,
        generateTimetable,
        clearTimetable,
        moveSession,
        isConflict,
        viewMode,
        setViewMode,
        resolveConflicts,
        updateTimeSlots
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
