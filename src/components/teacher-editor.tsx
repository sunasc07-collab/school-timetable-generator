
"use client";

import { useForm, useFieldArray, FormProvider } from "react-hook-form";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTimetable } from "@/context/timetable-provider";
import { Plus, Trash2, Users, Pencil, Building, Book, GraduationCap } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useState, useEffect } from "react";
import type { Teacher, SubjectAssignment } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";


const assignmentSchema = z.object({
  id: z.string().optional(),
  grade: z.string().min(1, "A grade is required."),
  subject: z.string().min(1, "A subject is required."),
  arms: z.array(z.string()).min(1, "At least one arm is required."),
  periods: z.number().min(1, "Periods must be > 0").default(1),
});

const teacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Teacher name is required."),
  maxPeriods: z.number().min(1, "Max periods must be > 0").default(20),
  assignments: z.array(assignmentSchema).min(1, "At least one assignment is required."),
  schoolSections: z.array(z.string()).min(1, "At least one school is required."),
}).refine(data => {
    const totalAssignedPeriods = data.assignments.reduce((sum, a) => sum + (a.periods * a.arms.length), 0);
    return totalAssignedPeriods <= data.maxPeriods;
}, {
    message: "Total assigned periods cannot exceed the teacher's maximum periods.",
    path: ["assignments"],
});

type TeacherFormValues = z.infer<typeof teacherSchema>;

const GRADE_OPTIONS = ["Nursery", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "A-Level Year 1", "A-Level Year 2"];
const ARM_OPTIONS = ["A", "B", "C", "D"];

const AssignmentRow = ({ index, control, remove, fieldsLength }: { index: number, control: any, remove: (index: number) => void, fieldsLength: number }) => {

    return (
        <div className="flex items-start gap-2 p-2 border rounded-md relative">
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="absolute -top-2 -right-2 h-6 w-6 text-muted-foreground hover:text-destructive" disabled={fieldsLength <= 1}>
                <Trash2 className="h-4 w-4" />
            </Button>
            <FormField
                control={control}
                name={`assignments.${index}.grade`}
                render={({ field }) => (
                    <FormItem className="w-2/12">
                        {index === 0 && <FormLabel>Grade</FormLabel>}
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Grade" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <ScrollArea className="h-72">
                                  {GRADE_OPTIONS.map((grade) => ( <SelectItem key={grade} value={grade}>{grade}</SelectItem> ))}
                                </ScrollArea>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`assignments.${index}.subject`}
                render={({ field }) => (
                    <FormItem className="w-3/12 flex flex-col">
                        {index === 0 && <FormLabel>Subject</FormLabel>}
                        <FormControl>
                            <Input placeholder="Subject name" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`assignments.${index}.arms`}
                render={({ field }) => (
                <FormItem className="w-4/12">
                    {index === 0 && <FormLabel>Arms</FormLabel>}
                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-2 border rounded-md h-10 items-center">
                        {ARM_OPTIONS.map((arm) => (
                            <FormField
                                key={arm}
                                control={control}
                                name={`assignments.${index}.arms`}
                                render={({ field }) => (
                                    <FormItem key={arm} className="flex flex-row items-center space-x-2 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(arm)}
                                                onCheckedChange={(checked) => {
                                                    const currentValue = field.value || [];
                                                    return checked
                                                        ? field.onChange([...currentValue, arm])
                                                        : field.onChange(currentValue.filter(value => value !== arm));
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal text-sm"> {arm} </FormLabel>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={control}
                name={`assignments.${index}.periods`}
                render={({ field }) => (
                    <FormItem className="w-2/12">
                        {index === 0 && <FormLabel>Periods</FormLabel>}
                         <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Periods" />
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
    )
}


export default function TeacherEditor() {
  const { activeTimetable, allTeachers, timetables, addTeacher, removeTeacher, updateTeacher } = useTimetable();
  const currentTeachers = allTeachers.filter(t => activeTimetable && t.schoolSections.includes(activeTimetable.id));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: "",
      maxPeriods: 20,
      assignments: [{ grade: "", subject: "", arms: [], periods: 1 }],
      schoolSections: activeTimetable ? [activeTimetable.id] : [],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "assignments"
  });

  const watchedAssignments = form.watch("assignments");
  const maxPeriods = form.watch("maxPeriods");
  const totalAssignedPeriods = watchedAssignments.reduce((acc, a) => acc + (a.periods * (a.arms?.length || 0)), 0);
  const unassignedPeriods = maxPeriods - totalAssignedPeriods;

  const handleOpenDialog = (teacher: Teacher | null) => {
    setEditingTeacher(teacher);
    if (teacher) {
        form.reset({
            id: teacher.id,
            name: teacher.name,
            maxPeriods: teacher.maxPeriods,
            assignments: teacher.assignments.length > 0 ? teacher.assignments.map(a => ({
                id: a.id || crypto.randomUUID(),
                grade: a.grade,
                subject: a.subject,
                arms: a.arms,
                periods: a.periods
            })) : [{ id: crypto.randomUUID(), grade: "", subject: "", arms: [], periods: 1 }],
            schoolSections: teacher.schoolSections || (activeTimetable ? [activeTimetable.id] : []),
        });
    } else {
        form.reset({
            name: "",
            maxPeriods: 20,
            assignments: [{ id: crypto.randomUUID(), grade: "", subject: "", arms: [], periods: 1 }],
            schoolSections: activeTimetable ? [activeTimetable.id] : [],
        });
    }
    setIsDialogOpen(true);
  }

  function onSubmit(data: TeacherFormValues) {
    if (!activeTimetable) return;

    const finalData = {
        ...data,
        id: editingTeacher?.id || crypto.randomUUID(),
        assignments: data.assignments.map(a => ({
            ...a,
            id: a.id || crypto.randomUUID(),
        }))
    }

    if (editingTeacher) {
        updateTeacher(finalData as Teacher);
    } else {
        addTeacher(finalData as Teacher);
    }
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
        if (!open) setEditingTeacher(null);
      }}>
        <DialogTrigger asChild>
          <Button className="w-full" onClick={() => handleOpenDialog(null)}>
            <Plus className="mr-2" />
            Add Teacher
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
          </DialogHeader>
            <FormProvider {...form}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <ScrollArea className="h-[60vh] p-4">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="name"
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
                         <FormField
                            control={form.control}
                            name="maxPeriods"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Max Periods / week</FormLabel>
                                    <FormControl>
                                        <Input type="number" min="1" className="w-28" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                      </div>
                      
                      <FormField
                          control={form.control}
                          name="schoolSections"
                          render={() => (
                          <FormItem>
                              <div className="mb-2">
                                <FormLabel className="text-base">Schools</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                    Select the schools this teacher belongs to.
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 p-2 border rounded-md">
                                {timetables.map((timetable) => (
                                  <FormField
                                    key={timetable.id}
                                    control={form.control}
                                    name="schoolSections"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={timetable.id}
                                          className="flex flex-row items-center space-x-2 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(timetable.id)}
                                              onCheckedChange={(checked) => {
                                                const currentValue = field.value || [];
                                                return checked
                                                  ? field.onChange([...currentValue, timetable.id])
                                                  : field.onChange(currentValue.filter((value) => value !== timetable.id))
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal text-sm">
                                            {timetable.name}
                                          </FormLabel>
                                        </FormItem>
                                      );
                                    }}
                                  />
                                ))}
                              </div>
                              <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2 p-3 border rounded-md">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-medium">Subject Assignments</h3>
                             <Badge variant={unassignedPeriods >= 0 ? "secondary" : "destructive"}>
                                {unassignedPeriods} unassigned period{unassignedPeriods !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                        <div className="space-y-3">
                           {fields.map((field, index) => (
                                <AssignmentRow 
                                    key={field.id}
                                    index={index}
                                    control={form.control}
                                    remove={() => {
                                        if (fields.length > 1) {
                                            remove(index);
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
                            onClick={() => append({ id: crypto.randomUUID(), grade: "", subject: "", arms: [], periods: 1 })}
                            disabled={unassignedPeriods <= 0}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Assignment
                          </Button>
                         <FormField
                            control={form.control}
                            name="assignments"
                            render={({ fieldState }) => (
                                fieldState.error?.root?.message && <p className="text-sm font-medium text-destructive">{fieldState.error.root.message}</p>
                            )}
                        />
                      </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">Save Teacher</Button>
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
                           <span className="text-xs text-muted-foreground font-normal">{teacher.assignments.reduce((acc, a) => acc + (a.periods * a.arms.length), 0)} / {teacher.maxPeriods} periods</span>
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
                       <div className="text-sm text-muted-foreground pl-4 border-l-2 ml-2 pl-4 py-1">
                            <div className="flex items-center gap-2 font-semibold text-foreground/90">
                                <Building className="mr-2 h-4 w-4 text-primary" />
                                <span>Schools</span>
                            </div>
                            <div className="mt-2 space-x-2 pl-2">
                                {teacher.schoolSections.map(sectionId => {
                                    const timetable = timetables.find(t => t.id === sectionId);
                                    return timetable ? <Badge key={sectionId} variant="secondary">{timetable.name}</Badge> : null;
                                })}
                            </div>
                       </div>
                      {teacher.assignments.map((assignment) => (
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
                                        {assignment.grade} - Arms {assignment.arms.join(', ')}
                                    </span>
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
                No teachers assigned to this school. Add teachers or assign existing ones.
             </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
