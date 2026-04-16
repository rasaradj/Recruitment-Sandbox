import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Trash2, 
  ArrowLeft, 
  Clock, 
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  deleteDoc, 
  doc,
  OperationType,
  handleFirestoreError
} from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/src/lib/translations';
import { GenerationResult } from '@/src/lib/gemini';

interface SavedItem {
  id: string;
  title: string;
  results: GenerationResult;
  createdAt: any;
  selectedLanguages: string[];
}

export function Library({ 
  uiLanguage, 
  onBack,
  onLoadItem 
}: { 
  uiLanguage: string; 
  onBack: () => void;
  onLoadItem: (item: GenerationResult) => void;
}) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = translations[uiLanguage] || translations.English;

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'saved_outputs'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const savedItems: SavedItem[] = [];
      snapshot.forEach((doc) => {
        savedItems.push({ id: doc.id, ...doc.data() } as SavedItem);
      });
      setItems(savedItems);
      setIsLoading(false);
    }, (err) => {
      console.error('Library fetch error:', err);
      setError('Failed to load library items.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'saved_outputs', id));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `saved_outputs/${id}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-editorial-bg">
      <header className="p-6 border-b border-editorial-ink flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="rounded-none">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.backToSandbox}
          </Button>
          <h2 className="text-2xl font-black uppercase tracking-tighter serif">{t.library}</h2>
        </div>
      </header>

      <ScrollArea className="flex-1 p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin opacity-20" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-20 text-center">
            <FileText className="w-12 h-12 mb-4" />
            <p className="text-xs uppercase tracking-widest font-bold">{t.noSavedItems}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="rounded-none border-2 border-editorial-ink bg-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] transition-all group relative">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="serif italic text-lg line-clamp-1">{item.title}</CardTitle>
                    {deletingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDelete(item.id)}
                          className="h-7 px-2 text-[8px] uppercase font-bold rounded-none"
                        >
                          {t.delete}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setDeletingId(null)}
                          className="h-7 px-2 text-[8px] uppercase font-bold rounded-none"
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setDeletingId(item.id)}
                        className="h-8 w-8 text-zinc-400 hover:text-editorial-accent opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] uppercase font-bold opacity-40 tracking-widest">
                    <Clock className="w-3 h-3" />
                    {item.createdAt?.toDate().toLocaleDateString()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {item.selectedLanguages.map(lang => (
                      <span key={lang} className="text-[8px] px-1.5 py-0.5 border border-editorial-ink/20 uppercase font-bold">
                        {lang}
                      </span>
                    ))}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest h-9"
                    onClick={() => {
                      onLoadItem(item.results);
                      onBack();
                    }}
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    {t.viewSaved}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {error && (
        <div className="p-4 bg-editorial-accent text-white text-xs uppercase font-bold tracking-widest flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
