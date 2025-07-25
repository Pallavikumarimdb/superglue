import Anthropic from "@anthropic-ai/sdk";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { LLM, LLMObjectResponse, LLMResponse } from "./llm.js";

export class AnthropicModel implements LLM {
    public contextLength: number = 200000; // Claude 3 supports up to 200k tokens
    private client: Anthropic;
    private model: string;

    constructor(model: string = null) {
        this.model = model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || "",
        });
    }

    async generateText(messages: ChatCompletionMessageParam[], temperature: number = 0): Promise<LLMResponse> {
        const { system, anthropicMessages } = this.convertToAnthropicFormat(messages);
        
        const dateMessage = `The current date and time is ${new Date().toISOString()}`;
        const fullSystem = system ? `${system}\n\n${dateMessage}` : dateMessage;

        const response = await this.client.messages.create({
            model: this.model,
            system: fullSystem,
            messages: anthropicMessages,
            temperature,
            max_tokens: 8192,
        });

        const responseText = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        // Add response to messages history
        const updatedMessages = [...messages, {
            role: "assistant",
            content: responseText
        } as ChatCompletionMessageParam];

        return {
            response: responseText,
            messages: updatedMessages
        };
    }

    async generateObject(messages: ChatCompletionMessageParam[], schema: any, temperature: number = 0): Promise<LLMObjectResponse> {
        const { system, anthropicMessages } = this.convertToAnthropicFormat(messages);
        
        // Add schema instruction to the last user message with XML tags for better extraction
        let lastUserIdx = -1;
        for (let i = anthropicMessages.length - 1; i >= 0; i--) {
            if (anthropicMessages[i].role === 'user') {
                lastUserIdx = i;
                break;
            }
        }
        
        if (lastUserIdx !== -1) {
            const schemaInstruction = `\n\nPlease respond with a JSON object that matches this schema, wrapped in <json> tags:
<json>
${JSON.stringify(schema, null, 2)}
</json>

Your response must contain ONLY the JSON object within the <json> tags, with no additional text or explanation.`;
            anthropicMessages[lastUserIdx].content += schemaInstruction;
        }

        const dateMessage = `The current date and time is ${new Date().toISOString()}`;
        const fullSystem = system ? `${system}\n\n${dateMessage}` : dateMessage;

        const response = await this.client.messages.create({
            model: this.model,
            system: fullSystem,
            messages: anthropicMessages,
            temperature,
            max_tokens: 8192,
        });

        const responseText = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        // Try multiple extraction strategies
        let generatedObject: any = null;
        let extractionError: string | null = null;

        // Strategy 1: Extract from XML tags
        const xmlMatch = responseText.match(/<json>\s*([\s\S]*?)\s*<\/json>/);
        if (xmlMatch) {
            try {
                generatedObject = JSON.parse(xmlMatch[1]);
            } catch (e) {
                extractionError = `Failed to parse JSON from XML tags: ${e}`;
            }
        }

        // Strategy 2: Extract from code blocks
        if (!generatedObject) {
            const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                try {
                    generatedObject = JSON.parse(codeBlockMatch[1]);
                } catch (e) {
                    extractionError = `Failed to parse JSON from code block: ${e}`;
                }
            }
        }

        // Strategy 3: Extract largest valid JSON object
        if (!generatedObject) {
            // Find all potential JSON objects
            const jsonMatches = responseText.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
            let largestJson: any = null;
            let largestSize = 0;
            
            for (const match of jsonMatches) {
                try {
                    const parsed = JSON.parse(match[0]);
                    const size = JSON.stringify(parsed).length;
                    if (size > largestSize) {
                        largestJson = parsed;
                        largestSize = size;
                    }
                } catch (e) {
                    // Continue trying other matches
                }
            }
            
            if (largestJson) {
                generatedObject = largestJson;
            } else {
                extractionError = extractionError || "No valid JSON object found in response";
            }
        }

        if (!generatedObject) {
            throw new Error(`JSON extraction failed: ${extractionError}\nResponse: ${responseText.slice(0, 500)}...`);
        }

        // Validate against schema if provided
        if (schema) {
            try {
                // Basic validation - check required fields
                if (schema.properties) {
                    const required = schema.required || [];
                    for (const field of required) {
                        if (!(field in generatedObject)) {
                            throw new Error(`Missing required field: ${field}`);
                        }
                    }
                }
            } catch (validationError) {
                throw new Error(`Schema validation failed: ${validationError}`);
            }
        }

        // Add response to messages history
        const updatedMessages = [...messages, {
            role: "assistant",
            content: responseText
        } as ChatCompletionMessageParam];

        return {
            response: generatedObject,
            messages: updatedMessages
        };
    }

    private convertToAnthropicFormat(messages: ChatCompletionMessageParam[]): {
        system: string;
        anthropicMessages: Anthropic.MessageParam[];
    } {
        let system = "";
        const anthropicMessages: Anthropic.MessageParam[] = [];

        for (const message of messages) {
            if (message.role === 'system') {
                system += (system ? '\n\n' : '') + message.content;
            } else if (message.role === 'user' || message.role === 'assistant') {
                anthropicMessages.push({
                    role: message.role,
                    content: String(message.content)
                });
            }
        }

        return { system, anthropicMessages };
    }
} 