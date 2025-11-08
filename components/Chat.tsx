

import React, { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent } from 'react';
import type { User, Conversation, Message } from '../types';
import { dataService } from '../services/dataService';
import { generateResponse, ingestFile } from '../services/geminiService';
import { 
    AppLogo, UserIcon, SendIcon, MessageSquareIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon,
    FileIcon, WorldIcon, TrashIcon, CheckCircleIcon, AlertTriangleIcon, XIcon, SpinnerIcon
} from './Icons';
import { ProfileModal } from './ProfileModal';
import { ConfirmationModal } from './ConfirmationModal';

type ConversationWithState = Conversation & { messagesLoaded?: boolean };

// Helper to sanitize raw AI text response.
const sanitizeAIResponse = (text: string): string => {
    let cleanedText = (text || '').trim();

    // The backend sometimes returns a string that is itself a JSON-encoded string,
    // complete with outer quotes and escaped characters (e.g., "\"Hello \\n world\"").
    // The most reliable way to clean this is to parse it as JSON.
    try {
        const parsed = JSON.parse(cleanedText);
        // If it parses into a string, we've successfully unescaped and un-quoted it.
        if (typeof parsed === 'string') {
            cleanedText = parsed.trim();
        }
        // If it parses into something else (like an object), we assume the original
        // string was not meant to be a simple text response, so we leave it as is for now.
    } catch (e) {
        // If JSON.parse fails, it's not a valid JSON literal.
        // It might be a simple string with quotes that we can manually remove as a fallback.
        if (cleanedText.startsWith('"') && cleanedText.endsWith('"')) {
            cleanedText = cleanedText.substring(1, cleanedText.length - 1);
        }
    }

    // Finally, remove any leading punctuation that's unlikely to be intentional,
    // which can result from truncated or oddly formed model outputs.
    cleanedText = cleanedText.replace(/^[\s,;.:]+/, '');
    
    return cleanedText;
};


// Helper function to render formatted text from AI, handling markdown-like syntax.
const renderFormattedText = (text: string) => {
    // Unescape newlines (e.g., "\\n" -> "\n") and then split into individual lines
    const lines = text.replace(/\\n/g, '\n').split('\n');
  
    return lines.map((line, index) => {
      // Handle list items that start with '* '
      let processedLine = line;
      if (processedLine.trim().startsWith('* ')) {
        // Replace with a bullet point for better visual representation of a list
        processedLine = '• ' + processedLine.trim().substring(2);
      }
  
      // Handle bold text which is enclosed in double asterisks, e.g., **text**
      const parts = processedLine.split('**');
      const elements = parts.map((part, i) => {
        // Parts at odd indices are inside the asterisks, so they should be bold
        if (i % 2 === 1) {
          return <strong key={i}>{part}</strong>;
        }
        // Even-indexed parts are regular text
        return <React.Fragment key={i}>{part}</React.Fragment>;
      });
  
      // Return the formatted line, adding a line break if it's not the last line
      return (
        <React.Fragment key={index}>
          {elements}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
};

// ToggleSwitch Component
const ToggleSwitch: React.FC<{ isEnabled: boolean; onToggle: () => void; disabled?: boolean; }> = ({ isEnabled, onToggle, disabled }) => (
    <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 focus:outline-none ${isEnabled ? 'bg-blue-600' : 'bg-zinc-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <span
            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
    </button>
);

// Main ChatView Component
// FIX: Updated the onUserUpdate prop type to expect a Promise, aligning with its async nature.
export const ChatView: React.FC<{ user: User; onUserUpdate: () => Promise<void>; }> = ({ user, onUserUpdate }) => {
    const [conversations, setConversations] = useState<ConversationWithState[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
    const [systemMessage, setSystemMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);
    const [webSearch, setWebSearch] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeConversation = useMemo(() => 
        conversations.find(c => c.id === activeConversationId),
        [conversations, activeConversationId]
    );

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeConversation?.messages, systemMessage, loadingConversationId]);
    
    const handleNewChat = useCallback(async () => {
        try {
            const newConversation = await dataService.createConversation({ user_id: user.id, title: 'New Chat' });
            if (newConversation) {
                const newConvWithState: ConversationWithState = { ...newConversation, messagesLoaded: true }; // New chats have no messages, so mark as loaded.
                setConversations(prev => [newConvWithState, ...prev]);
                setActiveConversationId(newConvWithState.id);
                setSystemMessage(null);
                setWebSearch(false);
                setQuery('');
                setSelectedFile(null);
            } else {
                 setSystemMessage({ text: 'Error: Could not create a new chat.', type: 'error' });
                 setTimeout(() => setSystemMessage(null), 5000);
            }
        } catch(error) {
            console.error("Failed to create new chat:", error);
            setSystemMessage({ text: 'Error: Could not create a new chat.', type: 'error' });
            setTimeout(() => setSystemMessage(null), 5000);
        }
    }, [user.id]);

    // Initial load of conversations (fast, no messages)
    useEffect(() => {
        const loadConversations = async () => {
            const userConversations = await dataService.getConversations(user.id);
            setConversations(userConversations.map(c => ({ ...c, messagesLoaded: false })));
            if (userConversations.length === 0) {
                handleNewChat();
            } else {
                setActiveConversationId(userConversations[0].id);
            }
        };
        loadConversations();
    }, [user.id, handleNewChat]);

    // Load messages for active conversation (on demand)
    useEffect(() => {
        if (!activeConversationId) return;
        const activeConv = conversations.find(c => c.id === activeConversationId);
        
        if (activeConv && !activeConv.messagesLoaded) {
            const loadMessages = async () => {
                const messages = await dataService.getMessages(activeConversationId);
                setConversations(prev =>
                    prev.map(c => c.id === activeConversationId ? { ...c, messages, messagesLoaded: true } : c)
                );
            };
            loadMessages();
        }
    }, [activeConversationId, conversations]);

    // Manages active conversation, ensuring one is always selected or created.
     useEffect(() => {
        if (!activeConversationId && conversations.length > 0) {
            setActiveConversationId(conversations[0].id);
        }
    }, [conversations, activeConversationId]);
    

    useEffect(() => {
        if(activeConversation) {
            // BUGFIX: Removed automatic clearing of system messages on conversation switch,
            // as it was preventing messages like "Conversation deleted" from being seen.
            // Timeouts are now used on all system messages for consistent behavior.
            setWebSearch(activeConversation.is_web_search_enabled || false);
        }
    }, [activeConversation]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setSelectedFile(file || null);
        event.target.value = '';
    };

    const handleIngestFile = async () => {
        if (!selectedFile || !activeConversationId) return;
    
        setLoadingConversationId(activeConversationId);
        setSystemMessage(null);
        const fileName = selectedFile.name;
    
        try {
            // Await the ingestion API call. If it fails, the catch block will handle it.
            await ingestFile(fileName, user.id);
            
            // Immediately update the conversation in the database to be a document-based conversation.
            await dataService.updateConversation(activeConversationId, {
                file_name: fileName,
                is_web_search_enabled: false
            });
            
            const displayMessageText = "File ingested";
    
            const aiMessageToSave = {
                conversation_id: activeConversationId,
                sender: 'ai' as const,
                text: displayMessageText,
            };
            const savedAiMessage = await dataService.addMessage(aiMessageToSave);
            if (!savedAiMessage) {
                throw new Error("Failed to save the ingestion response message.");
            }
    
            // Update the local state to reflect all changes in the UI.
            setConversations(prev => prev.map(c => {
                if (c.id === activeConversationId) {
                    const isNewChat = c.title === 'New Chat';
                    const newTitle = isNewChat ? fileName : c.title;
                    if (isNewChat) {
                        dataService.updateConversation(activeConversationId, { title: newTitle });
                    }
    
                    const updatedConv = {
                        ...c,
                        file_name: fileName,
                        is_web_search_enabled: false,
                        title: newTitle,
                        messages: [...(c.messages || []), savedAiMessage],
                    };
    
                    return updatedConv;
                }
                return c;
            }));
    
            setWebSearch(false);
            setSelectedFile(null);
    
        } catch (error) {
            const errorMessageText = error instanceof Error ? error.message : "Sorry, I encountered an error during ingestion.";
            setSystemMessage({ text: errorMessageText, type: 'error' });
            setTimeout(() => setSystemMessage(null), 5000);
        } finally {
            setLoadingConversationId(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!conversationToDelete) return;
        const conversationId = conversationToDelete.id;
        const conversationTitle = conversationToDelete.title;

        try {
            await dataService.deleteConversation(conversationId);
            setSystemMessage({ text: `Conversation "${conversationTitle}" was deleted.`, type: 'success' });
            setTimeout(() => setSystemMessage(null), 5000);

            const remainingConversations = conversations.filter(c => c.id !== conversationId);
            setConversations(remainingConversations);
            
            if (activeConversationId === conversationId) {
                 if (remainingConversations.length > 0) {
                    setActiveConversationId(remainingConversations[0].id);
                 } else {
                    handleNewChat();
                 }
            }
        } catch (error) {
            console.error("Failed to delete conversation:", error);
            setSystemMessage({ text: `Error deleting "${conversationTitle}".`, type: 'error' });
            setTimeout(() => setSystemMessage(null), 5000);
        } finally {
            setConversationToDelete(null);
        }
    };

    const handleWebSearchToggle = useCallback(async () => {
        if (!activeConversationId) return;
    
        const newWebSearchState = !webSearch;
        setWebSearch(newWebSearchState); // Optimistic UI update
    
        try {
            await dataService.updateConversation(activeConversationId, { is_web_search_enabled: newWebSearchState });
            setConversations(prev => 
                prev.map(c => 
                    c.id === activeConversationId ? { ...c, is_web_search_enabled: newWebSearchState } : c
                )
            );
        } catch (error) {
            console.error("Failed to update web search preference:", error);
            // Revert on failure and show error
            setWebSearch(!newWebSearchState);
            setSystemMessage({ text: 'Error: Could not save web search preference.', type: 'error' });
            setTimeout(() => setSystemMessage(null), 5000);
        }
    }, [activeConversationId, webSearch]);


    const handleSendMessage = async () => {
        if (!query.trim() || !activeConversationId) return;
    
        const activeConvBeforeUpdate = conversations.find(c => c.id === activeConversationId);
        if (!activeConvBeforeUpdate) return;
    
        setLoadingConversationId(activeConversationId);
        const userQuery = query;
        setQuery('');
        setSystemMessage(null);
    
        const userMessageToSave = {
            conversation_id: activeConversationId,
            sender: 'user' as const,
            text: userQuery,
        };
        const savedUserMessage = await dataService.addMessage(userMessageToSave);
    
        if (!savedUserMessage) {
            setSystemMessage({ text: 'Error: Could not send your message. Please try again.', type: 'error' });
            setTimeout(() => setSystemMessage(null), 5000);
            setQuery(userQuery);
            setLoadingConversationId(null);
            return;
        }
    
        const historyForBackend = [...(activeConvBeforeUpdate.messages || []), savedUserMessage];
    
        setConversations(prev => {
            return prev.map(conv => {
                if (conv.id === activeConversationId) {
                    const isNewChat = (conv.messages || []).length === 0 && conv.title === 'New Chat';
                    const newTitle = isNewChat
                        ? userQuery.substring(0, 30) + (userQuery.length > 30 ? '...' : '')
                        : conv.title;
                    
                    if (isNewChat) {
                        dataService.updateConversation(activeConversationId, { title: newTitle });
                    }
    
                    const updatedMessages = [...(conv.messages || []), savedUserMessage];
                    return { ...conv, title: newTitle, messages: updatedMessages };
                }
                return conv;
            });
        });
    
        try {
            const isDocumentQuery = !!activeConvBeforeUpdate.file_name;
            const useWebSearchForRequest = isDocumentQuery ? false : webSearch;
            
            const promptForBackend = isDocumentQuery
                ? `${userQuery} as (${user.id})`
                : userQuery;

            const responseText = await generateResponse(
                promptForBackend, 
                isDocumentQuery, 
                useWebSearchForRequest, 
                historyForBackend, 
                user.id
            );
            
            let aiMessageText = '';
            let sources: { uri: string; title: string }[] | undefined = undefined;
            
            const isEmailSendRequest = /^\s*send\s(an?\s)?(e-?mail|mail|message)/i.test(userQuery);
            const responseStr = String(responseText || '').trim().toLowerCase();

            if (isEmailSendRequest) {
                // Assume success unless the response explicitly contains an error keyword.
                if (responseStr.includes('error') || responseStr.includes('fail')) {
                    aiMessageText = responseText;
                } else {
                    aiMessageText = '✅ Email sent successfully.';
                }
            } else if (isDocumentQuery) {
                aiMessageText = responseText;
            } else {
                if (responseText && responseText.trim()) {
                    try {
                        const data = JSON.parse(responseText);
                        if (typeof data === 'object' && data !== null && 'text' in data && typeof data.text === 'string') {
                            aiMessageText = data.text;
                            sources = data.sources || [];
                        } else {
                            aiMessageText = responseText;
                        }
                    } catch (e) {
                        aiMessageText = responseText;
                    }
                }
            }
        
            const sanitizedAiMessageText = sanitizeAIResponse(aiMessageText);

            if(sanitizedAiMessageText.trim()) {
                const aiMessageToSave = {
                    conversation_id: activeConversationId,
                    sender: 'ai' as const,
                    text: sanitizedAiMessageText,
                    sources: sources,
                };
        
                const savedAiMessage = await dataService.addMessage(aiMessageToSave);
        
                if (!savedAiMessage) {
                    throw new Error("Failed to save the AI's response.");
                }
        
                setConversations(prev => prev.map(c =>
                    c.id === activeConversationId ? { ...c, messages: [...(c.messages || []), savedAiMessage] } : c
                ));
            }
        
        } catch (error) {
            console.error("Error getting AI response:", error);
            const errorMessageText = error instanceof Error ? error.message : "Sorry, I encountered an error.";
            
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                conversation_id: activeConversationId,
                created_at: new Date().toISOString(),
                sender: 'ai',
                text: errorMessageText,
            };
        
            setConversations(prev => prev.map(c =>
                c.id === activeConversationId ? { ...c, messages: [...(c.messages || []), errorMessage] } : c
            ));
        } finally {
            setLoadingConversationId(null);
        }
    };
    
    const isDocumentConversation = !!activeConversation?.file_name;

    return (
        <div className="flex h-screen w-screen text-zinc-200 bg-zinc-900 font-sans">
             <div className={`bg-zinc-950/70 backdrop-blur-sm border-r border-zinc-800 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 hidden md:flex md:w-[60px]'}`}>
                {/* Sidebar */}
                <div className="p-4 flex-shrink-0 flex items-center justify-between border-b border-zinc-800">
                     <span className={`font-bold text-lg whitespace-nowrap ${!sidebarOpen && 'hidden'}`}>Conversations</span>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded-md hover:bg-zinc-700">
                        {sidebarOpen ? <ChevronLeftIcon className="w-5 h-5"/> : <ChevronRightIcon className="w-5 h-5"/>}
                    </button>
                </div>
                <div className="p-2 flex-shrink-0">
                    <button onClick={handleNewChat} className="w-full flex items-center justify-center md:justify-start gap-2 p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors">
                        <PlusIcon className="w-5 h-5"/>
                        <span className={`whitespace-nowrap ${!sidebarOpen && 'hidden'}`}>New Chat</span>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-1">
                    {conversations.map(conv => (
                        <div 
                           key={conv.id} 
                           onClick={() => setActiveConversationId(conv.id)} 
                           onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') setActiveConversationId(conv.id); }}
                           role="button"
                           tabIndex={0}
                           className={`group relative w-full text-left p-2 rounded-md flex items-center gap-2 truncate cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${activeConversationId === conv.id ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
                        >
                           <MessageSquareIcon className="w-5 h-5 flex-shrink-0"/>
                           <div className={`flex flex-col truncate ${!sidebarOpen && 'hidden'}`}>
                               <span className="font-medium text-sm truncate">{conv.title}</span>
                               <span className="text-xs text-zinc-400">{new Date(conv.created_at).toLocaleDateString()}</span>
                           </div>
                           <button onClick={(e) => { e.stopPropagation(); setConversationToDelete(conv); }} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-500 hover:bg-red-900/50 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity ${!sidebarOpen && 'hidden'}`}>
                                <TrashIcon className="w-4 h-4"/>
                           </button>
                        </div>
                    ))}
                </div>
            </div>

            <main className="flex-1 flex flex-col bg-zinc-900">
                {/* Header */}
                 <header className="flex-shrink-0 h-16 flex items-center justify-between px-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <AppLogo className="w-8 h-8 text-zinc-400"/>
                        <div>
                            <h1 className="text-lg font-semibold text-zinc-100">Advanced Search</h1>
                            <p className="text-sm text-zinc-400">Knowledge Base + Web Search</p>
                        </div>
                    </div>
                    <button onClick={() => setProfileModalOpen(true)} className="flex items-center gap-2 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                        <UserIcon className="w-5 h-5 text-zinc-300" />
                        <span className="font-medium text-sm hidden sm:block">{user.name}</span>
                    </button>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {activeConversation && activeConversation.messages && activeConversation.messages.length > 0 ? (
                        activeConversation.messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                                {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0"><AppLogo className="w-5 h-5"/></div>}
                                <div className={`max-w-xl p-4 rounded-xl ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-200 rounded-bl-none'}`}>
                                    {msg.sender === 'ai' ? (
                                        <div>{renderFormattedText(msg.text)}</div>
                                    ) : (
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                    )}
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-zinc-700">
                                            <h4 className="text-xs font-semibold text-zinc-400 mb-2">Sources:</h4>
                                            <div className="flex flex-col space-y-2">
                                                {msg.sources.map((source, i) => (
                                                    <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate">
                                                        {source.title || source.uri}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                         <div className="text-center mt-20">
                            <AppLogo className="w-16 h-16 mx-auto text-zinc-600"/>
                            <h2 className="mt-4 text-2xl font-bold text-zinc-300">Start Your Search</h2>
                            <p className="mt-2 text-zinc-400">Select a file to start a document query, or just ask a question.</p>
                        </div>
                    )}
                    {loadingConversationId === activeConversation?.id && <div className="flex justify-start"><div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0"><AppLogo className="w-5 h-5"/></div><div className="ml-4 p-4 rounded-xl bg-zinc-800 text-zinc-400">Searching...</div></div>}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 flex-shrink-0 bg-zinc-900 border-t border-zinc-800">
                    <div className="max-w-4xl mx-auto">
                        {systemMessage && (
                            <div className="flex justify-center mb-2">
                                <div className={`flex items-center gap-2 text-sm p-2 px-3 rounded-full border shadow-lg ${systemMessage.type === 'success' ? 'border-green-700/50 bg-green-900/30 text-green-300' : 'border-red-700/50 bg-red-900/30 text-red-300'}`}>
                                    {systemMessage.type === 'success' ? <CheckCircleIcon className="w-4 h-4"/> : <AlertTriangleIcon className="w-4 h-4"/>}
                                    <span>{systemMessage.text}</span>
                                </div>
                            </div>
                        )}
                        
                        {activeConversation && !activeConversation.file_name && (
                            <div className="mb-2 p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                                <p className="text-sm text-zinc-400 mb-2 font-medium">To query a document, select a file and click Ingest.</p>
                                <div className="flex items-center gap-2">
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" aria-label="File selection" />
                                    <div className="flex-grow p-2 bg-zinc-800 rounded-md flex items-center justify-between border border-zinc-700">
                                        <span className="text-zinc-300 truncate" aria-live="polite">{selectedFile ? selectedFile.name : 'No file selected...'}</span>
                                        {selectedFile ? (
                                            <button onClick={() => setSelectedFile(null)} className="ml-2 text-zinc-400 hover:text-zinc-200" aria-label="Clear selected file"><XIcon className="w-4 h-4" /></button>
                                        ) : (
                                            <button onClick={() => fileInputRef.current?.click()} className="ml-2 text-sm font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap">Browse</button>
                                        )}
                                    </div>
                                    <button onClick={handleIngestFile} disabled={!!loadingConversationId || !selectedFile} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed transition-colors font-semibold text-sm">Ingest</button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end mb-2">
                             <div className={`flex items-center gap-2 text-sm transition-colors ${isDocumentConversation ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                <WorldIcon className="w-5 h-5"/>
                                <span>Web Search</span>
                                <ToggleSwitch 
                                    isEnabled={webSearch && !isDocumentConversation} 
                                    onToggle={handleWebSearchToggle}
                                    disabled={isDocumentConversation}
                                />
                            </div>
                        </div>

                        {activeConversation?.file_name && (
                            <div className="mb-2 flex items-center justify-between bg-zinc-800 p-2 rounded-md">
                                <div className="flex items-center gap-2 text-sm">
                                    <FileIcon className="w-5 h-5 text-zinc-400"/>
                                    <span className="text-zinc-300">Querying: {activeConversation.file_name}</span>
                                </div>
                            </div>
                        )}

                        <div className="relative mt-1">
                            <textarea
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                                placeholder="Ask a question..."
                                rows={1}
                                className="w-full bg-zinc-800 text-zinc-200 rounded-lg p-4 pr-12 resize-none outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Chat input"
                                disabled={!!loadingConversationId}
                            />
                            <button onClick={handleSendMessage} disabled={!!loadingConversationId || !query.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-700 hover:bg-blue-600 disabled:bg-zinc-600 disabled:cursor-not-allowed transition-colors" aria-label="Send message">
                                {loadingConversationId === activeConversation?.id ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
            {profileModalOpen && <ProfileModal user={user} onClose={() => setProfileModalOpen(false)} onUserUpdate={onUserUpdate} />}
            {conversationToDelete && (
                <ConfirmationModal
                    isOpen={!!conversationToDelete}
                    onClose={() => setConversationToDelete(null)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Conversation"
                    message={`Are you sure you want to permanently delete "${conversationToDelete.title}"? This action cannot be undone.`}
                />
            )}
        </div>
    );
};