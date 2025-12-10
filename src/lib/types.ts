export type Subject = {
  id: string;
  name: string;
  periods: number;
};

export type Teacher = {
  id: string;
  name: string;
  subjects: Subject[];
};

export type TimetableSession = {
  id: string;
  subject: string;
  teacher: string;
};

export type TimetableData = {
  [day: string]: (TimetableSession | null)[];
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
  type: "teacher";
  message: string;
};
