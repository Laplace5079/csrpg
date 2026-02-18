/**
 * EventBus.ts - 事件总线系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

// ============== 游戏事件类型 ==============
export enum GameEvent {
  // 核心
  CORE_INITIALIZED = 'core:initialized',
  FRAME_UPDATE = 'game:frame_update',
  
  // 游戏流程
  GAME_STARTED = 'game:started',
  GAME_SAVED = 'game:saved',
  GAME_LOADED = 'game:loaded',
  GAME_PAUSED = 'game:paused',
  GAME_RESUMED = 'game:resumed',
  GAME_QUIT = 'game:quit',
  
  // 玩家
  PLAYER_MOVED = 'player:moved',
  PLAYER_ROTATED = 'player:rotated',
  PLAYER_DAMAGED = 'player:damaged',
  PLAYER_HEALED = 'player:healed',
  PLAYER_DEATH = 'player:death',
  EXPERIENCE_GAINED = 'player:experience',
  LEVEL_UP = 'player:level_up',
  
  // 武器
  WEAPON_FIRED = 'weapon:fired',
  WEAPON_RELOADED = 'weapon:reloaded',
  WEAPON_SWITCHED = 'weapon:switched',
  AMMO_CHANGED = 'weapon:ammo_changed',
  
  // 敌人
  ENEMY_SPAWNED = 'enemy:spawned',
  ENEMY_DAMAGED = 'enemy:damaged',
  ENEMY_KILLED = 'enemy:killed',
  ENEMY_ALERTED = 'enemy:alerted',
  
  // BOSS
  BOSS_SPAWNED = 'boss:spawned',
  BOSS_PHASE_CHANGED = 'boss:phase_changed',
  BOSS_DEFEATED = 'boss:defeated',
  
  // 关卡
  LEVEL_LOADING = 'level:loading',
  LEVEL_LOADED = 'level:loaded',
  LEVEL_COMPLETED = 'level:completed',
  CHECKPOINT_REACHED = 'level:checkpoint',
  
  // 任务
  QUEST_STARTED = 'quest:started',
  QUEST_UPDATED = 'quest:updated',
  QUEST_COMPLETED = 'quest:completed',
  QUEST_FAILED = 'quest:failed',
  
  // NPC
  NPC_INTERACT = 'npc:interact',
  DIALOG_START = 'dialog:start',
  DIALOG_END = 'dialog:end',
  
  // UI
  UI_NOTIFICATION = 'ui:notification',
  UI_DAMAGE_NUMBER = 'ui:damage_number',
  UI_QUEST_UPDATE = 'ui:quest_update',
  
  // 物理
  PHYSICS_COLLISION = 'physics:collision',
  
  // 音效
  AUDIO_PLAY = 'audio:play',
  AUDIO_STOP = 'audio:stop',
  
  // 错误
  ERROR = 'error',
}

// ============== 事件监听器 ==============
type EventListener = (data?: any) => void;

// ============== 事件总线类 ==============
export class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private onceListeners: Map<string, Set<EventListener>> = new Map();
  
  // 事件统计
  private eventCount: Map<string, number> = new Map();
  
  constructor() {
    console.log('[EventBus] 初始化事件总线');
  }
  
  // ============== 监听 ==============
  public on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }
  
  public once(event: string, listener: EventListener): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(listener);
  }
  
  // ============== 发射 ==============
  public emit(event: string, data?: any): void {
    // 统计
    this.eventCount.set(event, (this.eventCount.get(event) || 0) + 1);
    
    // 触发一次性监听器
    if (this.onceListeners.has(event)) {
      const onceSet = this.onceListeners.get(event)!;
      onceSet.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[EventBus] 事件 ${event} 监听器错误:`, error);
        }
      });
      this.onceListeners.delete(event);
    }
    
    // 触发持久监听器
    if (this.listeners.has(event)) {
      const listenerSet = this.listeners.get(event)!;
      listenerSet.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[EventBus] 事件 ${event} 监听器错误:`, error);
        }
      });
    }
  }
  
  // ============== 移除 ==============
  public off(event: string, listener?: EventListener): void {
    if (!listener) {
      // 移除所有该事件的监听器
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.get(event)?.delete(listener);
      this.onceListeners.get(event)?.delete(listener);
    }
  }
  
  // ============== 清除 ==============
  public clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }
  
  public clearEvent(event: string): void {
    this.listeners.delete(event);
    this.onceListeners.delete(event);
  }
  
  // ============== 调试 ==============
  public getListenerCount(event: string): number {
    const persistent = this.listeners.get(event)?.size || 0;
    const once = this.onceListeners.get(event)?.size || 0;
    return persistent + once;
  }
  
  public getEventCount(event: string): number {
    return this.eventCount.get(event) || 0;
  }
  
  public getAllEventCounts(): Map<string, number> {
    return new Map(this.eventCount);
  }
  
  public getActiveEvents(): string[] {
    const events: string[] = [];
    this.listeners.forEach((_, event) => events.push(event));
    this.onceListeners.forEach((_, event) => {
      if (!events.includes(event)) events.push(event);
    });
    return events;
  }
  
  // ============== 便捷方法 ==============
  public removeAllListeners(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }
}

export default EventBus;
