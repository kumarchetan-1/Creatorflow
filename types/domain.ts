export type IntentType =
  | "create_contact"
  | "log_deal"
  | "set_follow_up"
  | "query_insights"
  | "unknown";

export type ParsedIntent = {
  intent: IntentType;
  confidence: number;
  entities: {
    brandName?: string;
    dealName?: string;
    amount?: number;
    status?: "lead" | "pitched" | "negotiating" | "won" | "lost";
    dueDate?: string;
    note?: string;
    query?: string;
  };
};

export type ActionResult = {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
};

export type TimelineItem = {
  id: string;
  action_type: string;
  summary: string;
  created_at: string;
};
