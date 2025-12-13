

export type SubjectAssignment = {
  id: string;
  grade: string;
  subject: string;
  arms: string[];
  periods: number;
};

export type Teacher = {
  id: string;
  name: string;
  maxPeriods: number;
  assignments: SubjectAssignment[];
  schoolSections: string[];
};

export type TimetableSession = {
  id: string;
  subject: string;
  className: string;
  teacher: string;
  isDouble: boolean;
  part?: 1 | 2;
  classes: string[]; 
};

export type TimetableSlot = TimetableSession[];

export type TimetableData = {
  [day: string]: TimetableSlot[];
};

export type TimetableDragData = {
  session: TimetableSession;
  from: {
    day: string;
    period: number;
  };
};

export type Conflict = {
  id: string;
  type: "teacher" | "class";
  message: string;
};

export type TimeSlot = {
  period: number | null;
  time: string;
  isBreak?: boolean;
  label?: string;
};

export type ViewMode = 'class' | 'teacher' | 'arm';

export type Timetable = {
  id: string;
  name: string;
  timetable: TimetableData;
  classes: string[];
  conflicts: Conflict[];
  days: string[];
  timeSlots: TimeSlot[];
};

    