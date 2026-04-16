import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { chatWithGemini, ChatMessage } from '@/src/lib/gemini';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'motion/react';

import { translations } from '@/src/lib/translations';

export function ChatInterface({ uiLanguage = 'English' }: { uiLanguage?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = translations[uiLanguage] || translations.English;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithGemini(newMessages);
      setMessages([...newMessages, { role: 'model', text: response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, { role: 'model', text: t.chatError }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-editorial-bg">
      <div className="p-6 border-b border-editorial-ink bg-editorial-bg">
        <h3 className="font-black text-lg uppercase tracking-tighter serif flex items-center gap-2">
          {t.assistantTitle}
        </h3>
        <p className="text-[10px] uppercase font-bold opacity-50 tracking-widest">{t.assistantSub}</p>
      </div>

      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 opacity-20">
              <Bot className="w-8 h-8 mx-auto mb-4" />
              <p className="text-xs uppercase tracking-[2px] font-bold">{t.awaitingConsultation}</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[9px] uppercase font-bold opacity-30 mb-1 tracking-widest">
                  {msg.role === 'user' ? t.user : t.gemini}
                </span>
                <div
                  className={`max-w-[90%] p-4 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-editorial-ink text-white rounded-none'
                      : 'bg-white border border-editorial-ink text-editorial-ink rounded-none shadow-[4px_4px_0px_0px_rgba(26,26,26,0.1)]'
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <div className="flex flex-col items-start">
              <span className="text-[9px] uppercase font-bold opacity-30 mb-1 tracking-widest">{t.gemini}</span>
              <div className="bg-white border border-editorial-ink p-4 rounded-none shadow-[4px_4px_0px_0px_rgba(26,26,26,0.1)]">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-6 bg-editorial-bg border-t border-editorial-ink">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex flex-col gap-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chatPlaceholder}
            className="bg-white border-editorial-ink rounded-none focus-visible:ring-editorial-accent h-12 text-sm"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-editorial-ink hover:bg-zinc-800 text-white rounded-none uppercase text-[10px] font-bold tracking-widest py-6">
            {t.chatSend}
          </Button>
        </form>
      </div>
    </div>
  );
}
