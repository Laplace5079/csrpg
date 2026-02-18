/**
 * systems/npc/index.ts - NPC 系统导出
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

export { NPCManager } from './NPCManager';
export type { NPC, NPCData, NPCBehavior, InteractionResult } from './NPCManager';

export { DialogueSystem } from './DialogueSystem';
export type { Dialogue, DialogueNode, DialogueLine, DialogueChoice, DialogueDisplayData } from './DialogueSystem';

export { QuestSystem } from './QuestSystem';
export type { Quest, QuestData, QuestObjective, QuestReward, QuestStatus } from './QuestSystem';
