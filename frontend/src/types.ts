export type Category =
  | "Routine Work"
  | "OKR"
  | "Team Contribution"
  | "Company Contribution";

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string; // ISO datetime string
}

export interface LogEntry {
  id: number;
  date: string; // ISO date string (YYYY-MM-DD)
  category: Category;
  project_id: number;
  project_name?: string; // Populated from backend for display
  task: string;
  hours: number; // Total hours = TimeSpan hours + additional_hours
  additional_hours: number; // Manually added hours
  status?: string;
  notes?: string;
}

export interface TimeSpan {
  id: number;
  log_entry_id: number;
  start_timestamp: string; // ISO datetime string
  end_timestamp?: string; // ISO datetime string
  created_at: string; // ISO datetime string
}

export interface LogEntryCreate {
  date: string;
  category: Category;
  project_id: number;
  task: string;
  hours: number; // Total hours (calculated on backend)
  additional_hours: number; // Manually added hours
  status?: string;
  notes?: string;
}

export interface LogEntryUpdate extends LogEntryCreate {}

export interface DateNavigatorProps {
  date: Date;
  onChange: (date: Date) => void;
}

export interface DailySnapshotProps {
  totalHours: number;
  categoryHours: Record<string, number>;
}

export interface LogEntryCardProps {
  entry: LogEntry;
  onEdit: (entry: LogEntry) => void;
  onDelete: (id: number) => void;
  activeTimeSpan?: TimeSpan | null;
  timespans?: TimeSpan[];
  onStartSession?: (entryId: number) => void;
  onPauseSession?: (timespanId: number) => void;
  onStopSession?: (timespanId: number) => void;
  onTimeSpanAdjust?: (timespanId: number, hours: number) => void;
  onTimeSpanUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
  onTimeSpanCreate?: (startTimestamp: string, endTimestamp: string) => Promise<void>;
  onTimeSpanDelete?: (timespanId: number) => Promise<void>;
  onTaskMarkdownChange?: (entryId: number, nextTaskMarkdown: string) => void;
}

export interface LogEntryEditorProps {
  entry?: LogEntry;
  date: string;
  onSave: (payload: LogEntryCreate) => void;
  onCancel: () => void;
  timespans?: TimeSpan[];
  onTimeSpanAdjust?: (timespanId: number, hours: number) => void;
  onTimeSpanUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
  onTimeSpanCreate?: (startTimestamp: string, endTimestamp: string) => Promise<void>;
  onTimeSpanDelete?: (timespanId: number) => Promise<void>;
}

export interface TimeSpanStartRequest {
  log_entry_id?: number;
  date?: string;
  category?: Category;
  project_id?: number;
  task?: string;
}
