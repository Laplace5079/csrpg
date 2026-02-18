/**
 * DialogueSystem.ts - 对话系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 * JSON 驱动对话树
 */

import { GameEvent, Core } from '../../core';

// ============== 对话数据 ==============
export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  emotion?: string;
  audio?: string;
}

export interface DialogueChoice {
  text: string;
  nextId: string;
  condition?: string;
  action?: string;
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  nextId?: string; // 无分支时自动跳转
  onEnter?: string;
  onExit?: string;
}

export interface Dialogue {
  id: string;
  nodes: Record<string, DialogueNode>;
  startNode: string;
}

// ============== 对话系统 ==============
export class DialogueSystem {
  private core: Core;
  
  // 当前对话
  private currentDialogue: Dialogue | null = null;
  private currentNodeId: string | null = null;
  private isActive: boolean = false;
  
  // 对话缓存
  private dialogueCache: Map<string, Dialogue> = new Map();
  
  constructor() {
    this.core = Core.getInstance();
  }
  
  // ============== 开始对话 ==============
  public startDialogue(dialogueId: string): void {
    const dialogue = this.getDialogue(dialogueId);
    if (!dialogue) {
      console.error(`[DialogueSystem] 未找到对话: ${dialogueId}`);
      return;
    }
    
    this.currentDialogue = dialogue;
    this.currentNodeId = dialogue.startNode;
    this.isActive = true;
    
    // 执行节点进入动作
    this.executeNodeAction('onEnter');
    
    // 发出对话开始事件
    this.core.eventBus.emit(GameEvent.DIALOG_START, {
      dialogueId,
      speaker: this.getCurrentSpeaker(),
    });
    
    console.log(`[DialogueSystem] 开始对话: ${dialogueId}`);
  }
  
  // ============== 继续对话 ==============
  public continue(choiceIndex?: number): DialogueDisplayData | null {
    if (!this.currentDialogue || !this.currentNodeId) return null;
    
    const node = this.currentDialogue.nodes[this.currentNodeId];
    
    // 处理选项
    if (node.choices && choiceIndex !== undefined) {
      const choice = node.choices[choiceIndex];
      if (choice) {
        // 检查条件
        if (choice.condition && !this.checkCondition(choice.condition)) {
          return this.continue(); // 跳过无效选项
        }
        
        // 执行动作
        if (choice.action) {
          this.executeAction(choice.action);
        }
        
        // 跳转
        this.currentNodeId = choice.nextId;
      }
    } else if (node.nextId) {
      // 自动跳转
      this.currentNodeId = node.nextId;
    } else {
      // 对话结束
      this.endDialogue();
      return null;
    }
    
    // 执行节点进入动作
    this.executeNodeAction('onEnter');
    
    return this.getCurrentDisplayData();
  }
  
  // ============== 结束对话 ==============
  public endDialogue(): void {
    if (!this.isActive) return;
    
    // 执行节点退出动作
    this.executeNodeAction('onExit');
    
    const dialogueId = this.currentDialogue?.id;
    
    this.currentDialogue = null;
    this.currentNodeId = null;
    this.isActive = false;
    
    // 发出对话结束事件
    this.core.eventBus.emit(GameEvent.DIALOG_END, { dialogueId });
    
    console.log('[DialogueSystem] 对话结束');
  }
  
  // ============== 获取当前显示数据 ==============
  public getCurrentDisplayData(): DialogueDisplayData | null {
    if (!this.currentDialogue || !this.currentNodeId) return null;
    
    const node = this.currentDialogue.nodes[this.currentNodeId];
    if (!node) return null;
    
    return {
      dialogueId: this.currentDialogue.id,
      nodeId: this.currentNodeId,
      lines: node.lines,
      choices: node.choices?.map(c => c.text) || [],
      speaker: this.getCurrentSpeaker(),
    };
  }
  
  // ============== 获取当前说话者 ==============
  private getCurrentSpeaker(): string {
    if (!this.currentDialogue || !this.currentNodeId) return '';
    
    const node = this.currentDialogue.nodes[this.currentNodeId];
    return node.lines[0]?.speaker || '';
  }
  
  // ============== 检查条件 ==============
  private checkCondition(condition: string): boolean {
    // 简单条件解析
    // 格式: "player.level >= 5" 或 "quest.completed_1 == true"
    
    try {
      // 这里应该解析并检查实际条件
      // 暂时返回 true
      return true;
    } catch {
      return false;
    }
  }
  
  // ============== 执行动作 ==============
  private executeAction(action: string): void {
    console.log(`[DialogueSystem] 执行动作: ${action}`);
    // 解析并执行动作，如: give_item, start_quest, etc.
  }
  
  // ============== 执行节点动作 ==============
  private executeNodeAction(actionType: 'onEnter' | 'onExit'): void {
    if (!this.currentDialogue || !this.currentNodeId) return;
    
    const node = this.currentDialogue.nodes[this.currentNodeId];
    const action = node[actionType];
    
    if (action) {
      this.executeAction(action);
    }
  }
  
  // ============== 获取对话 ==============
  private getDialogue(dialogueId: string): Dialogue | null {
    // 优先从缓存获取
    if (this.dialogueCache.has(dialogueId)) {
      return this.dialogueCache.get(dialogueId)!;
    }
    
    // 从 JSON 加载
    // TODO: 从 dialogue.json 加载
    return null;
  }
  
  // ============== 预加载对话 ==============
  public preloadDialogues(dialogues: Dialogue[]): void {
    dialogues.forEach(d => {
      this.dialogueCache.set(d.id, d);
    });
    console.log(`[DialogueSystem] 预加载 ${dialogues.length} 个对话`);
  }
  
  // ============== 状态 ==============
  public isActiveDialogue(): boolean {
    return this.isActive;
  }
  
  public isDialogueActive(): boolean {
    return this.isActive;
  }
}

// ============== 对话显示数据 ==============
export interface DialogueDisplayData {
  dialogueId: string;
  nodeId: string;
  lines: DialogueLine[];
  choices: string[];
  speaker: string;
}

export default DialogueSystem;
