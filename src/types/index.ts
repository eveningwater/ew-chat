// 定义聊天消息类型
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  file?: FileData;
}

// 定义文件数据类型
export interface FileData {
  name: string;
  type: string;
  content: string;
}

// 定义聊天会话类型
export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

// 定义主题类型
export type Theme = "light" | "dark";

// 定义语言类型
export type Language = "en" | "zh";

// 定义翻译字典类型
export interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

// 定义应用状态类型
export interface AppState {
  chats: Record<string, Chat>;
  currentChatId: string | null;
  theme: Theme;
  language: Language;
}
