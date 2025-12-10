
"use client";

import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


import { useTimetable } from "@/context/timetable-provider";
import { Plus, Trash2, BookOpen, Users, Minus, Pencil, GraduationCap } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";
import type { Teacher, Subject } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";

const subjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Subject name is required."),
  grades: z.array(z.string()).min(1, "At least one grade is required."),
  arms: z.array(z.string()).min(1, "At least one arm is required."),
});


const teacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Teacher name is required."),
  subjects: z.array(subjectSchema).min(1, "At least one subject is required."),
});

type TeacherFormValues = z.infer<typeof teacherSchema>;

const GRADE_OPTIONS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const ARM_OPTIONS = ["A", "B", "C"];

const SubjectForm = ({ subjectIndex, control, removeSubject, canRemove }: { subjectIndex: number, control: any, removeSubject: () => void, canRemove: boolean }) => {
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
                <FormLabel>Class Assignment</FormLabel>
                <div className="p-3 border rounded-md bg-background/50 space-y-3">
                    <FormField
                        control={control}
                        name={`subjects.${subjectIndex}.grades`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Grades</FormLabel>
                            <div className="flex flex-wrap gap-4 p-2 border rounded-md">
                            {GRADE_OPTIONS.map((grade) => (
                            <FormField
                                key={grade}
                                control={control}
                                name={`subjects.${subjectIndex}.grades`}
                                render={({ field: gradeField }) => {
                                return (
                                    <FormItem
                                    key={grade}
                                    className="flex flex-row items-start space-x-2 space-y-0"
                                    >
                                    <FormControl>
                                        <Checkbox
                                        checked={gradeField.value?.includes(grade)}
                                        onCheckedChange={(checked) => {
                                            const currentValue = gradeField.value || [];
                                            return checked
                                            ? gradeField.onChange([...currentValue, grade])
                                            : gradeField.onChange(currentValue.filter(value => value !== grade))
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
                    <FormField
                        control={control}
                        name={`subjects.${subjectIndex}.arms`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Arms</FormLabel>
                            <div className="flex flex-wrap gap-4 p-2 border rounded-md">
                            {ARM_OPTIONS.map((arm) => (
                            <FormField
                                key={arm}
                                control={control}
                                name={`subjects.${subjectIndex}.arms`}
                                render={({ field: armField }) => {
                                return (
                                    <FormItem
                                    key={arm}
                                    className="flex flex-row items-start space-x-2 space-y-0"
                                    >
                                    <FormControl>
                                        <Checkbox
                                        checked={armField.value?.includes(arm)}
                                        onCheckedChange={(checked) => {
                                            const currentValue = armField.value || [];
                                            return checked
                                            ? armField.onChange([...currentValue, arm])
                                            : armField.onChange(currentValue.filter(value => value !== arm))
                                        }}
                                        />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                        Arm {arm}
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
                </div>
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
      subjects: [{ name: "", grades: [], arms: [] }],
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
                ...s,
            })) : [{ name: "", grades: [], arms: [] }],
        });
    } else {
        form.reset({
            name: "",
            subjects: [{ name: "", grades: [], arms: [] }],
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
                          onClick={() => appendSubject({ name: "", grades: [], arms: [] })}
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
                           <ul className="mt-2 space-y-1 pl-1">
                            {subject.grades.flatMap(grade => 
                                subject.arms.map(arm => {
                                    const uniqueKey = `${subject.id}-${grade}-${arm}`;
                                    return (
                                        <li key={uniqueKey} className="flex items-center gap-4">
                                            <div className="flex items-center text-xs">
                                                <GraduationCap className="mr-2 h-3 w-3 text-primary/80" />
                                                <span>{grade} {arm}</span>
                                            </div>
                                        </li>
                                    )
                                })
                            )}
                           </ul>
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
