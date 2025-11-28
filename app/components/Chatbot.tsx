
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface Message {
    role: 'user' | 'assistant';
    content: string;
}

type LLMProvider = 'openai' | 'gemini' | 'openrouter' | 'custom';

interface ChatbotProps {
    onClose?: () => void;
    journeyContext?: {
        startMode?: 'flight' | 'address';
        flightNumber?: string;
        startAddress?: string;
        departureTime?: Date;
        stops?: string[];
        destination?: string;
        arrivalTime?: Date;
        provider?: string;
        routeOptimization?: {
            totalDistance?: number;
            totalDuration?: number;
            stopCount?: number;
            recommendedOrder?: string[];
        };
    };
}

export function Chatbot({ onClose, journeyContext }: ChatbotProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Load settings from localStorage or use defaults
    const [provider, setProvider] = useState<LLMProvider>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('llm_provider') as LLMProvider) || 'openai';
        }
        return 'openai';
    });
    const [model, setModel] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('llm_model') || 'gpt-4o-mini';
        }
        return 'gpt-4o-mini';
    });
    const [apiKey, setApiKey] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('llm_api_key') || '';
        }
        return '';
    });
    const [baseUrl, setBaseUrl] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('llm_base_url') || '';
        }
        return '';
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Save settings to localStorage when they change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('llm_provider', provider);
        }
    }, [provider]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('llm_model', model);
        }
    }, [model]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('llm_api_key', apiKey);
        }
    }, [apiKey]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('llm_base_url', baseUrl);
        }
    }, [baseUrl]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    provider,
                    model,
                    apiKey: apiKey || undefined,
                    baseUrl: provider === 'custom' ? (baseUrl || undefined) : undefined,
                    journeyContext: journeyContext || {},
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.content) {
                                    assistantMessage += parsed.content;
                                    setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
                                } else if (parsed.error) {
                                    throw new Error(parsed.error);
                                }
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages([
                ...newMessages,
                { role: 'assistant', content: `Error: ${error.message || 'Failed to get response'}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl shadow-purple-500/20 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            {/* Header */}
            <div className="relative flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
                <div className="absolute top-0 left-0 right-0 h-0.5 gradient-accent"></div>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full gradient-accent flex items-center justify-center shadow-lg animate-pulse">
                        <Bot className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-bold text-lg bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">AI Assistant</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-all duration-200 hover:scale-110"
                    >
                        <Settings className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-all duration-200 hover:scale-110">
                            <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-900/10 dark:to-blue-900/10 backdrop-blur-sm space-y-4 animate-fade-in-up">
                    <div>
                        <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
                            Provider
                        </label>
                        <select
                            value={provider}
                            onChange={(e) => setProvider(e.target.value as any)}
                            className="w-full px-3 py-2 text-sm border-2 border-purple-200 dark:border-purple-700 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        >
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="custom">Custom Endpoint</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">Model</label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full px-3 py-2 text-sm border-2 border-purple-200 dark:border-purple-700 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                            placeholder={
                                provider === 'openrouter'
                                    ? 'e.g., openai/gpt-4'
                                    : provider === 'gemini'
                                        ? 'e.g., gemini-pro'
                                        : 'e.g., gpt-3.5-turbo'
                            }
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
                            API Key (optional)
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full px-3 py-2 text-sm border-2 border-purple-200 dark:border-purple-700 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                            placeholder="Leave empty to use server key"
                        />
                    </div>
                    {provider === 'custom' && (
                        <div>
                            <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
                                Base URL
                            </label>
                            <input
                                type="text"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                className="w-full px-3 py-2 text-sm border-2 border-purple-200 dark:border-purple-700 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                                placeholder="e.g., http://localhost:11434/v1"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-transparent to-gray-50/30 dark:to-gray-900/30">
                {messages.length === 0 && (
                    <div className="text-center mt-12 animate-fade-in-up">
                        <div className="h-16 w-16 mx-auto mb-4 rounded-full gradient-accent flex items-center justify-center shadow-lg">
                            <Bot className="h-8 w-8 text-white" />
                        </div>
                        <p className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">Ask me anything about your journey!</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">I can help with routes, times, and optimization</p>
                    </div>
                )}
                {messages.map((message, index) => (
                    <div key={index} className={`flex gap-3 ${message.role === 'assistant' ? '' : 'flex-row-reverse'} animate-fade-in-up`}>
                        <div
                            className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-lg ${message.role === 'assistant' ? 'gradient-accent' : 'gradient-primary'
                                }`}
                        >
                            {message.role === 'assistant' ? (
                                <Bot className="h-4 w-4 text-white" />
                            ) : (
                                <User className="h-4 w-4 text-white" />
                            )}
                        </div>
                        <div
                            className={`flex-1 rounded-xl p-3.5 shadow-md ${message.role === 'assistant'
                                ? 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white border border-purple-100 dark:border-purple-800'
                                : 'gradient-primary text-white shadow-lg'
                                }`}
                        >
                            {message.role === 'assistant' ? (
                                <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {message.content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 animate-fade-in-up">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full gradient-accent flex items-center justify-center shadow-lg animate-pulse">
                            <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 rounded-xl p-3.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-purple-100 dark:border-purple-800 shadow-md">
                            <div className="flex gap-1.5">
                                <div className="h-2.5 w-2.5 gradient-accent rounded-full animate-bounce"></div>
                                <div className="h-2.5 w-2.5 gradient-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="h-2.5 w-2.5 gradient-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-purple-50/30 to-blue-50/30 dark:from-purple-900/10 dark:to-blue-900/10 backdrop-blur-sm">
                <div className="flex gap-3">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-3 border-2 border-purple-200 dark:border-purple-700 rounded-xl resize-none bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all"
                        rows={2}
                        disabled={isLoading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className={`px-5 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 ${input.trim() && !isLoading
                            ? 'gradient-accent text-white hover:shadow-xl hover:scale-105 active:scale-95'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
