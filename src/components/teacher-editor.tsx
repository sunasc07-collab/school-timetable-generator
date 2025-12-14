
"use client";

import { useForm, useFieldArray, FormProvider, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTimetable } from "@/context/timetable-provider";
import { Plus, Trash2, Users, Pencil, Book, GraduationCap, Building } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useEffect, useState, useMemo } from "react";
import type { Teacher } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const assignmentSchema = z.object({
  id: z.string().optional(),
  grades: z.array(z.string()).min(1, "At least one grade is required."),
  subject: z.string().min(1, "A subject is required."),
  arms: z.array(z.string()),
  periods: z.number().min(1, "Periods must be > 0").default(1),
  schoolId: z.string().min(1, "A school is required."),
});

const teacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Teacher name is required."),
  assignments: z.array(assignmentSchema).min(1, "At least one assignment is required."),
});

const multiTeacherSchema = z.object({
  teachers: z.array(teacherSchema),
});


type TeacherFormValues = z.infer<typeof teacherSchema>;
type MultiTeacherFormValues = z.infer<typeof multiTeacherSchema>;

const ALL_GRADE_OPTIONS = ["Nursery 1", "Nursery 2", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "A-Level Year 1", "A-Level Year 2"];
const PRIMARY_GRADES = ["Nursery 1", "Nursery 2", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];
const SECONDARY_GRADES = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const A_LEVEL_GRADES = ["A-Level Year 1", "A-Level Year 2"];

const JUNIOR_SECONDARY_ARMS = ["A", "Primrose"];
const SENIOR_SECONDARY_ARMS = ["P", "D", "L", "M"];


const getGradeOptionsForSchool = (schoolName: string) => {
    const lowerCaseSchoolName = schoolName.toLowerCase();
    if (lowerCaseSchoolName.includes('primary')) {
        return PRIMARY_GRADES;
    }
    if (lowerCaseSchoolName.includes('secondary')) {
        return [...SECONDARY_GRADES, ...A_LEVEL_GRADES];
    }
     if (lowerCaseSchoolName.includes('a-level') || lowerCaseSchoolName.includes('nursery')) {
        return [];
    }
    return ALL_GRADE_OPTIONS;
};

const AssignmentRow = ({ teacherIndex, assignmentIndex, control, remove, fieldsLength }: { teacherIndex: number, assignmentIndex: number, control: any, remove: (index: number) => void, fieldsLength: number }) => {
    const { timetables } = useTimetable();
    const { setValue, getValues } = useFormContext();
    
    const schoolId = useWatch({
        control,
        name: `teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`
    });

    const selectedGrades = useWatch({
      control,
      name: `teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`,
    }) || [];

    const selectedSchool = useMemo(() => timetables.find(t => t.id === schoolId), [schoolId, timetables]);
    const schoolName = selectedSchool?.name.toLowerCase() || '';

    const isSecondary = schoolName.includes('secondary');
    const isALevelSchool = schoolName.includes('a-level');
    const isNurserySchool = schoolName.includes('nursery');

    const hasJuniorSecondary = selectedGrades.some((g: string) => ["Grade 7", "Grade 8", "Grade 9"].includes(g));
    const hasSeniorSecondary = selectedGrades.some((g: string) => ["Grade 10", "Grade 11", "Grade 12"].includes(g));
    const hasALevel = selectedGrades.some((g: string) => g.startsWith("A-Level"));

    let armOptions = SENIOR_SECONDARY_ARMS;
    let showArms = false;
    if (isSecondary && !hasALevel) {
        if (hasJuniorSecondary && !hasSeniorSecondary) {
            armOptions = JUNIOR_SECONDARY_ARMS;
            showArms = true;
        } else if (hasSeniorSecondary && !hasJuniorSecondary) {
            armOptions = SENIOR_SECONDARY_ARMS;
            showArms = true;
        } else {
            // Mixed selection or no selection, don't show arms.
            showArms = false;
        }
    }
    
    const hideGradesAndArms = isALevelSchool || isNurserySchool;

    useEffect(() => {
        if (!showArms) {
            setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`, []);
        }
    }, [showArms, setValue, teacherIndex, assignmentIndex]);
     
    useEffect(() => {
        if(hideGradesAndArms) {
             setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`, [isALevelSchool ? "A-Level" : "Nursery"]);
             setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`, []);
        }
    }, [hideGradesAndArms, isALevelSchool, isNurserySchool, setValue, teacherIndex, assignmentIndex]);

    const gradeOptions = useMemo(() => {
        if (!selectedSchool) return ALL_GRADE_OPTIONS;
        return getGradeOptionsForSchool(selectedSchool.name);
    }, [selectedSchool]);

    const handleSchoolChange = (newSchoolId: string) => {
        setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`, newSchoolId);
        const currentGrades = getValues(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`);
        const newSelectedSchool = timetables.find(t => t.id === newSchoolId);
        if (currentGrades && newSelectedSchool) {
            const newGradeOptions = getGradeOptionsForSchool(newSelectedSchool.name);
            if(newGradeOptions.length === 0) {
                 setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`, [newSelectedSchool.name.toLowerCase().includes('a-level') ? "A-Level" : "Nursery"]);
            } else {
                const stillValidGrades = currentGrades.filter((g: string) => newGradeOptions.includes(g));
                 if (stillValidGrades.length !== currentGrades.length) {
                    setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`, stillValidGrades);
                }
            }
        }
    };


    return (
        <div className="flex items-start gap-2 p-2 border rounded-md relative">
             <Button type="button" variant="ghost" size="icon" onClick={() => remove(assignmentIndex)} className="absolute -top-2 -right-2 h-6 w-6 text-muted-foreground hover:text-destructive" disabled={fieldsLength <= 1}>
                <Trash2 className="h-4 w-4" />
            </Button>
            <div className="grid grid-cols-1 gap-y-2 w-full">
                <div className="grid grid-cols-[2fr_2fr_1fr] gap-x-2">
                    <FormField
                        control={control}
                        name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`}
                        render={({ field }) => (
                            <FormItem>
                                {assignmentIndex === 0 && <FormLabel>School</FormLabel>}
                                <Select onValueChange={handleSchoolChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="School" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {timetables.map((t) => ( <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem> ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={control}
                        name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.subject`}
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                {assignmentIndex === 0 && <FormLabel>Subject</FormLabel>}
                                <FormControl>
                                     <Input placeholder="Subject name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.periods`}
                        render={({ field }) => (
                            <FormItem>
                                {assignmentIndex === 0 && <FormLabel>Periods/wk</FormLabel>}
                                 <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Count" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map(p => (
                                            <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <div className={cn("grid grid-cols-1 gap-x-2", hideGradesAndArms && "hidden")}>
                    <FormField
                        control={control}
                        name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`}
                        render={({ field }) => (
                            <FormItem>
                                {assignmentIndex === 0 && <FormLabel>Grade(s)</FormLabel>}
                                {isSecondary ? (
                                    <div className="grid grid-cols-3 gap-x-4 gap-y-2 p-2 border rounded-md h-auto items-center">
                                        {[...SECONDARY_GRADES, ...A_LEVEL_GRADES].map(grade => (
                                            <FormField
                                                key={grade}
                                                control={control}
                                                name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`}
                                                render={({ field: checkboxField }) => (
                                                    <FormItem key={grade} className="flex flex-row items-center space-x-2 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={checkboxField.value?.includes(grade)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentValue = checkboxField.value || [];
                                                                    const newValue = checked
                                                                        ? [...currentValue, grade]
                                                                        : currentValue.filter(value => value !== grade);
                                                                    checkboxField.onChange(newValue);
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal text-sm">{grade.replace("Grade ", "").replace("A-Level ", "AL ")}</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Select 
                                        onValueChange={(value) => field.onChange(value ? [value] : [])} 
                                        value={Array.isArray(field.value) && field.value.length > 0 ? field.value[0] : ""} 
                                        disabled={!schoolId}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Grade" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <ScrollArea className="h-72">
                                            {gradeOptions.map((grade) => ( <SelectItem key={grade} value={grade}>{grade}</SelectItem> ))}
                                            </ScrollArea>
                                        </SelectContent>
                                    </Select>
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    </div>
                     <div className={cn("grid grid-cols-1 gap-y-2", hideGradesAndArms && "hidden")}>
                        {showArms && (
                            <FormField
                                control={control}
                                name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`}
                                render={() => (
                                <FormItem>
                                    {assignmentIndex === 0 && <FormLabel>Arms</FormLabel>}
                                    <div className="grid grid-cols-4 gap-x-4 gap-y-2 p-2 border rounded-md h-10 items-center">
                                        {armOptions.map((arm) => (
                                            <FormField
                                                key={arm}
                                                control={control}
                                                name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`}
                                                render={({ field: checkboxField }) => (
                                                    <FormItem key={arm} className="flex flex-row items-center space-x-2 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={checkboxField.value?.includes(arm)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentValue = checkboxField.value || [];
                                                                    const newValue = checked
                                                                        ? [...currentValue, arm]
                                                                        : currentValue.filter(value => value !== arm);
                                                                    checkboxField.onChange(newValue);
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal text-sm">{arm}</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <FormMessage />
                                    {hasJuniorSecondary && hasSeniorSecondary && (
                                        <p className="text-xs text-muted-foreground pt-1">Mixed junior/senior selection. Arms must be configured separately.</p>
                                    )}
                                </FormItem>
                                )}
                            />
                        )}
                    </div>
                
            </div>
        </div>
    )
}

const TeacherForm = ({ index, removeTeacher, isEditing }: { index: number, removeTeacher: () => void, isEditing: boolean }) => {
  const { control } = useFormContext<MultiTeacherFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: control,
    name: `teachers.${index}.assignments`
  });

  const { activeTimetable } = useTimetable();

  const watchedAssignments = useWatch({
    control,
    name: `teachers.${index}.assignments`,
  }) || [];

  const totalAssignedPeriods = watchedAssignments.reduce((acc: number, a: { periods: number; arms: string[] | null; grades: string[] | null; }) => {
    const isALevel = a.grades?.some(g => g.startsWith("A-Level"));
    const armCount = isALevel || !a.arms || a.arms.length === 0 ? 1 : a.arms.length;
    return acc + (a.periods * armCount * (a.grades?.length || 0));
  }, 0);

  return (
    <div className="space-y-6 p-4 border rounded-lg relative">
      {!isEditing && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={removeTeacher}
          className="absolute -top-3 -right-3 h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`teachers.${index}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teacher Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Mr. Smith" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-2 p-3 border rounded-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Subject Assignments</h3>
          <Badge variant="secondary">
            {totalAssignedPeriods} assigned period{totalAssignedPeriods !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="space-y-3">
          {fields.map((field, assignmentIndex) => (
            <AssignmentRow
              key={field.id}
              teacherIndex={index}
              assignmentIndex={assignmentIndex}
              control={control}
              remove={() => {
                if (fields.length > 1) {
                  remove(assignmentIndex);
                }
              }}
              fieldsLength={fields.length}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => append({ id: crypto.randomUUID(), grades: [], subject: "", arms: [], periods: 1, schoolId: activeTimetable?.id || '' })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Assignment
        </Button>
        <FormField
          control={control}
          name={`teachers.${index}.assignments`}
          render={({ fieldState }) => (
            fieldState.error?.root?.message && <p className="text-sm font-medium text-destructive">{fieldState.error.root.message}</p>
          )}
        />
      </div>
    </div>
  );
};


export default function TeacherEditor() {
  const { activeTimetable, addTeacher, removeTeacher, updateTeacher, timetables } = useTimetable();
  const allTeachers = timetables.flatMap(t => (t as any).teachers || []);
  const currentTeachers = activeTimetable?.teachers || [];
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const form = useForm<MultiTeacherFormValues>({
    resolver: zodResolver(multiTeacherSchema),
    defaultValues: {
      teachers: [],
    },
  });
  
  const { fields: teacherFields, append: appendTeacher, remove: removeTeacherField, replace } = useFieldArray({
    control: form.control,
    name: "teachers"
  });

  const getNewTeacherForm = (): TeacherFormValues => ({
    name: "",
    assignments: [{ id: crypto.randomUUID(), grades: [], subject: "", arms: [], periods: 1, schoolId: activeTimetable?.id || '' }],
  });

  const handleOpenDialog = (teacher: Teacher | null) => {
    if (!activeTimetable) return;
    setEditingTeacher(teacher);
    if (teacher) {
        replace([{
            id: teacher.id,
            name: teacher.name,
            assignments: teacher.assignments.length > 0 ? teacher.assignments.map(a => ({
                id: a.id || crypto.randomUUID(),
                grades: a.grades,
                subject: a.subject,
                arms: a.arms,
                periods: a.periods,
                schoolId: a.schoolId,
            })) : [{ id: crypto.randomUUID(), grades: [], subject: "", arms: [], periods: 1, schoolId: activeTimetable.id }],
        }]);
    } else {
        replace([getNewTeacherForm()]);
    }
    setIsDialogOpen(true);
  }

  function onSubmit(data: MultiTeacherFormValues) {
    if (!activeTimetable) return;

    data.teachers.forEach(teacherData => {
        const finalData: Teacher = {
            ...teacherData,
            id: teacherData.id || crypto.randomUUID(),
            assignments: teacherData.assignments.map(a => {
                const selectedSchool = timetables.find(t => t.id === a.schoolId);
                const schoolName = selectedSchool?.name.toLowerCase() || '';

                const isALevel = a.grades.some(g => g.startsWith('A-Level'));
                const isPrimary = schoolName.includes('primary');
                const isNurseryOrKinder = a.grades.some(g => g.includes('Nursery') || g.includes('Kindergarten'));
                const isALevelSchool = schoolName.includes('a-level');
                const isNurserySchool = schoolName.includes('nursery');

                return {
                    ...a,
                    id: a.id || crypto.randomUUID(),
                    arms: (isALevel || isPrimary || isNurseryOrKinder || isALevelSchool || isNurserySchool) ? [] : a.arms,
                }
            })
        }

        if (editingTeacher && finalData.id === editingTeacher.id) {
            updateTeacher(finalData);
        } else {
            addTeacher(finalData);
        }
    });
    
    form.reset();
    setIsDialogOpen(false);
    setEditingTeacher(null);
  }

  if (!activeTimetable) {
      return (
          <div className="p-4 text-center text-muted-foreground">
              Please select a school from the header to begin.
          </div>
      )
  }

  return (
    <div className="p-2 space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingTeacher(null);
          form.reset();
        }
      }}>
        <DialogTrigger asChild>
          <Button className="w-full" onClick={() => handleOpenDialog(null)}>
            <Plus className="mr-2" />
            Add Teachers
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{editingTeacher ? 'Edit Teacher' : 'Add New Teachers'}</DialogTitle>
          </DialogHeader>
            <FormProvider {...form}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <ScrollArea className="h-[60vh] p-4">
                    <div className="space-y-4">
                      {teacherFields.map((field, index) => (
                        <TeacherForm 
                          key={field.id}
                          index={index}
                          removeTeacher={() => removeTeacherField(index)}
                          isEditing={!!editingTeacher}
                        />
                      ))}
                      {!editingTeacher && (
                         <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => appendTeacher(getNewTeacherForm())}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Another Teacher
                          </Button>
                      )}
                    </div>
                  </ScrollArea>
                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                        {editingTeacher ? 'Save Changes' : `Save ${teacherFields.length} Teacher(s)`}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </FormProvider>
        </DialogContent>
      </Dialog>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-2 flex items-center"><Users className="mr-2 h-4 w-4"/>Teachers ({currentTeachers.length})</h3>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          {currentTeachers.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {currentTeachers.map((teacher) => (
                <AccordionItem value={teacher.id} key={teacher.id}>
                  <div className="flex items-center w-full hover:bg-muted/50 rounded-md">
                    <AccordionTrigger className="hover:no-underline px-2 flex-1">
                        <div className="flex flex-col items-start">
                           <span className="font-medium">{teacher.name}</span>
                           <span className="text-xs text-muted-foreground font-normal">{teacher.assignments.filter(a => a.schoolId === activeTimetable.id).reduce((acc, a) => {
                                const isALevel = a.grades.some(g => g.startsWith("A-Level"));
                                const armCount = isALevel || a.arms.length === 0 ? 1 : a.arms.length;
                                return acc + (a.periods * armCount * a.grades.length);
                           }, 0)} periods assigned</span>
                        </div>
                    </AccordionTrigger>
                     <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(teacher);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTeacher(teacher.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <AccordionContent className="px-2 pb-4">
                    <div className="space-y-3">
                      {teacher.assignments.filter(a => a.schoolId === activeTimetable.id).map((assignment) => (
                        <div key={assignment.id} className="text-sm text-muted-foreground pl-4 border-l-2 ml-2 pl-4 py-1">
                           <div className="flex items-center gap-2 font-semibold text-foreground/90">
                             <Book className="mr-2 h-4 w-4 text-primary" />
                             <span>{assignment.subject}</span>
                             <Badge variant="secondary">{assignment.periods} period{assignment.periods !== 1 ? 's' : ''}/week</Badge>
                           </div>
                           <div className="mt-2 space-y-2 pl-2">
                                <div className="flex items-center text-xs">
                                    <GraduationCap className="mr-2 h-3 w-3 text-primary/80" />
                                    <span>
                                        Grades: {assignment.grades.join(', ')}
                                        {assignment.arms.length > 0 && ` - Arms/Levels: ${assignment.arms.join(', ')}`}
                                    </span>
                                </div>
                           </div>
                        </div>
                      ))}
                       {teacher.assignments.filter(a => a.schoolId !== activeTimetable.id).length > 0 && (
                          <div className="text-xs text-muted-foreground italic pl-4 mt-4">
                            Also has {teacher.assignments.filter(a => a.schoolId !== activeTimetable.id).length} assignment(s) in other schools.
                          </div>
                       )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
             <div className="text-sm text-muted-foreground text-center p-8">
                No teachers created yet.
             </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

    