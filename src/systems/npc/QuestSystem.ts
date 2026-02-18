/**
 * QuestSystem.ts - 任务系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 任务追踪、完成条件
 */

import { GameEvent, Core } from '../../core';

// ============== 任务目标 ==============
export interface QuestObjective {
  id: string;
  description: string;
  type: 'eliminate' | 'reach' | 'collect' | 'talk' | 'custom';
  target?: string;
  requiredCount: number;
  currentCount: number;
  isOptional: boolean;
}

// ============== 任务数据 ==============
export interface QuestData {
  id: string;
  name: string;
  description: string;
  giver: string;
  rewards: QuestReward;
  objectives: QuestObjective[];
  prerequisites?: string[];
  nextQuest?: string;
}

// ============== 任务奖励 ==============
export interface QuestReward {
  experience: number;
  currency?: number;
  items?: string[];
}

// ============== 任务状态 ==============
export enum QuestStatus {
  LOCKED = 'locked',
  AVAILABLE = 'available',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ============== 任务实例 ==============
export class Quest {
  public id: string;
  public name: string;
  public description: string;
  public giver: string;
  public rewards: QuestReward;
  public objectives: QuestObjective[];
  
  public status: QuestStatus = QuestStatus.LOCKED;
  public startTime: number = 0;
  
  constructor(data: QuestData) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.giver = data.giver;
    this.rewards = data.rewards;
    this.objectives = data.objectives.map(o => ({ ...o }));
  }
  
  // ============== 检查完成 ==============
  public isComplete(): boolean {
    return this.objectives.every(o => o.currentCount >= o.requiredCount);
  }
  
  // ============== 获取进度文本 ==============
  public getProgressText(): string {
    return this.objectives
      .filter(o => !o.isOptional)
      .map(o => `${o.description}: ${o.currentCount}/${o.requiredCount}`)
      .join('\n');
  }
  
  // ============== 获取总体进度 ==============
  public getProgressRatio(): number {
    const total = this.objectives.filter(o => !o.isOptional).reduce((sum, o) => sum + o.requiredCount, 0);
    const current = this.objectives.reduce((sum, o) => sum + Math.min(o.currentCount, o.requiredCount), 0);
    return total > 0 ? current / total : 0;
  }
}

// ============== 任务系统 ==============
export class QuestSystem {
  private core: Core;
  
  // 任务列表
  private quests: Map<string, Quest> = new Map();
  private activeQuests: Set<string> = new Set();
  private completedQuests: Set<string> = new Set();
  
  // 任务缓存
  private questDataCache: Map<string, QuestData> = new Map();
  
  constructor() {
    this.core = Core.getInstance();
  }
  
  // ============== 接受任务 ==============
  public acceptQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest) {
      console.error(`[QuestSystem] 未找到任务: ${questId}`);
      return false;
    }
    
    if (quest.status !== QuestStatus.AVAILABLE) {
      console.warn(`[QuestSystem] 任务不可接受: ${questId}, 状态: ${quest.status}`);
      return false;
    }
    
    quest.status = QuestStatus.ACTIVE;
    quest.startTime = Date.now();
    this.activeQuests.add(questId);
    
    // 发出任务开始事件
    this.core.eventBus.emit(GameEvent.QUEST_STARTED, {
      questId,
      questName: quest.name,
    });
    
    console.log(`[QuestSystem] 接受任务: ${quest.name}`);
    return true;
  }
  
  // ============== 完成任务 ==============
  public completeQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QuestStatus.ACTIVE) {
      return false;
    }
    
    if (!quest.isComplete()) {
      console.warn(`[QuestSystem] 任务未完成: ${questId}`);
      return false;
    }
    
    quest.status = QuestStatus.COMPLETED;
    this.activeQuests.delete(questId);
    this.completedQuests.add(questId);
    
    // 发放奖励
    this.giveRewards(quest.rewards);
    
    // 解锁后续任务
    if (quest.rewards.nextQuest) {
      this.unlockQuest(quest.rewards.nextQuest);
    }
    
    // 发出任务完成事件
    this.core.eventBus.emit(GameEvent.QUEST_COMPLETED, {
      questId,
      questName: quest.name,
      rewards: quest.rewards,
    });
    
    console.log(`[QuestSystem] 完成任务: ${quest.name}`);
    return true;
  }
  
  // ============== 失败任务 ==============
  public failQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QuestStatus.ACTIVE) {
      return false;
    }
    
    quest.status = QuestStatus.FAILED;
    this.activeQuests.delete(questId);
    
    // 发出任务失败事件
    this.core.eventBus.emit(GameEvent.QUEST_FAILED, {
      questId,
      questName: quest.name,
    });
    
    console.log(`[QuestSystem] 任务失败: ${quest.name}`);
    return true;
  }
  
  // ============== 更新目标进度 ==============
  public updateObjective(questId: string, objectiveId: string, amount: number = 1): void {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QuestStatus.ACTIVE) return;
    
    const objective = quest.objectives.find(o => o.id === objectiveId);
    if (!objective) return;
    
    objective.currentCount = Math.min(objective.requiredCount, objective.currentCount + amount);
    
    // 检查是否完成
    if (quest.isComplete()) {
      this.completeQuest(questId);
    } else {
      // 发出进度更新事件
      this.core.eventBus.emit(GameEvent.QUEST_UPDATED, {
        questId,
        objectiveId,
        progress: quest.getProgressRatio(),
      });
    }
  }
  
  // ============== 获取任务 ==============
  public getQuest(questId: string): Quest | undefined {
    return this.quests.get(questId);
  }
  
  // ============== 获取可用任务 ==============
  public getAvailableQuests(): Quest[] {
    return Array.from(this.quests.values()).filter(q => q.status === QuestStatus.AVAILABLE);
  }
  
  // ============== 获取活动任务 ==============
  public getActiveQuests(): Quest[] {
    return Array.from(this.quests.values()).filter(q => q.status === QuestStatus.ACTIVE);
  }
  
  // ============== 获取已完成任务 ==============
  public getCompletedQuests(): Quest[] {
    return Array.from(this.quests.values()).filter(q => q.status === QuestStatus.COMPLETED);
  }
  
  // ============== 解锁任务 ==============
  private unlockQuest(questId: string): void {
    const quest = this.quests.get(questId);
    if (!quest) return;
    
    // 检查前置任务
    if (quest.status === QuestStatus.LOCKED) {
      // 检查前置是否完成
      // TODO: 实现前置检查
      quest.status = QuestStatus.AVAILABLE;
    }
  }
  
  // ============== 发放奖励 ==============
  private giveRewards(rewards: QuestReward): void {
    // 经验
    if (rewards.experience > 0) {
      this.core.addExperience(rewards.experience);
    }
    
    // 货币
    if (rewards.currency && rewards.currency > 0) {
      // TODO: 添加货币
    }
    
    // 物品
    if (rewards.items && rewards.items.length > 0) {
      // TODO: 添加物品
    }
  }
  
  // ============== 注册任务 ==============
  public registerQuest(data: QuestData): void {
    // 检查前置
    let status = QuestStatus.LOCKED;
    
    if (!data.prerequisites || data.prerequisites.length === 0) {
      status = QuestStatus.AVAILABLE;
    }
    
    const quest = new Quest(data);
    quest.status = status;
    this.quests.set(quest.id, quest);
    
    console.log(`[QuestSystem] 注册任务: ${quest.name} (${status})`);
  }
  
  // ============== 批量注册 ==============
  public registerQuests(questsData: QuestData[]): void {
    questsData.forEach(data => this.registerQuest(data));
  }
  
  // ============== 预加载 ==============
  public preload(questsData: QuestData[]): void {
    questsData.forEach(data => {
      this.questDataCache.set(data.id, data);
    });
    
    // 实例化任务
    questsData.forEach(data => {
      const quest = new Quest(data);
      this.quests.set(quest.id, quest);
    });
    
    // 解锁初始任务
    this.quests.forEach(quest => {
      if (quest.status === QuestStatus.LOCKED) {
        this.unlockQuest(quest.id);
      }
    });
    
    console.log(`[QuestSystem] 预加载 ${questsData.length} 个任务`);
  }
}

export default QuestSystem;
