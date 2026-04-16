import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  Download, 
  ArrowLeft, 
  Search,
  Tag,
  User as UserIcon,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  db, 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  OperationType,
  handleFirestoreError
} from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { translations } from '@/src/lib/translations';

interface Template {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  description: string;
  rawNotes: string;
  category: string;
  installCount: number;
  createdAt: any;
}

export function TemplateGallery({ 
  uiLanguage, 
  onBack,
  onInstall 
}: { 
  uiLanguage: string; 
  onBack: () => void;
  onInstall: (rawNotes: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const t = translations[uiLanguage] || translations.English;

  useEffect(() => {
    const q = query(
      collection(db, 'templates'),
      orderBy('installCount', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Template[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Template);
      });
      setTemplates(items);
      setIsLoading(false);
    }, (err) => {
      console.error('Template fetch error:', err);
      setError('Failed to load templates.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTemplates = templates.filter(temp => 
    (temp.title?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (temp.category?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (temp.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  );

  return (
    <div className="flex flex-col h-full bg-editorial-bg">
      <header className="p-6 border-b border-editorial-ink flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="rounded-none">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.backToSandbox}
          </Button>
          <h2 className="text-2xl font-black uppercase tracking-tighter serif">{t.templateGallery}</h2>
        </div>
        <div className="relative w-64 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
          <Input 
            placeholder="Search templates..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-none border-editorial-ink text-xs"
          />
        </div>
      </header>

      <ScrollArea className="flex-1 p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin opacity-20" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-20 text-center">
            <LayoutGrid className="w-12 h-12 mb-4" />
            <p className="text-xs uppercase tracking-widest font-bold">No templates found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((temp) => (
              <Card key={temp.id} className="rounded-none border-2 border-editorial-ink bg-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] transition-all group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] px-1.5 py-0.5 bg-editorial-ink text-white uppercase font-bold tracking-widest">
                      {temp.category || 'General'}
                    </span>
                    <div className="flex items-center gap-1 text-[9px] font-bold opacity-40">
                      <Download className="w-3 h-3" />
                      {temp.installCount || 0}
                    </div>
                  </div>
                  <CardTitle className="serif italic text-xl">{temp.title}</CardTitle>
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-2">{temp.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-[9px] uppercase font-bold opacity-40 tracking-widest mb-4">
                    <UserIcon className="w-3 h-3" />
                    {temp.authorName || 'Anonymous'}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest h-9"
                    onClick={() => onInstall(temp.rawNotes)}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    {t.install}
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
