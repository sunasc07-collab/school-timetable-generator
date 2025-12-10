"use client";

import { useFieldArray, useForm } from "react-hook-form";
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
import { Plus, Trash2, BookOpen, Users, Minus, Pencil, GraduationCap } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";
import type { Teacher } from "@/lib/types";

const subjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Subject name is required."),
  className: z.string().min(1, "Class name is required."),
  periods: z.coerce.number().min(1, "Periods must be at least 1."),
});

const teacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Teacher name is required."),
  subjects: z.array(subjectSchema).min(1, "At least one subject is required."),
});

type TeacherFormValues = z.infer<typeof teacherSchema>;

export default function TeacherEditor() {
  const { teachers, addTeacher, removeTeacher, updateTeacher } = useTimetable();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: "",
      subjects: [{ name: "", className: "", periods: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subjects",
  });
  
  const handleOpenDialog = (teacher: Teacher | null) => {
    setEditingTeacher(teacher);
    if (teacher) {
        form.reset({
            id: teacher.id,
            name: teacher.name,
            subjects: teacher.subjects,
        });
    } else {
        form.reset({
            name: "",
            subjects: [{ name: "", className: "", periods: 1 }],
        });
    }
    setIsDialogOpen(true);
  }

  function onSubmit(data: TeacherFormValues) {
    if (editingTeacher && data.id) {
        const subjectsWithIds = data.subjects.map(s => ({ ...s, id: s.id || crypto.randomUUID() }));
        updateTeacher(data.id, data.name, subjectsWithIds);
    } else {
        addTeacher(data.name, data.subjects);
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <div>
                <FormLabel>Subjects & Weekly Periods</FormLabel>
                <div className="space-y-2 mt-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start p-3 border rounded-md bg-muted/50 relative">
                       <div className="grid grid-cols-2 gap-2 flex-grow">
                         <FormField
                          control={form.control}
                          name={`subjects.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Subject</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Math" {...field} />
                              </FormControl>
                               <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`subjects.${index}.className`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Class</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Grade 9" {...field} />
                              </FormControl>
                               <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`subjects.${index}.periods`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Periods/Week</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 5" {...field} min="1" />
                              </FormControl>
                               <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                        className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => append({ name: "", className: "", periods: 1 })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Subject
                  </Button>
              </div>

              <DialogFooter>
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
                  <AccordionContent className="px-2">
                    <ul className="space-y-2 text-sm text-muted-foreground pl-4">
                      {teacher.subjects.map((subject) => (
                        <li key={subject.id} className="flex items-center gap-4">
                          <div className="flex items-center">
                            <BookOpen className="mr-2 h-4 w-4 text-primary" />
                            <span>{subject.name} - {subject.periods} p/w</span>
                          </div>
                          <div className="flex items-center">
                            <GraduationCap className="mr-2 h-4 w-4 text-primary/80" />
                            <span>{subject.className}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
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
