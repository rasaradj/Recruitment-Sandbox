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
  Bookmark,
  Share2,
  LayoutGrid,
  BarChart3,
  Play,
  DownloadCloud,
  Globe,
  Mic,
  Link2,
  GripVertical,
  FileWarning,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { generateRecruitmentMaterials, GenerationResult, refineMaterial, getRoleBenchmarks } from '@/src/lib/gemini';
import { ChatInterface } from '@/src/components/ChatInterface';
import { Library } from '@/src/components/Library';
import { EvaluatorMode } from '@/src/components/EvaluatorMode';
import { TemplateGallery } from '@/src/components/TemplateGallery';
import { 
  auth, 
  signInWithGoogle, 
  logout, 
  onAuthStateChanged, 
  db, 
  collection, 
  addDoc, 
  serverTimestamp,
  testConnection,
  OperationType,
  handleFirestoreError,
  User as FirebaseUser,
  updateDoc,
  doc,
  getDoc
} from '@/src/lib/firebase';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  const [view, setView] = useState<'sandbox' | 'library' | 'templates' | 'evaluator'>('sandbox');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [benchmarks, setBenchmarks] = useState<string | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const t = translations[uiLanguage] || translations.English;

  const languages = Object.keys(translations);

  useEffect(() => {
    testConnection();
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = uiLanguage === 'Spanish' ? 'es-ES' : 
                               uiLanguage === 'French' ? 'fr-FR' :
                               uiLanguage === 'German' ? 'de-DE' : 'en-US';

      recognitionInstance.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setRawNotes(prev => prev + ' ' + event.results[i][0].transcript);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };

      setRecognition(recognitionInstance);
    }
  }, [uiLanguage]);

  const toggleRecording = () => {
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleLinkImport = async () => {
    if (!importUrl) return;
    setIsImporting(true);
    setIsGenerating(true);
    try {
      // In a real app, this would use a backend scraper.
      // Here we ask Gemini to "imagine" what's at the link or use the link as a context.
      const prompt = `I want to import a job from this link: ${importUrl}. 
      Act as if you can access it and generate the notes for it. 
      If you can't, generate a generic high-quality recruitment intake based on the URL context (company name, title etc).`;
      
      const res = await generateRecruitmentMaterials(prompt, selectedLanguages);
      setResult(res);
      setRawNotes(`Imported from: ${importUrl}`);
      setActiveLangTab(selectedLanguages[0]);
    } catch (err) {
      console.error(err);
      setError("Failed to import link.");
    } finally {
      setIsImporting(false);
      setIsGenerating(false);
    }
  };

  const handleExportWord = async () => {
    if (!result || !activeLangTab) return;
    const jd = result[activeLangTab].jobDescription;
    const guide = result[activeLangTab].interviewGuide;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "Recruitment Sandbox Output",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: `Language: ${activeLangTab}`,
            heading: HeadingLevel.HEADING_3,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "Job Description",
            heading: HeadingLevel.HEADING_2,
          }),
          ...jd.split('\n').map(line => new Paragraph({
            children: [new TextRun(line)],
          })),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "Interview Guide",
            heading: HeadingLevel.HEADING_2,
            pageBreakBefore: true,
          }),
          ...guide.split('\n').map(line => new Paragraph({
            children: [new TextRun(line)],
          })),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Recruitment_${activeLangTab}.docx`);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('id');
    if (sharedId) {
      const loadShared = async () => {
        try {
          const docRef = doc(db, 'saved_outputs', sharedId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setResult(data.results);
            setRawNotes(data.rawNotes);
            setSelectedLanguages(data.selectedLanguages || []);
            // Clear the param to avoid reloading on every refresh
            window.history.replaceState({}, document.title, "/");
          }
        } catch (err) {
          console.error('Error loading shared item:', err);
        }
      };
      loadShared();
    }
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
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'Unknown error';
      setError(`Failed to generate materials: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => {
      const current = prev || [];
      return current.includes(lang) 
        ? current.filter(l => l !== lang) 
        : [...current, lang];
    });
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

  const handleSaveToLibrary = async (asTemplate = false) => {
    if (!user || !result) return;
    setIsSaving(true);
    try {
      const title = rawNotes.split('\n')[0].substring(0, 50) || 'Untitled Recruitment Material';
      
      if (asTemplate) {
        await addDoc(collection(db, 'templates'), {
          userId: user.uid,
          authorName: user.displayName || 'Anonymous',
          title,
          description: `Template based on ${title}`,
          rawNotes,
          category: 'General',
          installCount: 0,
          createdAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'saved_outputs'), {
          userId: user.uid,
          authorName: user.displayName || 'Anonymous',
          title,
          rawNotes,
          selectedLanguages,
          results: result,
          isPublic: false,
          isTemplate: false,
          createdAt: serverTimestamp()
        });
      }
      setIsSaving(false);
    } catch (err) {
      console.error('Save error:', err);
      handleFirestoreError(err, OperationType.CREATE, asTemplate ? 'templates' : 'saved_outputs');
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (!result || !activeLangTab) return;
    const doc = new jsPDF();
    const jd = result[activeLangTab].jobDescription;
    const guide = result[activeLangTab].interviewGuide;
    
    doc.setFontSize(20);
    doc.text("Recruitment Sandbox Output", 10, 20);
    doc.setFontSize(12);
    doc.text(`Language: ${activeLangTab}`, 10, 30);
    
    doc.setFontSize(16);
    doc.text("Job Description", 10, 45);
    doc.setFontSize(10);
    const jdLines = doc.splitTextToSize(jd, 180);
    doc.text(jdLines, 10, 55);
    
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Interview Guide", 10, 20);
    doc.setFontSize(10);
    const guideLines = doc.splitTextToSize(guide, 180);
    doc.text(guideLines, 10, 30);
    
    doc.save(`Recruitment_${activeLangTab}.pdf`);
  };

  const handleGetBenchmarks = async () => {
    const jobTitle = rawNotes.split('\n')[0] || 'this role';
    setIsBenchmarking(true);
    try {
      const data = await getRoleBenchmarks(jobTitle, activeLangTab || 'English');
      setBenchmarks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleShare = async () => {
    if (!user || !result) return;
    // For simplicity, we save it as public first
    setIsSaving(true);
    try {
      const title = rawNotes.split('\n')[0].substring(0, 50) || 'Shared Recruitment Material';
      const docRef = await addDoc(collection(db, 'saved_outputs'), {
        userId: user.uid,
        authorName: user.displayName || 'Anonymous',
        title,
        rawNotes,
        selectedLanguages,
        results: result,
        isPublic: true,
        createdAt: serverTimestamp()
      });
      const shareUrl = `${window.location.origin}?id=${docRef.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied('jd'); // Reuse copied state for feedback
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInstallTemplate = (notes: string) => {
    setRawNotes(notes);
    setView('sandbox');
  };

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  if (view === 'library') {
    return (
      <div className="h-screen overflow-hidden">
        <Library 
          uiLanguage={uiLanguage} 
          onBack={() => setView('sandbox')} 
          onLoadItem={(item: any) => {
            setResult(item.results);
            setRawNotes(item.rawNotes);
            setSelectedLanguages(item.selectedLanguages || []);
            setView('sandbox');
          }}
        />
      </div>
    );
  }

  if (view === 'templates') {
    return (
      <div className="h-screen overflow-hidden">
        <TemplateGallery 
          uiLanguage={uiLanguage}
          onBack={() => setView('sandbox')}
          onInstall={handleInstallTemplate}
        />
      </div>
    );
  }

  if (view === 'evaluator' && result && activeLangTab) {
    return (
      <div className="h-screen overflow-hidden">
        <EvaluatorMode 
          content={result[activeLangTab].interviewGuide}
          uiLanguage={uiLanguage}
          onBack={() => setView('sandbox')}
          onSaveNotes={(notes) => {
            // Append notes to the guide or save separately
            updateManualContent(result[activeLangTab].interviewGuide + "\n\n---\n\n" + notes, 'guide');
            setView('sandbox');
          }}
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
              onClick={() => setView('templates')}
              className="text-[10px] uppercase font-bold tracking-widest h-8 border border-editorial-ink/20 rounded-none"
            >
              <LayoutGrid className="w-3 h-3 mr-2" />
              {t.templates}
            </Button>

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
                <header className="flex flex-col gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] bg-editorial-ink text-white px-2 py-0.5">
                      {t.step1Label}
                    </span>
                    <h2 className="text-xl italic serif pb-2 border-b-2 border-editorial-ink flex-1">
                      {t.step1Header}
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                      <Input 
                        placeholder={t.linkPlaceholder}
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        className="pl-10 rounded-none border-editorial-ink focus:ring-0 focus:border-editorial-accent transition-all text-xs h-9"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleLinkImport}
                      disabled={isImporting || !importUrl}
                      className="rounded-none border-editorial-ink uppercase text-[10px] font-bold tracking-widest h-9 px-4 shrink-0"
                    >
                      {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    </Button>
                  </div>
                </header>
                
                <div className="mb-6">
                  <span className="label text-[9px] uppercase font-bold opacity-40 mb-2 block tracking-widest">{t.langLabel}</span>
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 border transition-colors ${
                          (selectedLanguages || []).includes(lang) 
                            ? 'bg-editorial-ink text-white border-editorial-ink' 
                            : 'bg-transparent text-zinc-400 border-zinc-200 hover:border-editorial-ink hover:text-editorial-ink'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 relative group">
                  <Textarea 
                    placeholder={t.intakePlaceholder}
                    className="w-full h-full border-none focus-visible:ring-0 resize-none p-0 text-sm leading-relaxed text-zinc-600 bg-transparent placeholder:text-zinc-300"
                    value={rawNotes}
                    onChange={(e) => setRawNotes(e.target.value)}
                  />
                  <div className="absolute right-0 bottom-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={toggleRecording}
                      className={`rounded-none border-editorial-ink uppercase text-[9px] font-bold tracking-widest bg-white ${isRecording ? 'animate-pulse border-red-500 text-red-500' : ''}`}
                    >
                      <Mic className="w-3 h-3 mr-2" />
                      {isRecording ? t.voiceStop : t.voiceStart}
                    </Button>
                  </div>
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
                          onClick={user ? () => handleSaveToLibrary(false) : signInWithGoogle}
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
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleExportPDF}
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                        >
                          <DownloadCloud className="w-3 h-3 mr-2" />
                          {t.exportPDF}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleExportWord}
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                        >
                          <FileText className="w-3 h-3 mr-2" />
                          {t.exportWord}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleShare}
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                        >
                          <Share2 className="w-3 h-3 mr-2" />
                          {t.share}
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
                          onClick={user ? () => handleSaveToLibrary(false) : signInWithGoogle}
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
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setView('evaluator')}
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                        >
                          <Play className="w-3 h-3 mr-2" />
                          {t.evaluatorMode}
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </TabsContent>
          </Tabs>

          {/* Desktop Grid Layout (visible only on large screens) */}
          <main className="hidden lg:grid flex-1 grid-cols-[350px_1fr_1fr] h-full overflow-hidden">
            {/* INPUT SECTION */}
            <section className="input-pane bg-white border-r border-editorial-ink p-8 flex flex-col relative h-full overflow-hidden">
              <header className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] bg-editorial-ink text-white px-2 py-0.5">
                    {t.step1Label}
                  </span>
                  <h2 className="text-xl italic serif border-b-2 border-editorial-ink pb-2 flex-1">
                    {t.step1Header}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <Input 
                      placeholder={t.linkPlaceholder}
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      className="pl-10 rounded-none border-editorial-ink focus:ring-0 focus:border-editorial-accent transition-all text-xs h-10"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleLinkImport}
                    disabled={isImporting || !importUrl}
                    className="rounded-none border-editorial-ink uppercase text-[10px] font-bold tracking-widest h-10 px-4 shrink-0"
                  >
                    {isImporting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                    {t.linkImport}
                  </Button>
                </div>
              </header>
              
              <div className="mb-6">
                <span className="label text-[9px] uppercase font-bold opacity-40 mb-2 block tracking-widest">{t.langLabel}</span>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 border transition-colors ${
                        (selectedLanguages || []).includes(lang) 
                          ? 'bg-editorial-ink text-white border-editorial-ink' 
                          : 'bg-transparent text-zinc-400 border-zinc-200 hover:border-editorial-ink hover:text-editorial-ink'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 relative group">
                <Textarea 
                  placeholder={t.intakePlaceholder}
                  className="w-full h-full border-none focus-visible:ring-0 resize-none p-0 text-sm leading-relaxed text-zinc-600 bg-transparent placeholder:text-zinc-300"
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                />
                <div className="absolute right-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleRecording}
                    className={`rounded-none border-editorial-ink uppercase text-[10px] font-bold tracking-widest bg-white ${isRecording ? 'animate-pulse border-red-500 text-red-500' : ''}`}
                  >
                    <Mic className="w-3 h-3 mr-2" />
                    {isRecording ? t.voiceStop : t.voiceStart}
                  </Button>
                </div>
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
                    {deferredPrompt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleInstallApp}
                        className="text-[10px] uppercase font-bold tracking-widest h-8 border border-editorial-ink/10"
                      >
                        <Globe className="w-3 h-3 mr-2" />
                        Install App
                      </Button>
                    )}
                    {result && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "text-[10px] uppercase font-bold tracking-widest h-8 border border-editorial-ink/10"
                          )}
                        >
                          <Bookmark className="w-3 h-3 mr-2" />
                          {t.save}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-2 border-editorial-ink bg-white">
                          <DropdownMenuItem onClick={() => handleSaveToLibrary(false)} className="text-[10px] uppercase font-bold tracking-widest rounded-none">
                            {t.saveToLibrary}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSaveToLibrary(true)} className="text-[10px] uppercase font-bold tracking-widest rounded-none">
                            {t.saveAsTemplate}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-1 p-1 border border-editorial-ink/5 bg-zinc-50 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-3 h-3 opacity-20" />
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">JD Content Segment</span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                            onClick={() => copyToClipboard(result[activeLangTab].jobDescription, 'jd')}
                          >
                            {copied === 'jd' ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
                            {copied === 'jd' ? t.copied : t.copyJD}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleExportPDF}
                            className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                          >
                            <DownloadCloud className="w-3 h-3 mr-2" />
                            {t.exportPDF}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleExportWord}
                            className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                          >
                            <FileText className="w-3 h-3 mr-2" />
                            {t.exportWord}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleShare}
                            className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                          >
                            <Share2 className="w-3 h-3 mr-2" />
                            {t.share}
                          </Button>
                        </div>
                        <div className="pt-4 border-t border-editorial-ink/10">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            disabled={isBenchmarking}
                            onClick={handleGetBenchmarks}
                            className="w-full border border-editorial-ink/20 rounded-none uppercase text-[10px] font-bold tracking-widest"
                          >
                            {isBenchmarking ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <BarChart3 className="w-3 h-3 mr-2" />}
                            {t.getBenchmarks}
                          </Button>
                          {benchmarks && (
                            <div className="mt-4 p-4 bg-zinc-50 border border-editorial-ink/10 text-[11px] prose prose-sm max-w-none">
                              <ReactMarkdown>{benchmarks}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
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
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                          onClick={() => copyToClipboard(result[activeLangTab].interviewGuide, 'guide')}
                        >
                          {copied === 'guide' ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
                          {copied === 'guide' ? t.copied : t.copyGuide}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setView('evaluator')}
                          className="flex-1 border-editorial-ink rounded-none uppercase text-[10px] font-bold tracking-widest"
                        >
                          <Play className="w-3 h-3 mr-2" />
                          {t.evaluatorMode}
                        </Button>
                      </div>
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
