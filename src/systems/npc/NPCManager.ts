/**
 * NPCManager.ts - NPC 管理器
 * 墨境：孤军 (Ink Realm: Lone Army)
 * NPC 生成、对话、任务派发
 */

import * as THREE from 'three';
import { DialogueSystem } from './DialogueSystem';
import { QuestSystem } from './QuestSystem';

// ============== NPC 数据 ==============
export interface NPCData {
  id: string;
  name: string;
  model?: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  dialogueId?: string;
  questIds?: string[];
  greeting?: string;
  behavior: NPCBehavior;
}

// ============== NPC 行为 ==============
export enum NPCBehavior {
  IDLE = 'idle',
  PATROL = 'patrol',
  FOLLOW = 'follow',
  WAIT = 'wait',
}

// ============== NPC 实体 ==============
export class NPC {
  public id: string;
  public name: string;
  public position: THREE.Vector3;
  public rotation: THREE.Euler;
  
  public dialogueId?: string;
  public questIds: string[] = [];
  public greeting?: string;
  
  public behavior: NPCBehavior = NPCBehavior.IDLE;
  
  // 引用
  public mesh: THREE.Object3D | null = null;
  
  // 状态
  public isInteracting: boolean = false;
  public hasInteracted: boolean = false;
  
  constructor(data: NPCData) {
    this.id = data.id;
    this.name = data.name;
    this.position = data.position.clone();
    this.rotation = data.rotation.clone();
    this.dialogueId = data.dialogueId;
    this.questIds = data.questIds || [];
    this.greeting = data.greeting;
    this.behavior = data.behavior;
  }
  
  // ============== 交互 ==============
  public interact(): InteractionResult {
    this.isInteracting = true;
    this.hasInteracted = true;
    
    return {
      npcId: this.id,
      npcName: this.name,
      dialogueId: this.dialogueId,
      questIds: this.questIds,
      greeting: this.greeting,
    };
  }
  
  // ============== 设置 Mesh ==============
  public setMesh(mesh: THREE.Object3D): void {
    this.mesh = mesh;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
  }
  
  // ============== 更新 ==============
  public update(deltaTime: number): void {
    // NPC 行为逻辑
    if (this.mesh) {
      // 同步位置
      this.position.copy(this.mesh.position);
    }
  }
}

// ============== 交互结果 ==============
export interface InteractionResult {
  npcId: string;
  npcName: string;
  dialogueId?: string;
  questIds: string[];
  greeting?: string;
}

// ============== NPC 管理器 ==============
export class NPCManager {
  // 单例
  private static instance: NPCManager;
  public static getInstance(): NPCManager {
    if (!NPCManager.instance) {
      NPCManager.instance = new NPCManager();
    }
    return NPCManager.instance;
  }
  
  // NPC 列表
  private npcs: Map<string, NPC> = new Map();
  
  // 子系统
  private dialogueSystem: DialogueSystem;
  private questSystem: QuestSystem;
  
  // 场景引用
  private scene: THREE.Scene | null = null;
  
  // 当前交互的 NPC
  private currentNPC: NPC | null = null;
  
  constructor() {
    this.dialogueSystem = new DialogueSystem();
    this.questSystem = new QuestSystem();
  }
  
  // ============== 初始化 ==============
  public init(scene: THREE.Scene): void {
    this.scene = scene;
    console.log('[NPCManager] 初始化完成');
  }
  
  // ============== 注册 NPC ==============
  public registerNPC(data: NPCData): NPC {
    const npc = new NPC(data);
    this.npcs.set(npc.id, npc);
    
    console.log(`[NPCManager] 注册 NPC: ${npc.name}`);
    return npc;
  }
  
  // ============== 移除 NPC ==============
  public removeNPC(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (npc?.mesh && this.scene) {
      this.scene.remove(npc.mesh);
    }
    this.npcs.delete(npcId);
  }
  
  // ============== 获取 NPC ==============
  public getNPC(npcId: string): NPC | undefined {
    return this.npcs.get(npcId);
  }
  
  // ============== 获取所有 NPC ==============
  public getAllNPCs(): NPC[] {
    return Array.from(this.npcs.values());
  }
  
  // ============== 查找附近 NPC ==============
  public findNearbyNPC(position: THREE.Vector3, radius: number = 3): NPC | null {
    let closest: NPC | null = null;
    let closestDistance = radius;
    
    this.npcs.forEach(npc => {
      const distance = npc.position.distanceTo(position);
      if (distance < closestDistance) {
        closest = npc;
        closestDistance = distance;
      }
    });
    
    return closest;
  }
  
  // ============== 交互 ==============
  public interact(npcId: string): InteractionResult | null {
    const npc = this.npcs.get(npcId);
    if (!npc) return null;
    
    this.currentNPC = npc;
    return npc.interact();
  }
  
  // ============== 开始对话 ==============
  public startDialogue(dialogueId: string): void {
    this.dialogueSystem.startDialogue(dialogueId);
  }
  
  // ============== 继续对话 ==============
  public continueDialogue(choiceIndex?: number): void {
    this.dialogueSystem.continue(choiceIndex);
  }
  
  // ============== 结束对话 ==============
  public endDialogue(): void {
    this.dialogueSystem.endDialogue();
    if (this.currentNPC) {
      this.currentNPC.isInteracting = false;
      this.currentNPC = null;
    }
  }
  
  // ============== 接受任务 ==============
  public acceptQuest(questId: string): void {
    this.questSystem.acceptQuest(questId);
  }
  
  // ============== 完成任务 ==============
  public completeQuest(questId: string): void {
    this.questSystem.completeQuest(questId);
  }
  
  // ============== 更新 ==============
  public update(deltaTime: number): void {
    this.npcs.forEach(npc => {
      npc.update(deltaTime);
    });
  }
  
  // ============== 加载 NPC 数据 ==============
  public loadFromJSON(npcsData: NPCData[]): void {
    npcsData.forEach(data => {
      this.registerNPC(data);
    });
  }
  
  // ============== 调试 ==============
  public getDebugInfo(): any {
    const npcs: any[] = [];
    this.npcs.forEach(npc => {
      npcs.push({
        id: npc.id,
        name: npc.name,
        position: npc.position.toArray(),
        behavior: npc.behavior,
        hasInteracted: npc.hasInteracted,
      });
    });
    
    return {
      npcs,
      activeDialogue: this.dialogueSystem.isActive(),
      activeQuests: this.questSystem.getActiveQuests(),
    };
  }
}

export default NPCManager;
