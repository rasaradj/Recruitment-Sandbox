import React, { useState } from 'react';
import { CheckCircle2, Circle, Save, ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { translations } from '@/src/lib/translations';

interface Question {
  id: string;
  text: string;
  completed: boolean;
  notes: string;
}

export function EvaluatorMode({ 
  content, 
  uiLanguage, 
  onBack,
  onSaveNotes
}: { 
  content: string; 
  uiLanguage: string; 
  onBack: () => void;
  onSaveNotes: (notes: string) => void;
}) {
  const t = translations[uiLanguage] || translations.English;
  
  // Parse markdown content into questions (simple heuristic: lines starting with numbers or bullets)
  const initialQuestions = content.split('\n')
    .filter(line => line.trim().match(/^(\d+\.|-|\*)\s/))
    .map((line, index) => ({
      id: `q-${index}`,
      text: line.replace(/^(\d+\.|-|\*)\s/, '').trim(),
      completed: false,
      notes: ''
    }));

  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [overallNotes, setOverallNotes] = useState('');

  const toggleQuestion = (id: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, completed: !q.completed } : q
    ));
  };

  const updateQuestionNotes = (id: string, notes: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, notes } : q
    ));
  };

  const handleFinalSave = () => {
    const summary = questions.map(q => 
      `${q.completed ? '[✓]' : '[ ]'} ${q.text}\nNotes: ${q.notes || 'N/A'}`
    ).join('\n\n') + `\n\nOVERALL NOTES:\n${overallNotes}`;
    onSaveNotes(summary);
  };

  return (
    <div className="flex flex-col h-full bg-editorial-bg">
      <header className="p-6 border-b border-editorial-ink flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="rounded-none">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.backToSandbox}
          </Button>
          <h2 className="text-2xl font-black uppercase tracking-tighter serif">{t.evaluatorMode}</h2>
        </div>
        <Button onClick={handleFinalSave} className="bg-editorial-ink text-white rounded-none uppercase text-[10px] font-bold tracking-widest px-6">
          <Save className="w-3 h-3 mr-2" />
          {t.save}
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1 p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {questions.map((q) => (
              <div key={q.id} className={`p-6 border-2 transition-all ${q.completed ? 'border-editorial-ink bg-zinc-50' : 'border-editorial-ink/10 bg-white'}`}>
                <div className="flex items-start gap-4">
                  <button onClick={() => toggleQuestion(q.id)} className="mt-1">
                    {q.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-editorial-ink" />
                    ) : (
                      <Circle className="w-6 h-6 text-editorial-ink/20" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className={`text-lg serif italic mb-4 ${q.completed ? 'line-through opacity-40' : ''}`}>
                      {q.text}
                    </p>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 w-4 h-4 opacity-20" />
                      <Textarea 
                        placeholder="Candidate response notes..."
                        value={q.notes}
                        onChange={(e) => updateQuestionNotes(q.id, e.target.value)}
                        className="pl-10 min-h-[80px] rounded-none border-editorial-ink/10 focus:border-editorial-ink transition-colors text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-8 border-t-2 border-editorial-ink/10">
              <h3 className="text-sm uppercase font-bold tracking-widest mb-4">{t.contact} (Overall Notes)</h3>
              <Textarea 
                placeholder="Final thoughts on candidate..."
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                className="min-h-[150px] rounded-none border-editorial-ink focus:border-editorial-ink text-sm"
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
