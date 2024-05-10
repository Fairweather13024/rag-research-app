import { ChatPromptTemplate } from 'langchain/prompts';
import type {OpenAI as OpenAIClient} from 'openai';

export const NOTES_TOOL_SCHEMA : OpenAIClient.ChatCompletionTool = {
    type: 'function',
    function: {
        name: 'formatNotes',
        description: 'Format the notes response',
        parameters: {
            type: 'object',
            properties: {
                notes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            note: {
                                type: 'string',
                                description : 'The note content'
                            },
                            pageNumbers: {
                                type: 'array',
                                items: {
                                    type: 'number',
                                    description : 'The page number'
                                },
                            }
                        }
                    }
                }
            },
            required: ['notes']
        }
    }
}

export const NOTE_PROMPT = ChatPromptTemplate.fromMessages([
    [
        'ai',
        `Take notes on the following scientific paper.
        The goal is to be able to create a complete understanding of the paper in a clear manner.

        Rules:
        - Include specific quotes and details inside your notes.
        - Respond with as many notes as it might take to cover the entire paper.
        - Go into as much detail as you can whilst keeping the note on a very specific part of the paper.
        - Include notes about any results of any experiments teh paper describes
        - Include notes about any steps to reproduce the results of the experiments.
        - DO NOT respond with notes like: "The author discusses how well XYZ works." Instead, respond with the actual details of XYZ and how it works.

        Respond with a JSON array with two keys: "note" and "pageNumbers". The "note" key should contain the note content and the "pageNumbers" 
        key should contain an array of page numbers that the note is from (if the note spans more than one page).
        `
    ],
    ['human', 'Paper: {paper}'],
]);