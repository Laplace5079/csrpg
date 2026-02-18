/**
 * UIManager.ts - UI 管理器
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 统一管理所有 UI 组件
 */

import { Core, GameEvent } from '../../core';

// ============== UI 组件基类 ==============
abstract class UIComponent {
  public element: HTMLElement | null = null;
  public isVisible: boolean = true;
  
  abstract create(): HTMLElement;
  abstract update(data: any): void;
  
  public show(): void {
    if (this.element) {
      this.element.style.display = 'block';
      this.isVisible = true;
    }
  }
  
  public hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
      this.isVisible = false;
    }
  }
  
  public destroy(): void {
    if (this.element?.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// ============== HUD 主界面 ==============
class HUD extends UIComponent {
  private healthBar: HealthBar;
  private ammoDisplay: AmmoDisplay;
  private minimap: Minimap;
  private questTracker: QuestTracker;
  private damageNumbers: DamageNumbers;
  private crosshair: Crosshair;
  
  constructor() {
    super();
    this.healthBar = new HealthBar();
    this.ammoDisplay = new AmmoDisplay();
    this.minimap = new Minimap();
    this.questTracker = new QuestTracker();
    this.damageNumbers = new DamageNumbers();
    this.crosshair = new Crosshair();
  }
  
  create(): HTMLElement {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.className = 'hud-container';
    
    // 添加各组件
    hud.appendChild(this.healthBar.create());
    hud.appendChild(this.ammoDisplay.create());
    hud.appendChild(this.minimap.create());
    hud.appendChild(this.questTracker.create());
    hud.appendChild(this.damageNumbers.create());
    hud.appendChild(this.crosshair.create());
    
    this.element = hud;
    return hud;
  }
  
  update(data: any): void {
    if (data.health) this.healthBar.update(data.health);
    if (data.ammo) this.ammoDisplay.update(data.ammo);
    if (data.quest) this.questTracker.update(data.quest);
    if (data.damageNumbers) this.damageNumbers.update(data.damageNumbers);
  }
  
  showDamageNumber(damage: number, position: { x: number; y: number }, isCrit: boolean = false): void {
    this.damageNumbers.show(damage, position, isCrit);
  }
  
  updateMinimap(playerPos: { x: number; z: number }, enemies: any[], objectives: any[]): void {
    this.minimap.update(playerPos, enemies, objectives);
  }
}

// ============== 血条 ==============
class HealthBar extends UIComponent {
  private currentHealth: number = 100;
  private maxHealth: number = 100;
  private currentArmor: number = 0;
  
  create(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'health-bar-container';
    container.innerHTML = `
      <div class="health-bar">
        <div class="health-fill"></div>
        <div class="health-text">100 / 100</div>
      </div>
      <div class="armor-bar">
        <div class="armor-fill"></div>
      </div>
    `;
    this.element = container;
    return container;
  }
  
  update(data: { current: number; max: number; armor?: number }): void {
    this.currentHealth = data.current;
    this.maxHealth = data.max;
    if (data.armor !== undefined) this.currentArmor = data.armor;
    
    const healthPercent = (this.currentHealth / this.maxHealth) * 100;
    const armorPercent = (this.currentArmor / 100) * 100;
    
    const healthFill = this.element?.querySelector('.health-fill') as HTMLElement;
    const healthText = this.element?.querySelector('.health-text') as HTMLElement;
    const armorFill = this.element?.querySelector('.armor-fill') as HTMLElement;
    
    if (healthFill) healthFill.style.width = `${healthPercent}%`;
    if (healthText) healthText.textContent = `${Math.ceil(this.currentHealth)} / ${this.maxHealth}`;
    if (armorFill) armorFill.style.width = `${armorPercent}%`;
  }
}

// ============== 弹药显示 ==============
class AmmoDisplay extends UIComponent {
  private currentAmmo: number = 12;
  private totalAmmo: number = 48;
  private weaponName: string = '量子手枪';
  
  create(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ammo-display';
    container.innerHTML = `
      <div class="weapon-name">量子手枪</div>
      <div class="ammo-count"><span class="current">12</span> / <span class="total">48</span></div>
    `;
    this.element = container;
    return container;
  }
  
  update(data: { current: number; total: number; weapon?: string }): void {
    this.currentAmmo = data.current;
    this.totalAmmo = data.total;
    if (data.weapon) this.weaponName = data.weapon;
    
    const currentEl = this.element?.querySelector('.current') as HTMLElement;
    const totalEl = this.element?.querySelector('.total') as HTMLElement;
    const weaponEl = this.element?.querySelector('.weapon-name') as HTMLElement;
    
    if (currentEl) currentEl.textContent = String(this.currentAmmo);
    if (totalEl) totalEl.textContent = String(this.totalAmmo);
    if (weaponEl) weaponEl.textContent = this.weaponName;
  }
}

// ============== 小地图 ==============
class Minimap extends UIComponent {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private radius: number = 150;
  private scale: number = 2;
  
  create(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'minimap-container';
    
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.radius * 2;
    this.canvas.height = this.radius * 2;
    this.ctx = this.canvas.getContext('2d');
    
    container.appendChild(this.canvas);
    this.element = container;
    return container;
  }
  
  update(playerPos: { x: number; z: number }, enemies: any[], objectives: any[]): void {
    if (!this.ctx || !this.canvas) return;
    
    const ctx = this.ctx;
    const centerX = this.radius;
    const centerY = this.radius;
    
    // 清空
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.radius - 2, 0, Math.PI * 2);
    ctx.fill();
    
    // 边框
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 玩家 (中心)
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 8);
    ctx.lineTo(centerX - 6, centerY + 6);
    ctx.lineTo(centerX + 6, centerY + 6);
    ctx.closePath();
    ctx.fill();
    
    // 敌人 (红色点)
    enemies.forEach(enemy => {
      const dx = (enemy.x - playerPos.x) * this.scale;
      const dz = (enemy.z - playerPos.z) * this.scale;
      
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < this.radius - 10) {
        const ex = centerX + dx;
        const ey = centerY + dz;
        
        ctx!.fillStyle = '#ff0000';
        ctx!.beginPath();
        ctx!.arc(ex, ey, 4, 0, Math.PI * 2);
        ctx!.fill();
      }
    });
    
    // 目标 (黄色点)
    objectives.forEach(obj => {
      const dx = (obj.x - playerPos.x) * this.scale;
      const dz = (obj.z - playerPos.z) * this.scale;
      
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < this.radius - 10) {
        const ox = centerX + dx;
        const oy = centerY + dz;
        
        ctx!.fillStyle = '#ffff00';
        ctx!.beginPath();
        ctx!.rect(ox - 4, oy - 4, 8, 8);
        ctx!.fill();
      }
    });
  }
}

// ============== 任务追踪 ==============
class QuestTracker extends UIComponent {
  private currentQuest: string = '';
  private objectives: string[] = [];
  
  create(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'quest-tracker';
    container.innerHTML = `
      <div class="quest-title"></div>
      <div class="quest-objectives"></div>
    `;
    this.element = container;
    return container;
  }
  
  update(data: { title?: string; objectives?: string[] }): void {
    if (data.title) this.currentQuest = data.title;
    if (data.objectives) this.objectives = data.objectives;
    
    const titleEl = this.element?.querySelector('.quest-title') as HTMLElement;
    const objectivesEl = this.element?.querySelector('.quest-objectives') as HTMLElement;
    
    if (titleEl) titleEl.textContent = this.currentQuest;
    if (objectivesEl) objectivesEl.innerHTML = this.objectives.map(o => `<div>• ${o}</div>`).join('');
  }
}

// ============== 伤害飘字 ==============
class DamageNumbers extends UIComponent {
  private container: HTMLElement | null = null;
  
  create(): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'damage-numbers-container';
    this.element = this.container;
    return this.container;
  }
  
  show(damage: number, position: { x: number; y: number }, isCrit: boolean): void {
    if (!this.container) return;
    
    const damageEl = document.createElement('div');
    damageEl.className = `damage-number ${isCrit ? 'crit' : ''}`;
    damageEl.textContent = String(Math.floor(damage));
    damageEl.style.left = `${position.x}px`;
    damageEl.style.top = `${position.y}px`;
    
    this.container.appendChild(damageEl);
    
    // 动画结束后移除
    setTimeout(() => {
      damageEl.remove();
    }, 1500);
  }
  
  update(data: any): void {
    // 批量处理
  }
}

// ============== 准星 ==============
class Crosshair extends UIComponent {
  create(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'crosshair';
    container.innerHTML = `
      <div class="crosshair-line top"></div>
      <div class="crosshair-line bottom"></div>
      <div class="crosshair-line left"></div>
      <div class="crosshair-line right"></div>
      <div class="crosshair-dot"></div>
    `;
    this.element = container;
    return container;
  }
  
  update(data: any): void {
    // 动态调整
    if (data.spread) {
      const spread = data.spread * 10;
      const lines = this.element?.querySelectorAll('.crosshair-line') as NodeListOf<HTMLElement>;
      lines.forEach(line => {
        if (line.classList.contains('top')) line.style.bottom = `${30 + spread}px`;
        if (line.classList.contains('bottom')) line.style.top = `${30 + spread}px`;
        if (line.classList.contains('left')) line.style.right = `${30 + spread}px`;
        if (line.classList.contains('right')) line.style.left = `${30 + spread}px`;
      });
    }
  }
}

// ============== UI 管理器 ==============
export class UIManager {
  private static instance: UIManager;
  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }
  
  private core: Core;
  private hud: HUD | null = null;
  private pauseMenu: HTMLElement | null = null;
  private inventoryUI: HTMLElement | null = null;
  
  private isInventoryOpen: boolean = false;
  
  constructor() {
    this.core = Core.getInstance();
  }
  
  // ============== 初始化 ==============
  public init(): void {
    console.log('[UIManager] 初始化');
    
    // 创建 HUD
    this.hud = new HUD();
    document.getElementById('game-container')?.appendChild(this.hud.create());
    
    // 创建暂停菜单
    this.createPauseMenu();
    
    // 创建物品栏
    this.createInventoryUI();
    
    // 添加样式
    this.addStyles();
    
    // 监听事件
    this.setupEventListeners();
    
    console.log('[UIManager] 初始化完成');
  }
  
  // ============== 创建暂停菜单 ==============
  private createPauseMenu(): void {
    this.pauseMenu = document.createElement('div');
    this.pauseMenu.id = 'pause-menu';
    this.pauseMenu.className = 'pause-menu';
    this.pauseMenu.innerHTML = `
      <div class="pause-title">已暂停</div>
      <button class="resume-btn">继续游戏</button>
      <button class="save-btn">保存游戏</button>
      <button class="load-btn">加载存档</button>
      <button class="settings-btn">设置</button>
      <button class="quit-btn">退出</button>
    `;
    this.pauseMenu.style.display = 'none';
    document.getElementById('game-container')?.appendChild(this.pauseMenu);
  }
  
  // ============== 创建物品栏 ==============
  private createInventoryUI(): void {
    this.inventoryUI = document.createElement('div');
    this.inventoryUI.id = 'inventory-ui';
    this.inventoryUI.className = 'inventory-ui';
    this.inventoryUI.innerHTML = `
      <div class="inventory-title">物品栏</div>
      <div class="inventory-grid"></div>
    `;
    this.inventoryUI.style.display = 'none';
    document.getElementById('game-container')?.appendChild(this.inventoryUI);
  }
  
  // ============== 添加样式 ==============
  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      /* HUD 容器 */
      .hud-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
      }
      
      /* 血条 */
      .health-bar-container {
        position: absolute;
        bottom: 30px;
        left: 30px;
        width: 300px;
      }
      .health-bar, .armor-bar {
        height: 20px;
        background: rgba(0, 0, 0, 0.6);
        border: 2px solid #00ffff;
        border-radius: 4px;
        margin-bottom: 5px;
        position: relative;
        overflow: hidden;
      }
      .health-fill {
        height: 100%;
        background: linear-gradient(90deg, #00ff00, #88ff00);
        transition: width 0.2s;
      }
      .armor-fill {
        height: 100%;
        background: linear-gradient(90deg, #0088ff, #00ccff);
        transition: width 0.2s;
      }
      .health-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #fff;
        font-size: 12px;
        font-weight: bold;
        text-shadow: 1px 1px 2px #000;
      }
      
      /* 弹药显示 */
      .ammo-display {
        position: absolute;
        bottom: 30px;
        right: 30px;
        text-align: right;
        color: #fff;
      }
      .weapon-name {
        font-size: 18px;
        color: #00ffff;
        margin-bottom: 5px;
      }
      .ammo-count {
        font-size: 36px;
        font-weight: bold;
      }
      .ammo-count .current {
        color: #00ffff;
      }
      .ammo-count .total {
        color: #888;
        font-size: 24px;
      }
      
      /* 小地图 */
      .minimap-container {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 300px;
        height: 300px;
      }
      
      /* 任务追踪 */
      .quest-tracker {
        position: absolute;
        top: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid #00ffff;
        border-radius: 8px;
        padding: 15px;
        color: #fff;
        max-width: 250px;
      }
      .quest-title {
        font-size: 16px;
        color: #ffff00;
        margin-bottom: 10px;
      }
      .quest-objectives {
        font-size: 14px;
        color: #ccc;
      }
      
      /* 伤害飘字 */
      .damage-numbers-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 200;
      }
      .damage-number {
        position: absolute;
        color: #ff0000;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 2px 2px 0 #000;
        animation: damageFloat 1.5s ease-out forwards;
      }
      .damage-number.crit {
        color: #ffaa00;
        font-size: 36px;
      }
      @keyframes damageFloat {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-50px) scale(0.5); }
      }
      
      /* 准星 */
      .crosshair {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .crosshair-line {
        position: absolute;
        background: #00ffff;
      }
      .crosshair-line.top, .crosshair-line.bottom {
        width: 2px;
        height: 15px;
        left: 50%;
        transform: translateX(-50%);
      }
      .crosshair-line.top { bottom: 30px; }
      .crosshair-line.bottom { top: 30px; }
      .crosshair-line.left, .crosshair-line.right {
        width: 15px;
        height: 2px;
        top: 50%;
        transform: translateY(-50%);
      }
      .crosshair-line.left { right: 30px; }
      .crosshair-line.right { left: 30px; }
      .crosshair-dot {
        position: absolute;
        width: 4px;
        height: 4px;
        background: #00ffff;
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      
      /* 暂停菜单 */
      .pause-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 500;
      }
      .pause-title {
        font-size: 48px;
        color: #00ffff;
        margin-bottom: 30px;
      }
      .pause-menu button {
        width: 200px;
        padding: 15px;
        margin: 10px;
        font-size: 18px;
        background: transparent;
        border: 2px solid #00ffff;
        color: #00ffff;
        cursor: pointer;
        transition: all 0.3s;
      }
      .pause-menu button:hover {
        background: #00ffff;
        color: #000;
      }
      
      /* 物品栏 */
      .inventory-ui {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #00ffff;
        border-radius: 10px;
        padding: 20px;
        z-index: 400;
      }
      .inventory-title {
        font-size: 24px;
        color: #00ffff;
        margin-bottom: 20px;
        text-align: center;
      }
      .inventory-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
      }
    `;
    document.head.appendChild(style);
  }
  
  // ============== 事件监听 ==============
  private setupEventListeners(): void {
    // 玩家伤害
    this.core.eventBus.on(GameEvent.PLAYER_DAMAGED, (data: any) => {
      this.hud?.showDamageNumber(data.amount, { x: window.innerWidth / 2, y: window.innerHeight / 2 }, false);
    });
    
    // 玩家升级
    this.core.eventBus.on(GameEvent.LEVEL_UP, (level: number) => {
      this.showNotification(`升级到 ${level} 级!`);
    });
  }
  
  // ============== 切换暂停菜单 ==============
  public togglePauseMenu(): void {
    if (!this.pauseMenu) return;
    
    if (this.pauseMenu.style.display === 'none') {
      this.pauseMenu.style.display = 'flex';
    } else {
      this.pauseMenu.style.display = 'none';
    }
  }
  
  // ============== 切换物品栏 ==============
  public toggleInventory(): void {
    if (!this.inventoryUI) return;
    
    this.isInventoryOpen = !this.isInventoryOpen;
    this.inventoryUI.style.display = this.isInventoryOpen ? 'block' : 'none';
  }
  
  // ============== 显示通知 ==============
  public showNotification(message: string): void {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(90deg, #ff00ff, #00ffff);
      color: white;
      padding: 15px 30px;
      border-radius: 8px;
      font-size: 24px;
      font-weight: bold;
      z-index: 1000;
      animation: fadeOut 2s forwards;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 2000);
  }
  
  // ============== 更新 ==============
  public update(data: any): void {
    this.hud?.update(data);
  }
}

export default UIManager;
