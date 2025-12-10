'use server';

/**
 * @fileOverview AI-powered timetable generator flow.
 *
 * - generateInitialTimetable - A function that generates an initial timetable draft.
 * - GenerateInitialTimetableInput - The input type for the generateInitialTimetable function.
 * - GenerateInitialTimetableOutput - The return type for the generateInitialTimetable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInitialTimetableInputSchema = z.object({
  teachers: z
    .array(
      z.object({
        name: z.string().describe('The name of the teacher.'),
        subjects: z.array(z.string()).describe('The subjects taught by the teacher.'),
        periodsDesired: z
          .number()
          .int()
          .min(1)
          .describe('The number of periods desired for each subject.'),
      })
    )
    .describe('An array of teachers, their subjects, and desired periods.'),
});

export type GenerateInitialTimetableInput = z.infer<typeof GenerateInitialTimetableInputSchema>;

const GenerateInitialTimetableOutputSchema = z.object({
  timetable: z
    .string()
    .describe('A string representation of the generated timetable in JSON format.'),
});

export type GenerateInitialTimetableOutput = z.infer<typeof GenerateInitialTimetableOutputSchema>;

export async function generateInitialTimetable(
  input: GenerateInitialTimetableInput
): Promise<GenerateInitialTimetableOutput> {
  return generateInitialTimetableFlow(input);
}

const generateInitialTimetablePrompt = ai.definePrompt({
  name: 'generateInitialTimetablePrompt',
  input: {schema: GenerateInitialTimetableInputSchema},
  output: {schema: GenerateInitialTimetableOutputSchema},
  prompt: `You are an AI timetable generator. Given the following teachers, subjects, and desired periods, generate an initial timetable draft in JSON format.

Teachers, Subjects, and Desired Periods:
{{#each teachers}}
  Teacher Name: {{{name}}}
  Subjects: {{#each subjects}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  Periods Desired: {{{periodsDesired}}}
{{/each}}

Consider teacher availability and subject requirements to create a feasible schedule. Try to minimize conflicts. Return ONLY valid JSON. Do not return natural language.

Timetable:`,
});

const generateInitialTimetableFlow = ai.defineFlow(
  {
    name: 'generateInitialTimetableFlow',
    inputSchema: GenerateInitialTimetableInputSchema,
    outputSchema: GenerateInitialTimetableOutputSchema,
  },
  async input => {
    const {output} = await generateInitialTimetablePrompt(input);
    return output!;
  }
);
