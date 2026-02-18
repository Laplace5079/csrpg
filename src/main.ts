/**
 * main.ts - 游戏入口点
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

import * as THREE from 'three';
import { Core, GameEvent } from './core';
import { GAME_CONFIG } from './core/constants';

// ============== 游戏主类 ==============
class Game {
  private core: Core;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  
  // 加载状态
  private isLoading: boolean = true;
  private loadingProgress: number = 0;
  
  constructor() {
    this.core = Core.getInstance();
  }
  
  // ============== 初始化 ==============
  public async init(): Promise<void> {
    console.log('[Game] 初始化墨境：孤军...');
    
    try {
      // 更新加载状态
      this.updateLoadingStatus('初始化渲染器...', 10);
      
      // 初始化渲染器
      await this.initRenderer();
      
      this.updateLoadingStatus('初始化场景...', 30);
      
      // 初始化场景
      await this.initScene();
      
      this.updateLoadingStatus('初始化物理...', 50);
      
      // 初始化物理
      await this.initPhysics();
      
      this.updateLoadingStatus('初始化核心系统...', 70);
      
      // 初始化核心
      this.initCore();
      
      this.updateLoadingStatus('初始化输入...', 85);
      
      // 初始化输入
      this.initInput();
      
      this.updateLoadingStatus('完成!', 100);
      
      // 隐藏加载画面
      setTimeout(() => {
        this.hideLoadingScreen();
      }, 500);
      
      // 启动游戏循环
      this.startGameLoop();
      
      console.log('[Game] 初始化完成');
    } catch (error) {
      console.error('[Game] 初始化失败:', error);
      this.showError('游戏初始化失败: ' + (error as Error).message);
    }
  }
  
  // ============== 渲染器初始化 ==============
  private async initRenderer(): Promise<void> {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('找不到游戏容器');
    
    // 创建 WebGL 2.0 渲染器
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', {
      antialias: GAME_CONFIG.ANTIALIAS,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    
    if (!context) {
      throw new Error('您的浏览器不支持 WebGL 2.0');
    }
    
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context: context as WebGLRenderingContext,
      antialias: GAME_CONFIG.ANTIALIAS,
      powerPreference: 'high-performance',
    });
    
    // 渲染器设置
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // 添加到容器
    container.appendChild(this.renderer.domElement);
    
    // 保存到 Core
    this.core.renderer = this.renderer;
    
    console.log('[Game] WebGL 2.0 渲染器已初始化');
  }
  
  // ============== 场景初始化 ==============
  private async initScene(): Promise<void> {
    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);
    
    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.FOV,
      window.innerWidth / window.innerHeight,
      GAME_CONFIG.NEAR_PLANE,
      GAME_CONFIG.FAR_PLANE
    );
    this.camera.position.set(0, GAME_CONFIG.PLAYER_HEIGHT, 0);
    
    // 保存到 Core
    this.core.scene = this.scene;
    this.core.camera = this.camera;
    
    // 添加基础光照
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = GAME_CONFIG.SHADOW_MAP_SIZE;
    directionalLight.shadow.mapSize.height = GAME_CONFIG.SHADOW_MAP_SIZE;
    this.scene.add(directionalLight);
    
    // 添加测试地面
    this.createTestEnvironment();
    
    console.log('[Game] 场景已初始化');
  }
  
  // ============== 创建测试环境 ==============
  private createTestEnvironment(): void {
    if (!this.scene) return;
    
    // 地面
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // 网格辅助
    const gridHelper = new THREE.GridHelper(100, 50, 0x00ffff, 0x222244);
    this.scene.add(gridHelper);
    
    // 测试方块
    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 0.2,
    });
    
    for (let i = 0; i < 10; i++) {
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.set(
        (Math.random() - 0.5) * 40,
        1,
        (Math.random() - 0.5) * 40
      );
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
    }
    
    console.log('[Game] 测试环境已创建');
  }
  
  // ============== 物理初始化 ==============
  private async initPhysics(): Promise<void> {
    // 物理引擎将在此处初始化 Cannon-es
    // 暂时跳过，使用简单碰撞检测
    
    console.log('[Game] 物理系统已初始化 (简化版)');
  }
  
  // ============== 核心初始化 ==============
  private initCore(): void {
    this.core.initialize();
    
    // 监听核心事件
    this.core.eventBus.on(GameEvent.CORE_INITIALIZED, () => {
      console.log('[Game] 核心系统已就绪');
    });
    
    this.core.eventBus.on(GameEvent.LEVEL_UP, (level: number) => {
      console.log(`[Game] 升级到 ${level} 级!`);
      this.showNotification(`升级到 ${level} 级!`);
    });
  }
  
  // ============== 输入初始化 ==============
  private initInput(): void {
    // 窗口大小调整
    window.addEventListener('resize', () => this.onWindowResize());
    
    // 点击启动
    document.addEventListener('click', () => {
      if (!this.core.gameState.isPlaying()) {
        this.core.startNewGame();
      }
    });
    
    console.log('[Game] 输入系统已初始化');
  }
  
  // ============== 游戏循环 ==============
  private startGameLoop(): void {
    const gameLoop = (time: number) => {
      requestAnimationFrame(gameLoop);
      
      // 更新核心
      this.core.update(time);
      
      // 渲染场景
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    
    requestAnimationFrame(gameLoop);
    console.log('[Game] 游戏循环已启动');
  }
  
  // ============== 窗口调整 ==============
  private onWindowResize(): void {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // ============== 加载状态 ==============
  private updateLoadingStatus(status: string, progress: number): void {
    this.loadingProgress = progress;
    
    const loadingBar = document.getElementById('loading-bar');
    const loadingStatus = document.getElementById('loading-status');
    
    if (loadingBar) loadingBar.style.width = `${progress}%`;
    if (loadingStatus) loadingStatus.textContent = status;
  }
  
  private hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  }
  
  // ============== 通知 ==============
  private showNotification(message: string): void {
    // 简单的通知实现
    const notification = document.createElement('div');
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
      z-index: 1001;
      animation: fadeOut 2s forwards;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 2000);
  }
  
  // ============== 错误显示 ==============
  private showError(message: string): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      const status = document.getElementById('loading-status');
      if (status) {
        status.style.color = '#ff0000';
        status.textContent = message;
      }
    }
  }
}

// ============== 启动游戏 ==============
const game = new Game();
game.init();

// 导出以供调试
(window as any).game = game;
