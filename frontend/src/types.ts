export type Category =
  | "Routine Work"
  | "OKR"
  | "Team Contribution"
  | "Company Contribution";

export interface LogEntry {
  id: number;
  date: string; // ISO date string (YYYY-MM-DD)
  category: Category;
  project: string;
  task: string;
  hours: number;
  status?: string;
  notes?: string;
}

export interface LogEntryCreate {
  date: string;
  category: Category;
  project: string;
  task: string;
  hours: number;
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
}

export interface LogEntryEditorProps {
  entry?: LogEntry;
  date: string;
  onSave: (payload: LogEntryCreate) => void;
  onCancel: () => void;
}
