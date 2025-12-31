
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
import { useEffect, useState, useMemo, useCallback } from "react";
import type { Teacher, SubjectAssignment } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const assignmentSchema = z.object({
  id: z.string().optional(),
  grades: z.array(z.string()).min(1, "At least one grade is required."),
  subject: z.string().min(1, "A subject is required."),
  arms: z.array(z.string()),
  periods: z.number().min(1, "Periods must be > 0").default(1),
  schoolId: z.string().min(1, "A school is required."),
  subjectType: z.string().optional(),
  isCore: z.boolean().optional(),
  optionGroup: z.enum(['A', 'B', 'C', 'D', 'E']).nullable().optional(),
  days: z.array(z.string()).optional(),
}).refine(data => !(data.subjectType === 'core' && data.optionGroup), {
    message: "A subject cannot be both a Core Subject and an Option.",
    path: ["subjectType"],
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

const ALL_GRADE_OPTIONS = ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "A-Level Year 1", "A-Level Year 2"];
const PRE_SCHOOL_GRADES = ["Nursery 1", "Nursery 2", "Kindergarten"];
const PRIMARY_GRADES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];
const JUNIOR_SECONDARY_GRADES = ["Grade 7", "Grade 8", "Grade 9"];
const SECONDARY_GRADES = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const SENIOR_SECONDARY_GRADES = ["Grade 10", "Grade 11", "Grade 12"];
const A_LEVEL_GRADES = ["A-Level Year 1", "A-Level Year 2"];

const JUNIOR_SECONDARY_ARMS = ["A", "Primrose"];
const SENIOR_SECONDARY_ARMS = ["P", "D", "L", "M"];
const OPTION_GROUPS = ['A', 'B', 'C', 'D', 'E'] as const;
const PRIMARY_ARMS = ["A", "B", "C"];


const getGradeOptionsForSchool = (schoolName: string) => {
    const lowerCaseSchoolName = schoolName.toLowerCase();
    if (lowerCaseSchoolName.includes('primary')) {
        return [...PRE_SCHOOL_GRADES, ...PRIMARY_GRADES];
    }
    if (lowerCaseSchoolName.includes('secondary')) {
        return [...SECONDARY_GRADES, ...A_LEVEL_GRADES];
    }
     if (lowerCaseSchoolName.includes('a-level')) {
        return [];
    }
    return ALL_GRADE_OPTIONS;
};

const AssignmentRow = ({ teacherIndex, assignmentIndex, control, remove, fieldsLength }: { teacherIndex: number, assignmentIndex: number, control: any, remove: (index: number) => void, fieldsLength: number }) => {
    const { timetables, activeTimetable } = useTimetable();
    const { setValue, getValues, trigger, formState: { errors } } = useFormContext();
    
    const [customArms, setCustomArms] = useState<string[]>([]);
    const [newArm, setNewArm] = useState('');
    
    const schoolId = useWatch({
        control,
        name: `teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`
    });

    const selectedGrades = useWatch({
      control,
      name: `teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`,
    }) || [];
    
    const subjectType = useWatch({
        control,
        name: `teachers.${teacherIndex}.assignments.${assignmentIndex}.subjectType`
    })

    const selectedSchool = useMemo(() => timetables.find(t => t.id === schoolId), [schoolId, timetables]);
    const schoolName = selectedSchool?.name.toLowerCase() || '';

    const isSecondary = schoolName.includes('secondary');
    const isPrimary = schoolName.includes('primary');
    
    const isALevelSchool = schoolName.includes('a-level');
    const isNurserySchool = schoolName.includes('nursery');
    
    const hasALevel = selectedGrades.some((g: string) => g.startsWith("A-Level"));

    const hasJuniorSecondary = selectedGrades.some((g: string) => JUNIOR_SECONDARY_GRADES.includes(g));
    const hasSeniorSecondary = Array.isArray(selectedGrades) && selectedGrades.some((g: string) => SENIOR_SECONDARY_GRADES.includes(g));
    
    const isCoreSenior = hasSeniorSecondary && subjectType === 'core';

    let armOptions: string[] = [];
    let showArms = false;

    if (isSecondary && !hasALevel) {
      if (hasJuniorSecondary && !hasSeniorSecondary) {
        armOptions = JUNIOR_SECONDARY_ARMS;
        showArms = true;
      } else if ((hasSeniorSecondary || hasJuniorSecondary) && isCoreSenior) {
        armOptions = hasSeniorSecondary ? SENIOR_SECONDARY_ARMS : JUNIOR_SECONDARY_ARMS;
        showArms = true;
      }
      else if (hasSeniorSecondary && !hasJuniorSecondary) {
        showArms = subjectType === 'core';
        armOptions = SENIOR_SECONDARY_ARMS;
      } else if (hasSeniorSecondary && hasJuniorSecondary) {
        showArms = true; 
        armOptions = JUNIOR_SECONDARY_ARMS;
      } else {
        showArms = false;
      }
    } else if (isPrimary) {
        armOptions = PRIMARY_ARMS;
        showArms = true;
    }
    
    const allArmOptions = useMemo(() => {
        const currentArms = getValues(`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`) || [];
        const baseArms = isPrimary ? PRIMARY_ARMS : (isSecondary ? [...JUNIOR_SECONDARY_ARMS, ...SENIOR_SECONDARY_ARMS] : []);
        const dynamicArms = currentArms.filter((arm: string) => !baseArms.includes(arm));
        return [...new Set([...baseArms, ...customArms, ...dynamicArms])];
    }, [isPrimary, isSecondary, customArms, getValues, teacherIndex, assignmentIndex]);

    const handleAddArm = () => {
        if (newArm && !allArmOptions.includes(newArm)) {
            setCustomArms(prev => [...prev, newArm]);
        }
        setNewArm('');
    };

    const hideGradesAndArms = isALevelSchool || isNurserySchool;
    
    useEffect(() => {
        if (!getValues(`teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`) && activeTimetable) {
            setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`, activeTimetable.id);
        }
    }, [activeTimetable, teacherIndex, assignmentIndex, setValue, getValues]);


    const gradeOptions = useMemo(() => {
        if (!selectedSchool) return ALL_GRADE_OPTIONS;
        return getGradeOptionsForSchool(selectedSchool.name);
    }, [selectedSchool]);

    useEffect(() => {
        if (selectedSchool) {
            const currentGrades = getValues(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`) || [];
            const newSchoolName = selectedSchool.name.toLowerCase();
            const isNewALevel = newSchoolName.includes('a-level');
            const isNewNursery = newSchoolName.includes('nursery');

            if(isNewALevel) {
                 setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`, ["A-Level"]);
                 setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`, []);
            } else if(isNewNursery) {
                 setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`, [selectedSchool.name]);
                 setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`, []);
            } else {
                const stillValidGrades = currentGrades.filter((g: string) => gradeOptions.includes(g));
                 if (stillValidGrades.length !== currentGrades.length) {
                    setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`, stillValidGrades);
                }
            }
        }
    }, [setValue, getValues, teacherIndex, assignmentIndex, selectedSchool, gradeOptions]);

    useEffect(() => {
        const isOptionalOrCoreSenior = hasSeniorSecondary && (getValues(`teachers.${teacherIndex}.assignments.${assignmentIndex}.subjectType`) === 'optional' || getValues(`teachers.${teacherIndex}.assignments.${assignmentIndex}.subjectType`) === 'core');
        if (!showArms && !isOptionalOrCoreSenior) {
            setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`, []);
        }
    }, [showArms, hasSeniorSecondary, setValue, getValues, teacherIndex, assignmentIndex]);


    const handleSchoolChange = (newSchoolId: string) => {
        setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`, newSchoolId);
        trigger(`teachers.${teacherIndex}.assignments.${assignmentIndex}.schoolId`);
    };
    
    const assignmentErrors = (errors?.teachers as any)?.[teacherIndex]?.assignments?.[assignmentIndex];

    const handleSubjectTypeChange = (type: string) => {
        setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.subjectType`, type);
        if (type !== 'optional') {
            setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.optionGroup`, null);
        }
        if (type !== 'core') {
          const currentGrades = getValues(`teachers.${teacherIndex}.assignments.${assignmentIndex}.grades`);
          const hasJunior = currentGrades.some((g: string) => JUNIOR_SECONDARY_GRADES.includes(g));
           if (type === 'optional' && !hasJunior) {
              setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`, []);
           }
        }
        trigger(`teachers.${teacherIndex}.assignments.${assignmentIndex}`);
    }

    const handleOptionGroupChange = (group: string) => {
        setValue(`teachers.${teacherIndex}.assignments.${assignmentIndex}.optionGroup`, group);
        trigger(`teachers.${teacherIndex}.assignments.${assignmentIndex}`);
    }
    
    const shouldShowSeniorArms = hasSeniorSecondary && (subjectType === 'core' || subjectType === 'optional');

    const relevantArmOptions = useMemo(() => {
        if (isPrimary) return allArmOptions.filter(arm => PRIMARY_ARMS.includes(arm) || customArms.includes(arm));
        if (isSecondary) {
            if (hasSeniorSecondary) return allArmOptions.filter(arm => SENIOR_SECONDARY_ARMS.includes(arm) || customArms.includes(arm));
            if (hasJuniorSecondary) return allArmOptions.filter(arm => JUNIOR_SECONDARY_ARMS.includes(arm) || customArms.includes(arm));
        }
        return [];
    }, [isPrimary, isSecondary, hasSeniorSecondary, hasJuniorSecondary, allArmOptions, customArms]);


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
                        render={() => (
                            <FormItem>
                                {assignmentIndex === 0 && <FormLabel>Grade(s)</FormLabel>}
                                <div className="grid grid-cols-3 gap-x-4 gap-y-2 p-2 border rounded-md h-auto items-center">
                                    {gradeOptions.map(grade => (
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
                                                    <FormLabel className="font-normal text-sm">{isSecondary ? grade.replace("Grade ", "").replace("A-Level Year", "Year") : grade}</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    </div>
                     <div className="grid grid-cols-1 gap-y-2">
                        <FormField
                            control={control}
                            name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.days`}
                            render={() => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                  {assignmentIndex === 0 && <FormLabel>Teaching Days</FormLabel>}
                                </div>
                                <div className="grid grid-cols-5 gap-x-2 gap-y-2 p-2 border rounded-md h-auto items-center">
                                    {(selectedSchool?.days || activeTimetable?.days || []).map((day) => (
                                        <FormField
                                            key={day}
                                            control={control}
                                            name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.days`}
                                            render={({ field: checkboxField }) => (
                                                <FormItem key={day} className="flex flex-row items-center space-x-2 space-y-0">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={checkboxField.value?.includes(day)}
                                                            onCheckedChange={(checked) => {
                                                                const currentValue = checkboxField.value || [];
                                                                const newValue = checked
                                                                    ? [...currentValue, day]
                                                                    : currentValue.filter(value => value !== day);
                                                                checkboxField.onChange(newValue);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal text-sm">{day}</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    {isSecondary && (
                        <div className="grid grid-cols-1 gap-4 rounded-md border p-2">
                          <Label className="text-xs font-medium text-muted-foreground">Secondary Options</Label>
                          <div className="grid grid-cols-2 gap-2">
                             <FormField
                                 control={control}
                                 name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.subjectType`}
                                 render={({ field }) => (
                                     <FormItem>
                                         <FormLabel>Subject Type</FormLabel>
                                         <Select onValueChange={handleSubjectTypeChange} value={field.value}>
                                             <FormControl>
                                                 <SelectTrigger>
                                                     <SelectValue placeholder="Select type" />
                                                 </SelectTrigger>
                                             </FormControl>
                                             <SelectContent>
                                                 <SelectItem value="core">Core Subject</SelectItem>
                                                 <SelectItem value="optional">Optional Subject</SelectItem>
                                             </SelectContent>
                                         </Select>
                                         <FormMessage />
                                     </FormItem>
                                 )}
                             />
                             {subjectType === 'optional' ? (
                                 <FormField
                                     control={control}
                                     name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.optionGroup`}
                                     render={({ field }) => (
                                         <FormItem>
                                             <FormLabel>Option Group</FormLabel>
                                             <Select onValueChange={handleOptionGroupChange} value={field.value || ""}>
                                                 <FormControl>
                                                     <SelectTrigger>
                                                         <SelectValue placeholder="Group" />
                                                     </SelectTrigger>
                                                 </FormControl>
                                                 <SelectContent>
                                                     {OPTION_GROUPS.map(group => (
                                                         <SelectItem key={group} value={group}> {group}</SelectItem>
                                                     ))}
                                                 </SelectContent>
                                             </Select>
                                             <FormMessage />
                                         </FormItem>
                                     )}
                                 />
                             ): null}
                              {assignmentErrors?.subjectType?.message && <p className="text-sm font-medium text-destructive col-span-2">{assignmentErrors.subjectType.message as string}</p>}
                         </div>
                         {shouldShowSeniorArms && (
                         <FormField
                            control={control}
                            name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`}
                            render={() => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>Arms</FormLabel>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                                            <Plus className="mr-1 h-3 w-3" /> Add Others
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-2">
                                        <div className="grid gap-2">
                                            <Input
                                                placeholder="New arm..."
                                                value={newArm}
                                                onChange={(e) => setNewArm(e.target.value.toUpperCase())}
                                                className="h-8"
                                            />
                                            <Button onClick={handleAddArm} size="sm" className="h-8">Add Arm</Button>
                                        </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="grid grid-cols-4 gap-x-4 gap-y-2 p-2 border rounded-md h-auto items-center">
                                    {allArmOptions.filter(arm => SENIOR_SECONDARY_ARMS.includes(arm) || customArms.includes(arm)).map((arm) => (
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
                            </FormItem>
                            )}
                        />
                        )}
                        </div>
                    )}
                    <div className={cn("grid grid-cols-1 gap-y-2", (hideGradesAndArms || !showArms) && "hidden")}>
                        <FormField
                            control={control}
                            name={`teachers.${teacherIndex}.assignments.${assignmentIndex}.arms`}
                            render={() => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                  {assignmentIndex === 0 && <FormLabel>Arms</FormLabel>}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className={cn("h-6 text-xs px-2", assignmentIndex > 0 && "mt-6")}>
                                            <Plus className="mr-1 h-3 w-3" /> Add Others
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-2">
                                        <div className="grid gap-2">
                                            <Input
                                                placeholder="New arm..."
                                                value={newArm}
                                                onChange={(e) => setNewArm(e.target.value.toUpperCase())}
                                                className="h-8"
                                            />
                                            <Button onClick={handleAddArm} size="sm" className="h-8">Add Arm</Button>
                                        </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="grid grid-cols-4 gap-x-4 gap-y-2 p-2 border rounded-md h-auto items-center">
                                    {relevantArmOptions.map((arm) => (
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
                            {isSecondary && hasJuniorSecondary && hasSeniorSecondary && (
                                <p className="text-xs text-muted-foreground pt-1">Mixed junior/senior selection. Arms must be configured separately.</p>
                            )}
                        </FormItem>
                        )}
                    />
                </div>
            </div>
        </div>
    )
}

const TeacherForm = ({ index, removeTeacher, isEditing }: { index: number, removeTeacher: () => void, isEditing: boolean }) => {
  const { control, setValue } = useFormContext<MultiTeacherFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: control,
    name: `teachers.${index}.assignments`
  });

  const { activeTimetable, timetables } = useTimetable();
  const teacherId = useWatch({ control, name: `teachers.${index}.id`});
  const teacherName = useWatch({ control, name: `teachers.${index}.name`});

  const getGeneratedPeriodsForTeacher = useCallback((teacherId: string) => {
      if (!timetables || timetables.length === 0) {
          return 0;
      }

      let count = 0;
      timetables.forEach(tt => {
        if (tt.timetable && Object.keys(tt.timetable).length > 0) {
            for (const day in tt.timetable) {
                const daySlots = tt.timetable[day];
                for (const slot of daySlots) {
                    for (const session of slot) {
                        if (session.teacherId === teacherId) {
                            count++;
                        }
                    }
                }
            }
        }
      });
      return count;
  }, [timetables]);


  const totalGeneratedPeriods = useMemo(() => {
    if (!teacherId) return 0;
    return getGeneratedPeriodsForTeacher(teacherId);
  }, [teacherId, getGeneratedPeriodsForTeacher]);
  
  const handleAddNewAssignment = () => {
    const newAssignment: SubjectAssignment = { 
        id: crypto.randomUUID(), 
        grades: [], 
        subject: "", 
        arms: [], 
        periods: 1, 
        schoolId: activeTimetable?.id || '',
        days: activeTimetable?.days || []
    };
    append(newAssignment);
  }

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
              {totalGeneratedPeriods} generated period{totalGeneratedPeriods !== 1 ? 's' : ''}
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
          onClick={handleAddNewAssignment}
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
  const { activeTimetable, addTeacher, removeTeacher, updateTeacher, timetables, allTeachers } = useTimetable();
  
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

  const getNewTeacherForm = useCallback((): TeacherFormValues => ({
    name: "",
    assignments: [{ 
        id: crypto.randomUUID(), 
        grades: [], 
        subject: "", 
        arms: [], 
        periods: 1, 
        schoolId: activeTimetable?.id || '',
        days: activeTimetable?.days || []
    }],
  }), [activeTimetable?.id, activeTimetable?.days]);

  const groupAssignmentsForEditing = (assignments: SubjectAssignment[]): TeacherFormValues['assignments'] => {
      const grouped = new Map<string, SubjectAssignment>();

      assignments.forEach(assignment => {
          const key = `${assignment.schoolId}-${assignment.subject}-${assignment.periods}-${assignment.optionGroup || ''}-${assignment.subjectType || ''}-${(assignment.days || []).join(',')}`;
          
          if (grouped.has(key)) {
              const existing = grouped.get(key)!;
              const newGrades = [...new Set([...existing.grades, ...assignment.grades])].sort();
              const newArms = [...new Set([...existing.arms, ...assignment.arms])].sort();
              grouped.set(key, { ...existing, grades: newGrades, arms: newArms });
          } else {
              grouped.set(key, { ...assignment });
          }
      });
      return Array.from(grouped.values());
  };
  
  const handleOpenDialog = (teacher: Teacher | null) => {
    setEditingTeacher(teacher);
    if (teacher) {
        const teacherFormData: TeacherFormValues = {
            id: teacher.id,
            name: teacher.name,
            assignments: groupAssignmentsForEditing(teacher.assignments.map(a => ({
                ...a,
                id: a.id || crypto.randomUUID(),
                subjectType: a.isCore ? 'core' : (a.optionGroup ? 'optional' : undefined),
                days: a.days || activeTimetable?.days || []
            }))),
        };
        form.reset({ teachers: [teacherFormData] });
    } else {
        form.reset({ teachers: [getNewTeacherForm()] });
    }
    setIsDialogOpen(true);
  }
  
  useEffect(() => {
    // When the active timetable changes, if the dialog is open, close it.
    if (activeTimetable) {
        setIsDialogOpen(false);
        setEditingTeacher(null);
        form.reset({ teachers: [] });
    }
  }, [activeTimetable, form]);


  function onSubmit(data: MultiTeacherFormValues) {
    data.teachers.forEach(teacherData => {
        const expandedAssignments: SubjectAssignment[] = [];
        
        teacherData.assignments.forEach(formAssignment => {
            const assignmentBase = {
                ...formAssignment,
                id: formAssignment.id || crypto.randomUUID(),
                isCore: formAssignment.subjectType === 'core',
                optionGroup: formAssignment.subjectType === 'optional' ? formAssignment.optionGroup : null,
            };
            
            const school = timetables.find(t => t.id === formAssignment.schoolId);
            const isSecondary = school?.name.toLowerCase().includes('secondary');

            if (isSecondary) {
                 expandedAssignments.push({
                    ...assignmentBase,
                    grades: formAssignment.grades,
                    arms: formAssignment.arms || [], 
                });
            } else {
                 formAssignment.grades.forEach(grade => {
                    expandedAssignments.push({
                        ...assignmentBase,
                        grades: [grade],
                        arms: formAssignment.arms || [], 
                    });
                });
            }
        });

        const teacherWithId: Teacher = {
            ...teacherData,
            id: teacherData.id || crypto.randomUUID(),
            assignments: expandedAssignments,
        };

        if (editingTeacher) {
            updateTeacher(teacherWithId);
        } else {
            addTeacher(teacherWithId);
        }
    });

    form.reset({ teachers: [] });
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
  
  const getGeneratedPeriodsForTeacher = useCallback((teacherId: string) => {
    let count = 0;
    timetables.forEach(tt => {
      if (tt.timetable && Object.keys(tt.timetable).length > 0) {
         for (const day in tt.timetable) {
            const daySlots = tt.timetable[day];
            for (const slot of daySlots) {
                for (const session of slot) {
                    if (session.teacherId === teacherId) {
                        count++;
                    }
                }
            }
        }
      }
    });
    return count;
  }, [timetables]);


  return (
    <div className="p-2 space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingTeacher(null);
          form.reset({ teachers: [] });
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
                        {editingTeacher ? 'Save Changes' : `Save ${teacherFields.length > 0 ? teacherFields.length : ''} Teacher(s)`}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </FormProvider>
        </DialogContent>
      </Dialog>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-2 flex items-center"><Users className="mr-2 h-4 w-4"/>Teachers ({allTeachers.length})</h3>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          {allTeachers.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {allTeachers.map((teacher) => (
                <AccordionItem value={teacher.id} key={teacher.id}>
                  <div className="flex items-center w-full hover:bg-muted/50 rounded-md">
                    <AccordionTrigger className="hover:no-underline px-2 flex-1">
                        <div className="flex flex-col items-start">
                           <span className="font-medium">{teacher.name}</span>
                           <span className="text-xs text-muted-foreground font-normal">
                                {getGeneratedPeriodsForTeacher(teacher.id)} periods generated
                           </span>
                        </div>
                    </AccordionTrigger>
                     <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        const teacherToEdit = allTeachers.find(t => t.id === teacher.id);
                        if (teacherToEdit) handleOpenDialog(teacherToEdit);
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
                      {groupAssignmentsForEditing(teacher.assignments).map((assignment) => (
                        <div key={assignment.id} className="text-sm text-muted-foreground pl-4 border-l-2 ml-2 pl-4 py-1">
                           <div className="flex items-center gap-2 font-semibold text-foreground/90">
                             <Book className="mr-2 h-4 w-4 text-primary" />
                             <span>{assignment.subject}</span>
                              <Badge variant="secondary">{assignment.periods} period{assignment.periods !== 1 ? 's' : ''}/week</Badge>
                              {assignment.isCore && <Badge variant="outline">Core</Badge>}
                              {assignment.optionGroup && <Badge variant="outline">Option {assignment.optionGroup}</Badge>}
                           </div>
                           <div className="mt-2 space-y-2 pl-2">
                                <div className="flex items-center text-xs">
                                    <GraduationCap className="mr-2 h-3 w-3 text-primary/80" />
                                    <span>
                                        Grades: {assignment.grades.join(', ')}
                                        {assignment.arms.length > 0 && ` - Arms: ${assignment.arms.join(', ')}`}
                                    </span>
                                </div>
                                 <div className="flex items-center text-xs">
                                    <Building className="mr-2 h-3 w-3 text-primary/80" />
                                     <span>School: {timetables.find(t => t.id === assignment.schoolId)?.name || 'Unknown'}</span>
                                </div>
                           </div>
                        </div>
                      ))}
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

    