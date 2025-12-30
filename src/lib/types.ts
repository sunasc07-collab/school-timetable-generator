
export type SubjectAssignment = {
  id: string;
  grades: string[];
  subject: string;
  arms: string[];
  periods: number;
  schoolId: string;
  isCore?: boolean;
  optionGroup?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  subjectType?: 'core' | 'optional';
  teacherId?: string; // For internal processing
  teacherName?: string; // For internal processing
};

export type Teacher = {
  id: string;
  name: string;
  assignments: SubjectAssignment[];
};

export type TimetableSession = {
  id: string;
  subject: string;
  actualSubject?: string;
  className: string;
  teacher: string;
  teacherId?: string; // Add teacherId
  isDouble: boolean;
  part?: 1 | 2;
  classes: string[]; 
  isCore?: boolean;
  optionGroup?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
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
  id: string;
  period: number | null;
  time: string;
  isBreak?: boolean;
  isLocked?: boolean;
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
  error: string | null;
};

    