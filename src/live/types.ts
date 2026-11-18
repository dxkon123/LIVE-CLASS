// Data that server.ts sends down over SSE. Shared by every game.

export interface LiveStatus {
  isConnected: boolean;
  isConnecting: boolean;
  username: string;
  roomId: string;
  viewerCount: number;
  totalLikes: number;
  error?: string;
}

export interface ChatEvent {
  username: string;
  nickname: string;
  comment: string;
  avatar: string;
  timestamp: number;
  createTime?: number; // TikTok timestamp (ms); missing when TikTok leaves it out
  test?: boolean; // simulated event from a test button on the control page (not real TikTok)
}

export interface GiftEvent {
  username: string;
  nickname: string;
  giftName: string;
  giftId: number;
  diamondCount: number; // coins per item
  repeatCount: number; // NEW items in this event (the server already removed the earlier part of a combo)
  avatar: string;
  timestamp: number;
}

export interface UserEvent {
  username: string;
  nickname: string;
  avatar: string;
  timestamp: number;
}

export interface LikeEvent {
  username: string;
  nickname: string;
  likeCount: number;
  totalLikes: number; // total hearts in the room
}

export interface ControlCommand {
  action: 'speak' | 'setRate' | 'reset' | 'setName' | 'custom';
  text?: string;
}

export interface LiveHandlers {
  onStatus?: (s: LiveStatus) => void;
  onChat?: (e: ChatEvent) => void;
  onGift?: (e: GiftEvent) => void;
  onMember?: (e: UserEvent) => void; // someone new joined the room
  onFollow?: (e: UserEvent) => void;
  onShare?: (e: UserEvent) => void;
  onLike?: (e: LikeEvent) => void;
  onViewers?: (count: number) => void;
  onRoomCfg?: (cfg: Record<string, unknown>) => void; // class settings changed on the control page
  onControl?: (c: ControlCommand) => void;
  onGameState?: (s: any) => void; // game snapshot from the stage page
  onSpeaker?: (d: { id: string | null; count: number }) => void; // which stage page currently plays sound
}
