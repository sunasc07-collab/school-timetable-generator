
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTimetable } from "@/context/timetable-provider";
import { Plus, Trash2, BookOpen, Users, Minus, Pencil, GraduationCap, GripVertical } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";
import type { Teacher, Subject } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const armGroupSchema = z.object({
    id: z.string().optional(),
    arms: z.array(z.string()).min(1, "At least one arm is required."),
    periods: z.number().min(1, "Periods must be > 0").default(1),
});

const assignmentSchema = z.object({
  id: z.string().optional(),
  grades: z.array(z.string()).min(1, "At least one grade is required."),
  armGroups: z.array(armGroupSchema).min(1, "At least one arm group is required."),
});

const subjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Subject name is required."),
  assignments: z.array(assignmentSchema).min(1, "At least one assignment is required."),
});

const teacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Teacher name is required."),
  subjects: z.array(subjectSchema).min(1, "At least one subject is required."),
});

type TeacherFormValues = z.infer<typeof teacherSchema>;

const GRADE_OPTIONS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const ARM_OPTIONS = ["A", "B", "C", "D"];

const ArmGroupForm = ({ subjectIndex, assignmentIndex, armGroupIndex, control, removeArmGroup, canRemoveArmGroup }: { subjectIndex: number; assignmentIndex: number; armGroupIndex: number; control: any; removeArmGroup: () => void; canRemoveArmGroup: boolean }) => {
    return (
        <div className="p-3 border rounded-md bg-background/50 relative space-y-3">
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeArmGroup}
                disabled={!canRemoveArmGroup}
                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <Minus className="h-4 w-4" />
            </Button>
            <div className="flex gap-4 items-end">
                <FormField
                    control={control}
                    name={`subjects.${subjectIndex}.assignments.${assignmentIndex}.armGroups.${armGroupIndex}.arms`}
                    render={({ field }) => (
                        <FormItem className="flex-1">
                            <FormLabel>Arms (grouped)</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between",
                                        !field.value?.length && "text-muted-foreground"
                                    )}
                                    >
                                    <div className="flex gap-1 flex-wrap">
                                        {field.value?.length > 0 ? (
                                            field.value.map((arm: string) => (
                                                <Badge
                                                variant="secondary"
                                                key={arm}
                                                className="mr-1 mb-1"
                                                >
                                                {arm}
                                                </Badge>
                                            ))
                                        ) : "Select Arms"}
                                    </div>
                                    <GripVertical className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search arms..." />
                                    <CommandEmpty>No arms found.</CommandEmpty>
                                    <CommandGroup>
                                    {ARM_OPTIONS.map((arm) => (
                                        <CommandItem
                                        value={arm}
                                        key={arm}
                                        onSelect={() => {
                                            const currentValue = field.value || [];
                                            const isSelected = currentValue.includes(arm);
                                            field.onChange(isSelected ? currentValue.filter((a: string) => a !== arm) : [...currentValue, arm]);
                                        }}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            (field.value || []).includes(arm)
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                        />
                                        Arm {arm}
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name={`subjects.${subjectIndex}.assignments.${assignmentIndex}.armGroups.${armGroupIndex}.periods`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Periods</FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    min="1" 
                                    className="w-24"
                                    {...field} 
                                    onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                                />
                            </FormControl>
                            <FormMessage/>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

const AssignmentForm = ({ subjectIndex, assignmentIndex, control, removeAssignment, canRemoveAssignment }: { subjectIndex: number, assignmentIndex: number, control: any, removeAssignment: () => void, canRemoveAssignment: boolean }) => {
    
    const { fields: armGroupFields, append: appendArmGroup, remove: removeArmGroup } = useFieldArray({
        control,
        name: `subjects.${subjectIndex}.assignments.${assignmentIndex}.armGroups`,
    });

    return (
        <div className="p-3 border rounded-md bg-background/50 relative space-y-3">
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeAssignment}
                disabled={!canRemoveAssignment}
                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <Minus className="h-4 w-4" />
            </Button>
            <FormField
                control={control}
                name={`subjects.${subjectIndex}.assignments.${assignmentIndex}.grades`}
                render={() => (
                <FormItem>
                    <FormLabel>Grades</FormLabel>
                    <div className="flex flex-wrap gap-4 p-2 border rounded-md">
                    {GRADE_OPTIONS.map((grade) => (
                    <FormField
                        key={grade}
                        control={control}
                        name={`subjects.${subjectIndex}.assignments.${assignmentIndex}.grades`}
                        render={({ field }) => {
                        return (
                            <FormItem
                            key={grade}
                            className="flex flex-row items-start space-x-2 space-y-0"
                            >
                            <FormControl>
                                <Checkbox
                                checked={field.value?.includes(grade)}
                                onCheckedChange={(checked) => {
                                    const currentValue = field.value || [];
                                    return checked
                                    ? field.onChange([...currentValue, grade])
                                    : field.onChange(currentValue.filter(value => value !== grade))
                                }}
                                />
                            </FormControl>
                            <FormLabel className="font-normal">
                                {grade}
                            </FormLabel>
                            </FormItem>
                        )
                        }}
                    />
                    ))}
                    </div>
                    <FormMessage />
                </FormItem>
                )}
            />
            
            <FormItem>
                <FormLabel>Arm Groups & Periods per week</FormLabel>
                <div className="p-2 border rounded-md space-y-3">
                    {armGroupFields.map((field, index) => (
                        <ArmGroupForm
                            key={field.id}
                            subjectIndex={subjectIndex}
                            assignmentIndex={assignmentIndex}
                            armGroupIndex={index}
                            control={control}
                            removeArmGroup={() => removeArmGroup(index)}
                            canRemoveArmGroup={armGroupFields.length > 1}
                        />
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => appendArmGroup({ arms: [], periods: 1, id: crypto.randomUUID() })}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Arm Group
                    </Button>
                </div>
            </FormItem>

        </div>
    )
}

const SubjectForm = ({ subjectIndex, control, removeSubject, canRemove }: { subjectIndex: number, control: any, removeSubject: () => void, canRemove: boolean }) => {
    
    const { fields: assignmentFields, append: appendAssignment, remove: removeAssignment } = useFieldArray({
        control,
        name: `subjects.${subjectIndex}.assignments`,
    });
    
    return (
        <div className="p-3 border rounded-md bg-muted/50 relative space-y-3">
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeSubject}
                disabled={!canRemove}
                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <Minus className="h-4 w-4" />
            </Button>
            <FormField
                control={control}
                name={`subjects.${subjectIndex}.name`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Subject Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Mathematics" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <div className="p-2 border rounded-md bg-background/50 relative space-y-2">
                <FormLabel>Class Assignments</FormLabel>
                 {assignmentFields.map((field, index) => (
                    <AssignmentForm
                        key={field.id}
                        subjectIndex={subjectIndex}
                        assignmentIndex={index}
                        control={control}
                        removeAssignment={() => removeAssignment(index)}
                        canRemoveAssignment={assignmentFields.length > 1}
                    />
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => appendAssignment({ grades: [], armGroups: [{arms: [], periods: 1, id: crypto.randomUUID()}], id: crypto.randomUUID() })}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Assignment Group
                </Button>
            </div>
        </div>
    )
}

export default function TeacherEditor() {
  const { teachers, addTeacher, removeTeacher, updateTeacher } = useTimetable();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: "",
      subjects: [{ name: "", assignments: [{ grades: [], armGroups: [{id: crypto.randomUUID(), arms: [], periods: 1 }] }] }],
    },
  });

  const { fields: subjectFields, append: appendSubject, remove: removeSubject } = useFieldArray({
    control: form.control,
    name: "subjects",
  });
  
  const handleOpenDialog = (teacher: Teacher | null) => {
    setEditingTeacher(teacher);
    if (teacher) {
        form.reset({
            id: teacher.id,
            name: teacher.name,
            subjects: teacher.subjects.length > 0 ? teacher.subjects.map(s => ({
                id: s.id || crypto.randomUUID(),
                name: s.name,
                assignments: s.assignments.length > 0 ? s.assignments.map(a => ({
                    id: a.id || crypto.randomUUID(),
                    grades: a.grades,
                    armGroups: a.armGroups.length > 0 ? a.armGroups.map(ag => ({
                        id: ag.id || crypto.randomUUID(),
                        arms: ag.arms,
                        periods: ag.periods
                    })) : [{ id: crypto.randomUUID(), arms: [], periods: 1 }]
                })) : [{ id: crypto.randomUUID(), grades: [], armGroups: [{ id: crypto.randomUUID(), arms: [], periods: 1 }] }],
            })) : [{ name: "", id: crypto.randomUUID(), assignments: [{ id: crypto.randomUUID(), grades: [], armGroups: [{ id: crypto.randomUUID(), arms: [], periods: 1 }] }] }],
        });
    } else {
        form.reset({
            name: "",
            subjects: [{ name: "", id: crypto.randomUUID(), assignments: [{ id: crypto.randomUUID(), grades: [], armGroups: [{ id: crypto.randomUUID(), arms: [], periods: 1 }] }] }],
        });
    }
    setIsDialogOpen(true);
  }

  function onSubmit(data: TeacherFormValues) {
    const finalData = {
        ...data,
        id: editingTeacher?.id,
        subjects: data.subjects.map(s => ({
            ...s,
            id: s.id || crypto.randomUUID(),
            assignments: s.assignments.map(a => ({
                ...a,
                id: a.id || crypto.randomUUID(),
                armGroups: a.armGroups.map(ag => ({
                    ...ag,
                    id: ag.id || crypto.randomUUID(),
                }))
            }))
        }))
    }

    if (editingTeacher && finalData.id) {
        updateTeacher(finalData.id, finalData.name, finalData.subjects as Subject[]);
    } else {
        addTeacher(finalData.name, finalData.subjects as Omit<Subject, "id">[]);
    }
    form.reset();
    setIsDialogOpen(false);
    setEditingTeacher(null);
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
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
          </DialogHeader>
            <FormProvider {...form}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <ScrollArea className="h-[60vh] p-4">
                    <div className="space-y-4">
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

                      <div className="space-y-4">
                        <FormLabel>Subjects</FormLabel>
                        <div className="space-y-3">
                          {subjectFields.map((field, index) => (
                            <SubjectForm 
                                key={field.id} 
                                subjectIndex={index} 
                                control={form.control} 
                                removeSubject={() => removeSubject(index)}
                                canRemove={subjectFields.length > 1}
                            />
                          ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => appendSubject({ name: "", assignments: [{ id: crypto.randomUUID(), grades: [], armGroups: [{ id: crypto.randomUUID(), arms: [], periods: 1 }] }] })}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Subject
                          </Button>
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
        <h3 className="text-sm font-medium text-muted-foreground px-2 flex items-center"><Users className="mr-2 h-4 w-4"/>Teachers ({teachers.length})</h3>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          {teachers.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {teachers.map((teacher) => (
                <AccordionItem value={teacher.id} key={teacher.id}>
                  <div className="flex items-center w-full hover:bg-muted/50 rounded-md">
                    <AccordionTrigger className="hover:no-underline px-2 flex-1">
                        <span className="font-medium">{teacher.name}</span>
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
                      {teacher.subjects.map((subject) => (
                        <div key={subject.id} className="text-sm text-muted-foreground pl-4 border-l-2 ml-2 pl-4 py-1">
                           <div className="flex items-center gap-2 font-semibold text-foreground/90">
                             <BookOpen className="mr-2 h-4 w-4 text-primary" />
                             <span>{subject.name}</span>
                           </div>
                           <div className="mt-2 space-y-2">
                            {subject.assignments.map(assignment => (
                                <div key={assignment.id} className="pl-2">
                                    {assignment.grades.flatMap(grade => 
                                        assignment.armGroups.map(ag => {
                                            const className = `${grade} ${ag.arms.join(', ')}`;
                                            const uniqueKey = `${assignment.id}-${grade}-${ag.id}`;
                                            return (
                                                <li key={uniqueKey} className="flex items-center gap-4 list-none">
                                                    <div className="flex items-center text-xs">
                                                        <GraduationCap className="mr-2 h-3 w-3 text-primary/80" />
                                                        <span>{className} ({ag.periods} periods)</span>
                                                    </div>
                                                </li>
                                            )
                                        })
                                    )}
                                </div>
                            ))}
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
                No teachers added yet. Click "Add Teacher" to begin.
             </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

    