'use server';

/**
 * @fileOverview Summarizes the generated timetable by teacher, subject, or time slot.
 *
 * - summarizeTimetable - A function that summarizes the timetable.
 * - SummarizeTimetableInput - The input type for the summarizeTimetable function.
 * - SummarizeTimetableOutput - The return type for the summarizeTimetable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeTimetableInputSchema = z.object({
  timetableData: z.string().describe('The timetable data in JSON format.'),
  summaryType: z
    .enum(['teacher', 'subject', 'time slot'])
    .describe('The type of summary to generate.'),
});
export type SummarizeTimetableInput = z.infer<typeof SummarizeTimetableInputSchema>;

const SummarizeTimetableOutputSchema = z.object({
  summary: z.string().describe('The summary of the timetable.'),
});
export type SummarizeTimetableOutput = z.infer<typeof SummarizeTimetableOutputSchema>;

export async function summarizeTimetable(input: SummarizeTimetableInput): Promise<SummarizeTimetableOutput> {
  return summarizeTimetableFlow(input);
}

const summarizeTimetablePrompt = ai.definePrompt({
  name: 'summarizeTimetablePrompt',
  input: {schema: SummarizeTimetableInputSchema},
  output: {schema: SummarizeTimetableOutputSchema},
  prompt: `You are a timetable summarization expert. Please summarize the following timetable data by {{{summaryType}}}.\n\nTimetable Data: {{{timetableData}}}`,
});

const summarizeTimetableFlow = ai.defineFlow(
  {
    name: 'summarizeTimetableFlow',
    inputSchema: SummarizeTimetableInputSchema,
    outputSchema: SummarizeTimetableOutputSchema,
  },
  async input => {
    const {output} = await summarizeTimetablePrompt(input);
    return output!;
  }
);
