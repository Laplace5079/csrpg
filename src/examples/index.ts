/**
 * 使用示例 - 渲染引擎和移动端适配
 * 展示如何在项目中使用这些模块
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  Renderer,
  Camera,
  PhysicsWorld,
  TouchControls,
  detectDevice,
  createHUDContainer,
  injectHUDStyles,
  MOBILE_HUD_THEME,
} from '../index';

// MobileHUD is React component, lazy load
let MobileHUD: any;

// ============================================
// 示例1: 基础渲染器初始化
// ============================================
function initRenderer() {
  const container = document.getElementById('game-container') as HTMLElement;

  // 创建渲染器
  const renderer = new Renderer({
    container,
    antialias: true,
    powerPreference: 'high-performance',
  });

  // 获取Three.js渲染器实例
  const threeRenderer = renderer.getRenderer();

  // 监听窗口大小变化
  renderer.onResize(() => {
    const { width, height } = renderer.getSize();
    console.log(`Renderer resized: ${width}x${height}`);
  });

  // 获取WebGL信息
  const contextInfo = renderer.getContextInfo();
  console.log('WebGL Info:', contextInfo);

  return renderer;
}

// ============================================
// 示例2: FPS摄像机设置
// ============================================
function initCamera(renderer: Renderer) {
  // 创建摄像机
  const camera = new Camera({
    fov: 75,
    near: 0.1,
    far: 1000,
    position: new THREE.Vector3(0, 2, 5),
    enablePointerLock: !renderer.getIsMobile(),
  });

  // 锁定状态回调
  camera.onLock(() => {
    console.log('Camera locked - pointer captured');
  });

  camera.onUnlock(() => {
    console.log('Camera unlocked - pointer released');
  });

  // 更新摄像机（每帧调用）
  const updateCamera = (delta: number) => {
    camera.update(delta);
  };

  return { camera, updateCamera };
}

// ============================================
// 示例3: 物理世界设置
// ============================================
function initPhysics() {
  const physics = new PhysicsWorld({
    gravity: 9.82,
    iterations: 10,
    broadphase: 'SAP',
    allowSleep: true,
  });

  // 创建地面
  physics.addPlane('ground', new CANNON.Vec3(0, 1, 0));

  // 创建玩家刚体
  const playerBody = physics.addSphere('player', 0.5, new CANNON.Vec3(0, 5, 0), 1, 'player');

  // 监听碰撞
  physics.onCollision('player', (event) => {
    console.log('Player collided with:', event.bodyA.userData?.id || 'unknown');
  });

  // 更新物理（每帧调用）
  const updatePhysics = (delta: number) => {
    physics.update(delta);
  };

  return { physics, playerBody, updatePhysics };
}

// ============================================
// 示例4: 移动端触控控制
// ============================================
function initTouchControls(
  camera: Camera,
  physics: PhysicsWorld,
  playerBody: CANNON.Body
) {
  const container = document.getElementById('game-container') as HTMLElement;

  // 检测设备类型
  const device = detectDevice();
  console.log('Device type:', device);

  // 如果是移动端，创建触控控制
  if (device.isMobile) {
    const touchControls = new TouchControls({
      container,
      joystickSize: 120,
      joystickPosition: 'left',
      enableLookControl: true,
      lookSensitivity: 1.5,
    });

    // 摇杆移动控制
    touchControls.setOnJoystickMove((state) => {
      // 将摇杆输入应用到物理
      const speed = 10;
      playerBody.velocity.x = state.x * speed;
      playerBody.velocity.z = -state.y * speed;
    });

    // 视角控制
    touchControls.setOnLookMove((deltaX, deltaY) => {
      camera.setTouchRotation(deltaX, deltaY);
    });

    // 双击跳跃
    touchControls.setOnDoubleTap(() => {
      playerBody.velocity.y = 10;
    });

    return touchControls;
  }

  return null;
}

// ============================================
// 示例5: React移动端HUD
// ============================================
function initMobileHUD() {
  const device = detectDevice();

  if (!device.isMobile) {
    return null;
  }

  // 注入样式
  injectHUDStyles(MOBILE_HUD_THEME, true);

  // 创建HUD容器
  const container = createHUDContainer('game-hud');

  // 创建动作按钮
  const attackBtn = document.createElement('button');
  attackBtn.className = 'hud-button';
  attackBtn.innerHTML = '⚔️';
  attackBtn.style.cssText = 'position:absolute;bottom:120px;right:30px;';
  attackBtn.onclick = () => console.log('Attack!');
  container.appendChild(attackBtn);

  const jumpBtn = document.createElement('button');
  jumpBtn.className = 'hud-button';
  jumpBtn.innerHTML = '⬆️';
  jumpBtn.style.cssText = 'position:absolute;bottom:180px;right:30px;';
  jumpBtn.onclick = () => console.log('Jump!');
  container.appendChild(jumpBtn);

  return container;
}

// ============================================
// 示例6: 完整的游戏初始化
// ============================================
export async function initGame() {
  const container = document.getElementById('game-container') as HTMLElement;

  // 1. 初始化渲染器
  const renderer = initRenderer();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // 2. 初始化摄像机
  const { camera, updateCamera } = initCamera(renderer);

  // 3. 添加一些测试物体
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x4a90d9 });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 1, -5);
  scene.add(cube);

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 5);
  scene.add(directionalLight);

  // 4. 初始化物理
  const { physics, updatePhysics } = initPhysics();

  // 5. 初始化触控控制
  const playerBody = physics.getBody('player')!;
  const touchControls = initTouchControls(camera, physics, playerBody);

  // 6. 初始化移动端HUD
  initMobileHUD();

  // 7. 开始渲染循环
  let lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // 更新物理
    updatePhysics(delta);

    // 同步物理到渲染
    physics.syncToThreeJS('player', cube);

    // 更新摄像机
    updateCamera(delta);

    // 渲染
    renderer.render(scene, camera.getCamera());
  }

  animate();

  // 返回清理函数
  return () => {
    renderer.dispose();
    physics.dispose();
    if (touchControls) {
      touchControls.dispose();
    }
    removeHUDContainer('game-hud');
  };
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  // 检查是否有容器
  const container = document.getElementById('game-container');
  if (container) {
    initGame().then((cleanup) => {
      console.log('Game initialized!', cleanup);
    });
  }
}
