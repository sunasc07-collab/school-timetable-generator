
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { useTimetable } from "@/context/timetable-provider";
import { Plus, Trash2, BookOpen, Users, Minus, Pencil, GraduationCap, Check, ChevronsUpDown } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";
import type { Teacher, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

const classArmSchema = z.object({
  id: z.string().optional(),
  grades: z.array(z.string()).min(1, "At least one grade is required."),
  arms: z.array(z.string()).min(1, "At least one arm is required."),
  periods: z.coerce.number().min(1, "Periods must be at least 1."),
});

const subjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Subject name is required."),
  classes: z.array(classArmSchema).min(1, "At least one class is required."),
});

const teacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Teacher name is required."),
  subjects: z.array(subjectSchema).min(1, "At least one subject is required."),
});

type TeacherFormValues = z.infer<typeof teacherSchema>;

const ARM_OPTIONS = ["A", "B", "C"];
const GRADE_OPTIONS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const SubjectForm = ({ subjectIndex, control, removeSubject }: { subjectIndex: number, control: any, removeSubject: (index: number) => void }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `subjects.${subjectIndex}.classes`,
    });

    return (
        <div className="p-3 border rounded-md bg-muted/50 relative space-y-3">
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSubject(subjectIndex)}
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
            <div className="space-y-2">
                 <FormLabel className="text-sm">Classes & Periods</FormLabel>
                {fields.map((field, classIndex) => (
                    <div key={field.id} className="p-2 border rounded-md bg-background/50 relative">
                       <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(classIndex)}
                            disabled={fields.length <= 1}
                            className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive z-10"
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                           <FormField
                                control={control}
                                name={`subjects.${subjectIndex}.classes.${classIndex}.grades`}
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Grades</FormLabel>
                                     <MultiSelect options={GRADE_OPTIONS} selected={field.value} onChange={field.onChange} placeholder="Select grades..." />
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`subjects.${subjectIndex}.classes.${classIndex}.arms`}
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Arms</FormLabel>
                                    <MultiSelect options={ARM_OPTIONS} selected={field.value} onChange={field.onChange} placeholder="Select arms..." />
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`subjects.${subjectIndex}.classes.${classIndex}.periods`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Periods/Week (each)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 5" {...field} min="1" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => append({ grades: [], arms: [], periods: 1 })}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Class Group
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
      subjects: [{ name: "", classes: [{ grades: [], arms: [], periods: 1 }] }],
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
            subjects: teacher.subjects.map(s => ({
                ...s,
                classes: s.classes.map(c => ({...c}))
            })),
        });
    } else {
        form.reset({
            name: "",
            subjects: [{ name: "", classes: [{ grades: [], arms: [], periods: 1 }] }],
        });
    }
    setIsDialogOpen(true);
  }

  function onSubmit(data: TeacherFormValues) {
    const subjectsWithIds = data.subjects.map(s => ({ 
        ...s, 
        id: s.id || crypto.randomUUID(),
        classes: s.classes.map(c => ({...c, id: c.id || crypto.randomUUID()}))
    }));

    if (editingTeacher && data.id) {
        updateTeacher(data.id, data.name, subjectsWithIds);
    } else {
        addTeacher(data.name, subjectsWithIds as Omit<Subject, 'id'>[]);
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
                              removeSubject={() => subjectFields.length > 1 && removeSubject(index)}
                          />
                        ))}
                      </div>
                      <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => appendSubject({ name: "", classes: [{grades: [], arms: [], periods: 1}] })}
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
                            {subject.classes.flatMap(classGroup => 
                                classGroup.grades.flatMap(grade => 
                                    classGroup.arms.map(arm => {
                                        const uniqueKey = `${classGroup.id}-${grade}-${arm}`;
                                        return (
                                            <li key={uniqueKey} className="flex items-center gap-4">
                                                <div className="flex items-center text-xs">
                                                    <GraduationCap className="mr-2 h-3 w-3 text-primary/80" />
                                                    <span>{grade} {arm} ({classGroup.periods} p/w)</span>
                                                </div>
                                            </li>
                                        )
                                    })
                                )
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

// MultiSelect component for grades and arms
function MultiSelect({ options, selected, onChange, placeholder }: { options: string[], selected: string[], onChange: (selected: string[]) => void, placeholder: string }) {
    const [open, setOpen] = useState(false);

    const handleSelect = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter(item => item !== value)
            : [...selected, value];
        onChange(newSelected);
    }
    
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    <span className="truncate">
                        {selected.length > 0 ? selected.join(", ") : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandEmpty>No options found.</CommandEmpty>
                    <CommandGroup>
                        <CommandList>
                        {options.map((option) => (
                            <CommandItem
                                key={option}
                                onSelect={() => {
                                    handleSelect(option);
                                    setOpen(true); // Keep popover open
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        selected.includes(option) ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {option}
                            </CommandItem>
                        ))}
                        </CommandList>
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

    