/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar, 
  Mic, 
  Image as ImageIcon, 
  Smile, 
  ChevronLeft, 
  Send, 
  TrendingUp, 
  BookOpen,
  Trash2,
  Sparkles,
  X,
  MapPin,
  MessageCircleQuestion,
  ChevronRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { storage, MoodEntry } from './lib/storage';
import { analyzeMood, generateDailySummary, askAboutDay } from './lib/gemini';
import { cn, formatTime, formatDate } from './lib/utils';

const MOODS = [
  { icon: '😊', label: '开心', value: 5, color: 'text-yellow-500' },
  { icon: '🙂', label: '平静', value: 4, color: 'text-green-500' },
  { icon: '😐', label: '一般', value: 3, color: 'text-gray-500' },
  { icon: '😔', label: '难过', value: 2, color: 'text-blue-500' },
  { icon: '😫', label: '焦虑', value: 1, color: 'text-purple-500' },
];

type Page = 'home' | 'record' | 'diary' | 'ask' | 'history';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [allDiaries, setAllDiaries] = useState<Record<string, string>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [inputText, setInputText] = useState('');
  const [selectedMood, setSelectedMood] = useState(MOODS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [diarySummary, setDiarySummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{address?: string, coords?: {latitude: number, longitude: number}} | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  
  // AI Ask State
  const [userQuestion, setUserQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedEntries = storage.getEntries();
    setEntries(savedEntries);
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const savedDiary = storage.getDiary(today);
    if (savedDiary) setDiarySummary(savedDiary);

    // Load all historical diaries
    const diaries = JSON.parse(localStorage.getItem("mood_diaries") || "{}");
    setAllDiaries(diaries);
  }, []);

  const fetchLocation = () => {
    setIsFetchingLocation(true);

    // Check if AMap is loaded
    if (typeof window.AMap === 'undefined') {
      // Fallback to native geolocation if AMap is not available
      if (!navigator.geolocation) {
        alert('您的浏览器不支持定位功能。');
        setIsFetchingLocation(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({
            address: `经度: ${latitude.toFixed(2)}, 纬度: ${longitude.toFixed(2)}`,
            coords: { latitude, longitude }
          });
          setIsFetchingLocation(false);
        },
        (error) => {
          console.error('Native Location error:', error);
          alert('无法获取位置信息。');
          setIsFetchingLocation(false);
        }
      );
      return;
    }

    // Use AMap Geolocation
    window.AMap.plugin('AMap.Geolocation', function() {
      const geolocation = new window.AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      geolocation.getCurrentPosition(function(status: string, result: any) {
        if (status === 'complete') {
          setCurrentLocation({
            address: result.formattedAddress || `${result.addressComponent.city}${result.addressComponent.district}${result.addressComponent.township}`,
            coords: {
              latitude: result.position.lat,
              longitude: result.position.lng
            }
          });
        } else {
          console.error('AMap Location error:', result);
          alert('高德地图定位失败，请检查网络或权限。');
        }
        setIsFetchingLocation(false);
      });
    });
  };

  const handleSaveEntry = async () => {
    if (!inputText.trim()) return;

    const aiAnalysis = await analyzeMood(inputText);
    
    const newEntry: MoodEntry = {
      id: Date.now().toString(),
      time: formatTime(new Date()),
      content: inputText,
      mood: aiAnalysis.mood || selectedMood.label,
      moodIcon: selectedMood.icon,
      tags: [aiAnalysis.mood].filter(Boolean),
      image: selectedImage || undefined,
      location: currentLocation || undefined
    };

    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    storage.saveEntries(updatedEntries);
    
    // Reset form
    setInputText('');
    setSelectedImage(null);
    setCurrentLocation(null);
    setCurrentPage('home');
  };

  const handleDeleteEntry = (id: string) => {
    const updatedEntries = entries.filter(e => e.id !== id);
    setEntries(updatedEntries);
    storage.saveEntries(updatedEntries);
  };

  const handleGenerateDiary = async () => {
    if (entries.length === 0) return;
    setIsGenerating(true);
    setCurrentPage('diary');
    
    const summary = await generateDailySummary(entries);
    setDiarySummary(summary);
    const today = format(new Date(), 'yyyy-MM-dd');
    storage.saveDiary(today, summary);
    
    // Update allDiaries state
    const diaries = JSON.parse(localStorage.getItem("mood_diaries") || "{}");
    setAllDiaries(diaries);
    
    setIsGenerating(false);
  };

  const handleAskAI = async () => {
    if (!userQuestion.trim()) return;
    setIsAsking(true);
    const answer = await askAboutDay(userQuestion, entries);
    setAiAnswer(answer);
    setIsAsking(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRecording = (target: 'input' | 'ask') => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别功能。');
      return;
    }
    
    setIsRecording(true);
    setTimeout(() => {
      if (target === 'input') {
        setInputText(prev => prev + ' (语音输入内容)');
      } else {
        setUserQuestion(prev => prev + ' 我今天都去哪了？');
      }
      setIsRecording(false);
    }, 2000);
  };

  const chartData = [...entries].reverse().map(e => ({
    time: e.time,
    moodValue: MOODS.find(m => m.label === e.mood || m.icon === e.moodIcon)?.value || 3
  }));

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50 -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-pink-100 rounded-full blur-3xl opacity-50 -z-10" />

      <main className="flex-1 overflow-y-auto p-6 pb-24">
        <AnimatePresence mode="wait">
          {currentPage === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Header */}
              <header className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {format(new Date(), 'MM月dd日')}
                  </h1>
                  <p className="text-slate-500 font-medium">
                    {format(new Date(), 'EEEE', { locale: zhCN })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage('ask')}
                    className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-indigo-50 transition-colors"
                  >
                    <MessageCircleQuestion className="w-6 h-6 text-indigo-600" />
                  </button>
                  <button 
                    onClick={() => {
                      const diaries = JSON.parse(localStorage.getItem("mood_diaries") || "{}");
                      setAllDiaries(diaries);
                      setCurrentPage('history');
                    }}
                    className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-indigo-50 transition-colors"
                  >
                    <Calendar className="w-6 h-6 text-indigo-600" />
                  </button>
                </div>
              </header>

              {/* Mood Chart */}
              {entries.length > 1 && (
                <section className="glass-card p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <TrendingUp className="w-5 h-5 text-indigo-500" />
                      <h2>今日心情趋势</h2>
                    </div>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, 6]} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="moodValue" 
                          stroke="#6366f1" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#6366f1' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {/* Entries List */}
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-800">今日点滴</h2>
                  {entries.length > 0 && (
                    <button 
                      onClick={handleGenerateDiary}
                      className="text-sm font-semibold text-indigo-600 flex items-center gap-1 hover:underline"
                    >
                      <Sparkles className="w-4 h-4" />
                      生成日记
                    </button>
                  )}
                </div>
                
                {entries.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                      <BookOpen className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-slate-400">今天还没有记录呢，快来记一笔吧！</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {entries.map((entry) => (
                      <motion.div
                        layout
                        key={entry.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-4 group relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{entry.moodIcon}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{entry.time}</span>
                            {entry.location?.address && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <MapPin className="w-3 h-3" />
                                {entry.location.address}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-1 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-slate-700 leading-relaxed mb-3">{entry.content}</p>
                        {entry.image && (
                          <img 
                            src={entry.image} 
                            alt="Entry" 
                            className="w-full h-48 object-cover rounded-2xl mb-3"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="flex flex-wrap gap-2">
                          {entry.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {currentPage === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="space-y-6"
            >
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentPage('home')} className="p-2 hover:bg-white rounded-xl transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <h1 className="text-2xl font-bold">历史日记</h1>
                </div>
              </header>

              <div className="glass-card p-6 space-y-6">
                {/* Calendar Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">
                    {format(currentMonth, 'yyyy年 MMMM', { locale: zhCN })}
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <button 
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                    <div key={day} className="text-center text-xs font-bold text-slate-400 py-2">
                      {day}
                    </div>
                  ))}
                  {(() => {
                    const monthStart = startOfMonth(currentMonth);
                    const monthEnd = endOfMonth(monthStart);
                    const startDate = startOfWeek(monthStart);
                    const endDate = endOfWeek(monthEnd);
                    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                    return calendarDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const hasDiary = !!allDiaries[dateStr];
                      const isCurrentMonth = isSameMonth(day, monthStart);

                      return (
                        <button
                          key={day.toString()}
                          disabled={!hasDiary && isCurrentMonth}
                          onClick={() => {
                            if (hasDiary) {
                              setDiarySummary(allDiaries[dateStr]);
                              setCurrentPage('diary');
                            }
                          }}
                          className={cn(
                            "aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative",
                            !isCurrentMonth && "opacity-20 pointer-events-none",
                            isToday(day) && isCurrentMonth && "bg-indigo-50 text-indigo-600 font-bold",
                            hasDiary && isCurrentMonth && "hover:bg-indigo-600 hover:text-white cursor-pointer",
                            !hasDiary && isCurrentMonth && "text-slate-400"
                          )}
                        >
                          <span className="text-sm">{format(day, 'd')}</span>
                          {hasDiary && isCurrentMonth && (
                            <div className={cn(
                              "w-1 h-1 rounded-full mt-1",
                              isToday(day) ? "bg-indigo-600" : "bg-indigo-400"
                            )} />
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-xs text-slate-500 font-medium">有日记</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-50 border border-indigo-200" />
                  <span className="text-xs text-slate-500 font-medium">今天</span>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === 'record' && (
            <motion.div
              key="record"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <header className="flex items-center gap-4">
                <button onClick={() => setCurrentPage('home')} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold">记录此刻心情</h1>
              </header>

              <div className="glass-card p-6 space-y-6">
                {/* Mood Selector */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">当前情绪</label>
                  <div className="flex justify-between">
                    {MOODS.map((mood) => (
                      <button
                        key={mood.label}
                        onClick={() => setSelectedMood(mood)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-2xl transition-all",
                          selectedMood.label === mood.label ? "bg-indigo-50 scale-110 shadow-sm" : "hover:bg-slate-50"
                        )}
                      >
                        <span className="text-3xl">{mood.icon}</span>
                        <span className={cn("text-xs font-medium", selectedMood.label === mood.label ? "text-indigo-600" : "text-slate-400")}>
                          {mood.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Area */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">你想说点什么？</label>
                  <div className="relative">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="记录下这一刻的感受..."
                      className="w-full h-40 p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button 
                        onClick={() => toggleRecording('input')}
                        className={cn(
                          "p-3 rounded-xl transition-all",
                          isRecording ? "bg-red-500 text-white animate-pulse" : "bg-white text-slate-400 shadow-sm hover:text-indigo-600"
                        )}
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 bg-white text-slate-400 rounded-xl shadow-sm hover:text-indigo-600 transition-all"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        accept="image/*" 
                      />
                    </div>
                  </div>
                </div>

                {/* Location Display */}
                <div className="flex items-center justify-between">
                  <button 
                    onClick={fetchLocation}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors",
                      currentLocation ? "text-indigo-600" : "text-slate-400 hover:text-indigo-500"
                    )}
                  >
                    <MapPin className={cn("w-4 h-4", isFetchingLocation && "animate-bounce")} />
                    {currentLocation ? currentLocation.address : (isFetchingLocation ? "正在定位..." : "添加位置信息")}
                  </button>
                  {currentLocation && (
                    <button onClick={() => setCurrentLocation(null)} className="text-slate-300 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Image Preview */}
                {selectedImage && (
                  <div className="relative w-full h-40 rounded-2xl overflow-hidden group">
                    <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleSaveEntry}
                  disabled={!inputText.trim()}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  保存记录
                </button>
              </div>
            </motion.div>
          )}

          {currentPage === 'diary' && (
            <motion.div
              key="diary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <header className="flex items-center gap-4">
                <button onClick={() => setCurrentPage('home')} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold">今日心情日记</h1>
              </header>

              <div className="glass-card p-6 min-h-[400px]">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">AI 正在为您整理今日点滴...</p>
                  </div>
                ) : (
                  <div className="prose prose-slate max-w-none">
                    <div className="mb-6 flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 px-4 py-2 rounded-full w-fit">
                      <Sparkles className="w-4 h-4" />
                      AI 智能总结
                    </div>
                    <div className="markdown-body">
                      <ReactMarkdown>
                        {diarySummary || "暂无总结"}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setCurrentPage('home')}
                className="w-full btn-secondary"
              >
                返回主页
              </button>
            </motion.div>
          )}

          {currentPage === 'ask' && (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="space-y-6"
            >
              <header className="flex items-center gap-4">
                <button onClick={() => setCurrentPage('home')} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold">问问 AI</h1>
              </header>

              <div className="glass-card p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">你想了解今天的什么？</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      placeholder="例如：我今天都去哪了？"
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                    />
                    <button 
                      onClick={() => toggleRecording('ask')}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all",
                        isRecording ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:text-indigo-600"
                      )}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleAskAI}
                  disabled={!userQuestion.trim() || isAsking}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAsking ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  询问 AI
                </button>

                {aiAnswer && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-indigo-50 rounded-2xl text-slate-700 leading-relaxed border border-indigo-100"
                  >
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">AI 的回答</p>
                    {aiAnswer}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {currentPage === 'home' && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent">
          <button 
            onClick={() => setCurrentPage('record')}
            className="w-full h-16 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 font-bold text-lg hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-6 h-6" />
            记一笔心情
          </button>
        </nav>
      )}
    </div>
  );
}
