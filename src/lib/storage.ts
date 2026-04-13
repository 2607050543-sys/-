export interface MoodEntry {
  id: string;
  time: string;
  content: string;
  mood: string;
  moodIcon: string;
  tags: string[];
  image?: string;
  location?: {
    address?: string;
    coords?: { latitude: number; longitude: number };
  };
}

export interface DailyDiary {
  date: string;
  summary: string;
  entries: MoodEntry[];
}

const STORAGE_KEY = "mood_journal_data";

export const storage = {
  saveEntries: (entries: MoodEntry[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  },
  getEntries: (): MoodEntry[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveDiary: (date: string, summary: string) => {
    const diaries = JSON.parse(localStorage.getItem("mood_diaries") || "{}");
    diaries[date] = summary;
    localStorage.setItem("mood_diaries", JSON.stringify(diaries));
  },
  getDiary: (date: string): string | null => {
    const diaries = JSON.parse(localStorage.getItem("mood_diaries") || "{}");
    return diaries[date] || null;
  }
};
