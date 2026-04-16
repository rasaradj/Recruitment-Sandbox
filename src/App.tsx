/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  FileText, 
  Users, 
  Sparkles, 
  ClipboardCheck, 
  MessageSquare, 
  Download,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Edit3,
  Save,
  Wand2,
  User,
  Mail,
  ExternalLink,
  ChevronDown,
  Menu,
  Library as LibraryIcon,
  LogOut,
  LogIn,
  Bookmark
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { generateRecruitmentMaterials, GenerationResult, refineMaterial } from '@/src/lib/gemini';
import { ChatInterface } from '@/src/components/ChatInterface';
import { Library } from '@/src/components/Library';
import { 
  auth, 
  signInWithGoogle, 
  logout, 
  onAuthStateChanged, 
  db, 
  collection, 
  addDoc, 
  serverTimestamp,
  OperationType,
  handleFirestoreError,
  User as FirebaseUser
} from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '@/src/lib/translations';

export default function App() {
  const [rawNotes, setRawNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'jd' | 'guide' | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  const [uiLanguage, setUiLanguage] = useState('English');
  
  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState<string>('');
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [view, setView] = useState<'sandbox' | 'library'>('sandbox');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const t = translations[uiLanguage] || translations.English;

  const languages = Object.keys(translations);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (result && !isGenerating) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, result]);

  useEffect(() => {
    if (result && !activeLangTab) {
      setActiveLangTab(Object.keys(result)[0]);
    }
  }, [result]);

  const handleGenerate = async () => {
    if (!rawNotes.trim() || selectedLanguages.length === 0) return;
    setIsGenerating(true);
    setError(null);
    try {
      const data = await generateRecruitmentMaterials(rawNotes, selectedLanguages);
      setResult(data);
      setActiveLangTab(selectedLanguages[0]);
    } catch (err) {
      console.error(err);
      setError('Failed to generate materials. Please check your notes and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang) 
        : [...prev, lang]
    );
  };

  const copyToClipboard = (text: string, type: 'jd' | 'guide') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRefine = async (type: 'jd' | 'guide') => {
    if (!refineInput.trim() || !result || !activeLangTab) return;
    setIsRefining(true);
    try {
      const currentContent = type === 'jd' 
        ? result[activeLangTab].jobDescription 
        : result[activeLangTab].interviewGuide;
      
      const refined = await refineMaterial(currentContent, refineInput, type, activeLangTab);
      
      setResult({
        ...result,
        [activeLangTab]: {
          ...result[activeLangTab],
          [type === 'jd' ? 'jobDescription' : 'interviewGuide']: refined
        }
      });
      setRefineInput('');
    } catch (err) {
      console.error(err);
      setError('Refinement failed.');
    } finally {
      setIsRefining(false);
    }
  };

  const updateManualContent = (val: string, type: 'jd' | 'guide') => {
    if (!result || !activeLangTab) return;
    setResult({
      ...result,
      [activeLangTab]: {
        ...result[activeLangTab],
        [type === 'jd' ? 'jobDescription' : 'interviewGuide']: val
      }
    });
  };

  const handleSaveToLibrary = async () => {
    if (!user || !result) return;
    setIsSaving(true);
    try {
      const title = rawNotes.split('\n')[0].substring(0, 50) || 'Untitled Recruitment Material';
      await addDoc(collection(db, 'saved_outputs'), {
        userId: user.uid,
        title,
        rawNotes,
        selectedLanguages,
        results: result,
        createdAt: serverTimestamp()
      });
      setIsSaving(false);
      // Optional: show a temporary "Saved" state
    } catch (err) {
      console.error('Save error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'saved_outputs');
      setIsSaving(false);
    }
  };

  if (view === 'library') {
    return (
      <div className="h-screen overflow-hidden">
        <Library 
          uiLanguage={uiLanguage} 
          onBack={() => setView('sandbox')} 
          onLoadItem={(item) => setResult(item)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-editorial-bg flex flex-col font-sans selection:bg-editorial-ink selection:text-editorial-bg">
      {/* Header */}
      <header className="px-4 lg:px-10 py-4 lg:py-6 border-b border-editorial-ink bg-editorial-bg flex items-center justify-between sticky top-0 z-50">
        <div className="logo text-xl lg:text-3xl font-black uppercase tracking-tighter serif">
          {t.title}
        </div>
        <div className="flex items-center gap-2 lg:gap-4">
          <AnimatePresence>
            {showSuccess && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="hidden md:flex items-center gap-2 px-3 py-1 bg-editorial-ink text-white text-[9px] uppercase font-bold tracking-[2px]"
              >
                <Check className="w-3 h-3" />
                {t.generationComplete}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="hidden sm:flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setView('library')}
              className="text-[10px] uppercase font-bold tracking-widest h-8 border border-editorial-ink/20 rounded-none"
            >
              <LibraryIcon className="w-3 h-3 mr-2" />
              {t.library}
            </Button>
            
            <div className="h-4 w-[1px] bg-editorial-ink/20" />

            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase font-bold opacity-40 tracking-widest">{t.uiLang}:</span>
              <select 
                value={uiLanguage} 
                onChange={(e) => setUiLanguage(e.target.value)}
                className="bg-transparent border-none text-[10px] uppercase font-bold tracking-widest focus:ring-0 cursor-pointer"
              >
                {languages.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-editorial-ink/20 hidden sm:block" />

          {user ? (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => logout()}
              className="text-[10px] uppercase font-bold tracking-widest h-8 rounded-none px-3"
            >
              <LogOut className="w-3 h-3 mr-2" />
              {t.logout}
            </Button>
          ) : (
            <Button 
              size="sm"
              onClick={() => signInWithGoogle()}
              className="text-[10px] uppercase font-bold tracking-widest h-8 rounded-none px-4 bg-editorial-ink text-white hover:bg-zinc-800"
            >
              <LogIn className="w-3 h-3 mr-2" />
              {t.login}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 w-8 border border-editorial-ink rounded-none flex items-center justify-center hover:bg-zinc-100 outline-none transition-colors">
              <Menu className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              sideOffset={8}
              className="z-[100] w-64 rounded-none border-2 border-editorial-ink bg-editorial-bg p-3 shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="serif italic text-xl border-b-2 border-editorial-ink pb-2 mb-3">{t.credentials}</DropdownMenuLabel>
                <DropdownMenuItem className="rounded-none focus:bg-editorial-ink focus:text-white cursor-default p-2 mb-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold opacity-40 tracking-widest">{t.name}</span>
                    <span className="text-sm font-bold">Bulat Nikita</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-none focus:bg-editorial-ink focus:text-white cursor-default p-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold opacity-40 tracking-widest">{t.role}</span>
                    <span className="text-sm font-bold">Lead Developer</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              
              <DropdownMenuSeparator className="bg-editorial-ink my-4 h-0.5" />
              
              <DropdownMenuGroup>
                <DropdownMenuLabel className="serif italic text-xl border-b-2 border-editorial-ink pb-2 mb-3">{t.contact}</DropdownMenuLabel>
                <DropdownMenuItem 
                  className="rounded-none focus:bg-editorial-ink focus:text-white cursor-pointer p-2 flex items-center gap-3" 
                  onClick={() => window.location.href = 'mailto:bulatnikita108@gmail.com'}
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-xs font-bold">bulatnikita108@gmail.com</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-editorial-ink my-4 h-0.5" />

              <Sheet>
                <SheetTrigger className="w-full justify-start rounded-none text-xs font-bold uppercase tracking-widest h-10 hover:bg-editorial-ink hover:text-white flex items-center px-2 transition-colors">
                  <MessageSquare className="w-4 h-4 mr-3" />
                  {t.assistantTitle}
                </SheetTrigger>
                <SheetContent side="right" className="p-0 w-full sm:w-[400px] border-l-2 border-editorial-ink bg-editorial-bg">
                  <ChatInterface uiLanguage={uiLanguage} />
                </SheetContent>
              </Sheet>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile UI Language Selector (visible only on small screens) */}
          <div className="sm:hidden px-4 py-2 border-b border-editorial-ink bg-white flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold opacity-40 tracking-widest">{t.uiLang}:</span>
            <select 
              value={uiLanguage} 
              onChange={(e) => setUiLanguage(e.target.value)}
              className="bg-transparent border-none text-[10px] uppercase font-bold tracking-widest focus:ring-0 cursor-pointer"
            >
              {languages.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Mobile Tabs for Main Sections */}
          <Tabs defaultValue="intake" className="flex-1 flex flex-col lg:hidden overflow-hidden">
            <TabsList className="w-full justify-start rounded-none bg-white border-b border-editorial-ink h-12 p-0">
              <TabsTrigger value="intake" className="flex-1 rounded-none data-[state=active]:bg-editorial-ink data-[state=active]:text-white uppercase text-[10px] font-bold tracking-widest h-full">{t.intakeTab}</TabsTrigger>
              <TabsTrigger value="jd" className="flex-1 rounded-none data-[state=active]:bg-editorial-ink data-[state=active]:text-white uppercase text-[10px] font-bold tracking-widest h-full">{t.jdTab}</TabsTrigger>
              <TabsTrigger value="guide" className="flex-1 rounded-none data-[state=active]:bg-editorial-ink data-[state=active]:text-white uppercase text-[10px] font-bold tracking-widest h-full">{t.guideTab}</TabsTrigger>
            </TabsList>

            <TabsContent value="intake" className="flex-1 m-0 overflow-hidden">
              <section className="input-pane bg-white p-6 flex flex-col relative h-full overflow-hidden">
                <span className="label text-[10px] uppercase font-bold opacity-50 mb-2 block">{t.step1Label}</span>
                <h2 className="text-xl italic serif mb-5 border-b-2 border-editorial-ink pb-2">{t.step1Header}</h2>
                
                <div className="mb-6">
                  <span className="label text-[9px] uppercase font-bold opacity-40 mb-2 block tracking-widest">{t.langLabel}</span>
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 border transition-colors ${
                          selectedLanguages.includes(lang) 
                            ? 'bg-editorial-ink text-white border-editorial-ink' 
                            : 'bg-transparent text-zinc-400 border-zinc-200 hover:border-editorial-ink hover:text-editorial-ink'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 relative">
                  <Textarea 
                    placeholder={t.intakePlaceholder}
                    className="w-full h-full border-none focus-visible:ring-0 resize-none p-0 text-sm leading-relaxed text-zinc-600 bg-transparent placeholder:text-zinc-300"
                    value={rawNotes}
                    onChange={(e) => setRawNotes(e.target.value)}
                  />
                </div>

                <div className="mt-8">
                  <Button 
                    onClick={handleGenerate} 
                    disabled={isGenerating || !rawNotes.trim() || selectedLanguages.length === 0}
                    className="w-full bg-editorial-ink hover:bg-zinc-800 text-white rounded-none uppercase text-xs font-bold tracking-widest py-6"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.generating}</>
                    ) : (
                      <>{t.generateBtn}</>
                    )}
                  </Button>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="jd" className="flex-1 m-0 overflow-hidden bg-editorial-bg">
              <div className="flex flex-col h-full overflow-hidden">
                {result && (
                  <div className="px-6 py-3 border-b border-editorial-ink bg-white flex items-center gap-2 overflow-x-auto">
                    {Object.keys(result).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setActiveLangTab(lang)}
                        className={`whitespace-nowrap px-3 py-1 text-[9px] uppercase font-bold tracking-widest border transition-all ${
                          activeLangTab === lang 
                            ? 'bg-editorial-ink text-white border-editorial-ink' 
                            : 'bg-transparent text-zinc-400 border-zinc-200'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
                <section className="p-6 flex flex-col h-full overflow-hidden">
                  <span className="label text-[10px] uppercase font-bold opacity-50 mb-2 block">{t.step2Label}</span>
                  <h2 className="text-xl italic serif mb-5 border-b-2 border-editorial-ink pb-2">{t.step2Header}</h2>
                  <ScrollArea className="flex-1">
                    <div className="jd-content prose prose-sm prose-zinc max-w-none prose-headings:serif prose-headings:text-editorial-ink prose-p:text-zinc-700 prose-strong:text-editorial-ink">
                      {result && activeLangTab ? (
                        isEditing ? (
                          <Textarea 
                            value={result[activeLangTab].jobDescription}
                            onChange={(e) => updateManualContent(e.target.value, 'jd')}
                            className="min-h-[400px] w-full border-none focus-visible:ring-0 p-0 text-sm leading-relaxed"
                          />
                        ) : (
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{result[activeLangTab].jobDescription}</ReactMarkdown>
                        )
                      ) : (
                        <div className="opacity-20 flex flex-col items-center justify-center h-64 text-center">
                          <FileText className="w-12 h-12 mb-4" />
                          <p className="text-xs uppercase tracking-widest">{t.waiting}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  {result && activeLangTab && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        <Input 
                          placeholder={t.refinePlaceholder}
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          className="h-9 text-[10px] rounded-none border-editorial-ink"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={isRefining || !refineInput.trim()}
                          onClick={() => handleRefine('jd')}
                          className="h-9 border-editorial-ink rounded-none px-3"
                        >
                          {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={isSaving}
                          onClick={user ? handleSaveToLibrary : signInWithGoogle}
                          className={`flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest ${!user ? 'opacity-70 hover:opacity-100' : ''}`}
                        >
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3 mr-2" />}
                          {isSaving ? t.saving : (user ? t.saveToLibrary : t.loginToSavePrompt)}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                          onClick={() => copyToClipboard(result[activeLangTab].jobDescription, 'jd')}
                        >
                          {copied === 'jd' ? t.copied : t.copyJD}
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </TabsContent>

            <TabsContent value="guide" className="flex-1 m-0 overflow-hidden bg-editorial-bg">
              <div className="flex flex-col h-full overflow-hidden">
                {result && (
                  <div className="px-6 py-3 border-b border-editorial-ink bg-white flex items-center gap-2 overflow-x-auto">
                    {Object.keys(result).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setActiveLangTab(lang)}
                        className={`whitespace-nowrap px-3 py-1 text-[9px] uppercase font-bold tracking-widest border transition-all ${
                          activeLangTab === lang 
                            ? 'bg-editorial-ink text-white border-editorial-ink' 
                            : 'bg-transparent text-zinc-400 border-zinc-200'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
                <section className="p-6 flex flex-col h-full overflow-hidden">
                  <span className="label text-[10px] uppercase font-bold opacity-50 mb-2 block">{t.step3Label}</span>
                  <h2 className="text-xl italic serif mb-5 border-b-2 border-editorial-ink pb-2">{t.step3Header}</h2>
                  <ScrollArea className="flex-1">
                    <div className="interview-list prose prose-sm prose-zinc max-w-none prose-headings:serif prose-headings:text-editorial-ink prose-p:text-zinc-700">
                      {result && activeLangTab ? (
                        isEditing ? (
                          <Textarea 
                            value={result[activeLangTab].interviewGuide}
                            onChange={(e) => updateManualContent(e.target.value, 'guide')}
                            className="min-h-[400px] w-full border-none focus-visible:ring-0 p-0 text-sm leading-relaxed"
                          />
                        ) : (
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{result[activeLangTab].interviewGuide}</ReactMarkdown>
                        )
                      ) : (
                        <div className="opacity-20 flex flex-col items-center justify-center h-64 text-center">
                          <ClipboardCheck className="w-12 h-12 mb-4" />
                          <p className="text-xs uppercase tracking-widest">{t.waiting}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  {result && activeLangTab && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        <Input 
                          placeholder={t.refinePlaceholder}
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          className="h-9 text-[10px] rounded-none border-editorial-ink"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={isRefining || !refineInput.trim()}
                          onClick={() => handleRefine('guide')}
                          className="h-9 border-editorial-ink rounded-none px-3"
                        >
                          {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={isSaving}
                          onClick={user ? handleSaveToLibrary : signInWithGoogle}
                          className={`flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest ${!user ? 'opacity-70 hover:opacity-100' : ''}`}
                        >
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3 mr-2" />}
                          {isSaving ? t.saving : (user ? t.saveToLibrary : t.loginToSavePrompt)}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                          onClick={() => copyToClipboard(result[activeLangTab].interviewGuide, 'guide')}
                        >
                          {copied === 'guide' ? t.copied : t.copyGuide}
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </TabsContent>
          </Tabs>

          {/* Desktop Grid Layout (visible only on large screens) */}
          <main className="hidden lg:grid flex-1 grid-cols-[320px_1fr_1fr] h-full overflow-hidden">
            {/* INPUT SECTION */}
            <section className="input-pane bg-white border-r border-editorial-ink p-8 flex flex-col relative h-full overflow-hidden">
              <span className="label text-[10px] uppercase font-bold opacity-50 mb-2 block">{t.step1Label}</span>
              <h2 className="text-xl italic serif mb-5 border-b-2 border-editorial-ink pb-2">{t.step1Header}</h2>
              
              <div className="mb-6">
                <span className="label text-[9px] uppercase font-bold opacity-40 mb-2 block tracking-widest">{t.langLabel}</span>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 border transition-colors ${
                        selectedLanguages.includes(lang) 
                          ? 'bg-editorial-ink text-white border-editorial-ink' 
                          : 'bg-transparent text-zinc-400 border-zinc-200 hover:border-editorial-ink hover:text-editorial-ink'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 relative">
                <Textarea 
                  placeholder={t.intakePlaceholder}
                  className="w-full h-full border-none focus-visible:ring-0 resize-none p-0 text-sm leading-relaxed text-zinc-600 bg-transparent placeholder:text-zinc-300"
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                />
              </div>

              <div className="mt-8">
                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !rawNotes.trim() || selectedLanguages.length === 0}
                  className="w-full bg-editorial-ink hover:bg-zinc-800 text-white rounded-none uppercase text-xs font-bold tracking-widest py-6"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t.generating}
                    </>
                  ) : (
                    <>
                      {t.generateBtn}
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* OUTPUT COLUMNS */}
            <div className="col-span-2 flex flex-col h-full overflow-hidden">
              {result && (
                <div className="px-8 pt-4 border-b border-editorial-ink bg-white flex items-center gap-4">
                  <span className="text-[9px] uppercase font-bold opacity-40 tracking-widest">{t.outputLang}:</span>
                  <div className="flex gap-2">
                    {Object.keys(result).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setActiveLangTab(lang)}
                        className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest border-b-2 transition-all ${
                          activeLangTab === lang 
                            ? 'border-editorial-ink text-editorial-ink' 
                            : 'border-transparent text-zinc-400 hover:text-editorial-ink'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-2 pb-2">
                    {result && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSaving}
                        onClick={user ? handleSaveToLibrary : signInWithGoogle}
                        className={`text-[10px] uppercase font-bold tracking-widest h-8 border border-editorial-ink/10 ${!user ? 'opacity-70 hover:opacity-100' : ''}`}
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Bookmark className="w-3 h-3 mr-2" />}
                        {isSaving ? t.saving : (user ? t.saveToLibrary : t.loginToSavePrompt)}
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsEditing(!isEditing)}
                      className="text-[10px] uppercase font-bold tracking-widest h-8"
                    >
                      {isEditing ? <Save className="w-3 h-3 mr-2" /> : <Edit3 className="w-3 h-3 mr-2" />}
                      {isEditing ? t.save : t.edit}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex-1 grid grid-cols-2 overflow-hidden">
                {/* JD COLUMN */}
                <section className="output-pane border-r border-editorial-border p-8 flex flex-col h-full overflow-hidden">
                  <span className="label text-[10px] uppercase font-bold opacity-50 mb-2 block">{t.step2Label}</span>
                  <h2 className="text-xl italic serif mb-5 border-b-2 border-editorial-ink pb-2">{t.step2Header}</h2>
                  
                  <ScrollArea className="flex-1">
                    <div className="jd-content prose prose-sm prose-zinc max-w-none prose-headings:serif prose-headings:text-editorial-ink prose-p:text-zinc-700 prose-strong:text-editorial-ink">
                      {result && activeLangTab ? (
                        isEditing ? (
                          <Textarea 
                            value={result[activeLangTab].jobDescription}
                            onChange={(e) => updateManualContent(e.target.value, 'jd')}
                            className="min-h-[500px] w-full border-none focus-visible:ring-0 p-0 text-sm leading-relaxed"
                          />
                        ) : (
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{result[activeLangTab].jobDescription}</ReactMarkdown>
                        )
                      ) : (
                        <div className="opacity-20 flex flex-col items-center justify-center h-64 text-center">
                          <FileText className="w-12 h-12 mb-4" />
                          <p className="text-xs uppercase tracking-widest">{t.waiting}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {result && activeLangTab && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        <Input 
                          placeholder={t.refinePlaceholder}
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          className="h-9 text-[10px] rounded-none border-editorial-ink"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={isRefining || !refineInput.trim()}
                          onClick={() => handleRefine('jd')}
                          className="h-9 border-editorial-ink rounded-none px-3"
                        >
                          {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        </Button>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                        onClick={() => copyToClipboard(result[activeLangTab].jobDescription, 'jd')}
                      >
                        {copied === 'jd' ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
                        {copied === 'jd' ? t.copied : t.copyJD}
                      </Button>
                    </div>
                  )}
                </section>

                {/* GUIDE COLUMN */}
                <section className="output-pane p-8 flex flex-col h-full overflow-hidden">
                  <span className="label text-[10px] uppercase font-bold opacity-50 mb-2 block">{t.step3Label}</span>
                  <h2 className="text-xl italic serif mb-5 border-b-2 border-editorial-ink pb-2">{t.step3Header}</h2>
                  
                  <ScrollArea className="flex-1">
                    <div className="interview-list prose prose-sm prose-zinc max-w-none prose-headings:serif prose-headings:text-editorial-ink prose-p:text-zinc-700">
                      {result && activeLangTab ? (
                        isEditing ? (
                          <Textarea 
                            value={result[activeLangTab].interviewGuide}
                            onChange={(e) => updateManualContent(e.target.value, 'guide')}
                            className="min-h-[500px] w-full border-none focus-visible:ring-0 p-0 text-sm leading-relaxed"
                          />
                        ) : (
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{result[activeLangTab].interviewGuide}</ReactMarkdown>
                        )
                      ) : (
                        <div className="opacity-20 flex flex-col items-center justify-center h-64 text-center">
                          <ClipboardCheck className="w-12 h-12 mb-4" />
                          <p className="text-xs uppercase tracking-widest">{t.waiting}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {result && activeLangTab && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        <Input 
                          placeholder={t.refinePlaceholder}
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          className="h-9 text-[10px] rounded-none border-editorial-ink"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={isRefining || !refineInput.trim()}
                          onClick={() => handleRefine('guide')}
                          className="h-9 border-editorial-ink rounded-none px-3"
                        >
                          {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        </Button>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                        onClick={() => copyToClipboard(result[activeLangTab].interviewGuide, 'guide')}
                      >
                        {copied === 'guide' ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
                        {copied === 'guide' ? t.copied : t.copyGuide}
                      </Button>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </main>
        </div>

        {/* Chat Sidebar */}
        <aside className="w-80 hidden xl:block border-l border-editorial-ink">
          <ChatInterface uiLanguage={uiLanguage} />
        </aside>
      </div>

      {error && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-editorial-accent text-white px-6 py-3 shadow-2xl flex items-center gap-3 text-sm uppercase font-bold tracking-widest">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
