/**
 * SaveSystem.ts - 存档与读取系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

import { GAME_CONFIG } from './Core';

export interface SaveData {
  player: any;
  progress: any;
  timestamp: number;
  version: string;
}

export interface SaveSlot {
  slot: number;
  data: SaveData | null;
  timestamp: number;
}

// ============== 存档系统 ==============
export class SaveSystem {
  private storageKey: string = 'ink_realm_save_';
  private maxSlots: number = GAME_CONFIG.MAX_SAVE_SLOTS;
  
  constructor() {
    console.log('[SaveSystem] 初始化存档系统');
  }
  
  // ============== 存档 ==============
  public save(slot: number, data: any): boolean {
    try {
      const saveData: SaveData = {
        player: data.player,
        progress: data.progress,
        timestamp: data.timestamp || Date.now(),
        version: '1.0.0',
      };
      
      const key = this.getSlotKey(slot);
      localStorage.setItem(key, JSON.stringify(saveData));
      
      console.log(`[SaveSystem] 存档已保存: 槽位 ${slot}`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] 存档失败:', error);
      return false;
    }
  }
  
  // ============== 读取 ==============
  public load(slot: number): SaveData | null {
    try {
      const key = this.getSlotKey(slot);
      const data = localStorage.getItem(key);
      
      if (!data) {
        console.log(`[SaveSystem] 槽位 ${slot} 无存档`);
        return null;
      }
      
      const saveData: SaveData = JSON.parse(data);
      console.log(`[SaveSystem] 读取存档: 槽位 ${slot}`, new Date(saveData.timestamp));
      return saveData;
    } catch (error) {
      console.error('[SaveSystem] 读取失败:', error);
      return null;
    }
  }
  
  // ============== 自动加载 ==============
  public autoLoad(): SaveData | null {
    // 尝试从槽位 0 自动加载
    return this.load(0);
  }
  
  // ============== 删除 ==============
  public delete(slot: number): boolean {
    try {
      const key = this.getSlotKey(slot);
      localStorage.removeItem(key);
      console.log(`[SaveSystem] 已删除: 槽位 ${slot}`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] 删除失败:', error);
      return false;
    }
  }
  
  // ============== 列出所有存档 ==============
  public listSaves(): SaveSlot[] {
    const slots: SaveSlot[] = [];
    
    for (let i = 0; i < this.maxSlots; i++) {
      const data = this.load(i);
      slots.push({
        slot: i,
        data,
        timestamp: data?.timestamp || 0,
      });
    }
    
    return slots;
  }
  
  // ============== 云同步 (预留) ==============
  public async cloudSync(): Promise<boolean> {
    // 预留云同步接口
    console.log('[SaveSystem] 云同步功能预留');
    return false;
  }
  
  // ============== 工具 ==============
  private getSlotKey(slot: number): string {
    return `${this.storageKey}slot_${slot}`;
  }
  
  public hasSave(slot: number): boolean {
    const key = this.getSlotKey(slot);
    return localStorage.getItem(key) !== null;
  }
  
  public getSaveInfo(slot: number): { timestamp: number; version: string } | null {
    const data = this.load(slot);
    if (!data) return null;
    
    return {
      timestamp: data.timestamp,
      version: data.version,
    };
  }
}

export default SaveSystem;
