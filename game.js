// Micro City — GTA-style top-down web game (single-file logic)
// No external libraries. Keep it lightweight and beginner-friendly.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');

const UI = {
  speed: document.getElementById('speed'),
  wanted: document.getElementById('wanted'),
  cash: document.getElementById('cash'),
  clock: document.getElementById('clock'),
  weather: document.getElementById('weather'),
  mission: document.getElementById('mission'),
};

const keys = {};
let showMini = false;

// Mobile controls
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const mobileOverlay = document.getElementById('mobileOverlay');
if (isMobile) {
  mobileOverlay.classList.remove('hidden');
  mobileOverlay.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('touchstart', e => { e.preventDefault(); keys[btn.dataset.k] = true; });
    btn.addEventListener('touchend', e => { e.preventDefault(); keys[btn.dataset.k] = false; });
  });
}

document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

document.addEventListener('keydown', e => {
  if (e.code === 'KeyM') showMini = !showMini;
  if (e.code === 'KeyN') nextMission();
});

// World constants
const WORLD_SIZE = 4000; // square world
const TILE = 80;
const HALF = WORLD_SIZE/2;
const DT = 1/60;

// Day-night + weather
let timeOfDay = Math.random()*24; // 0-24
let weather = 'Clear';
let weatherTimer = 0;

function updateClock(dt){
  // 1 sec real = 1 min in-game
  timeOfDay = (timeOfDay + (dt*60)/3600) % 24;
  const h = Math.floor(timeOfDay);
  const m = Math.floor((timeOfDay-h)*60);
  UI.clock.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  weatherTimer -= dt;
  if (weatherTimer <= 0){
    const r = Math.random();
    weather = r<0.7?'Clear': r<0.85?'Rain': 'Fog';
    UI.weather.textContent = weather;
    weatherTimer = 45 + Math.random()*45;
  }
}

// Camera
const camera = { x: HALF, y: HALF, zoom: 1 };

// Player / on-foot
const player = {
  x: HALF+100, y: HALF+100, r: 12, speed: 0, angle: 0,
  onFoot: true, inVehicle: null, cash: 0, wanted: 0, alive: true,
};

// Vehicles
class Car {
  constructor(x,y,color='white',police=false){
    this.x=x; this.y=y; this.angle=0;
    this.vx=0; this.vy=0;
    this.speed=0; this.maxSpeed=police? 280: 240;
    this.acc=police? 200: 160;
    this.brake=300; this.turnRate=2.4;
    this.color=color; this.police=police;
    this.width=40; this.height=20;
    this.ai = null; // optional AI controller
    this.health=100;
  }
  update(dt){
    if (!this.ai) return;
    this.ai.update(this, dt);
  }
  draw(ctx){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // body
    ctx.fillStyle = this.police? '#122' : this.color;
    ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
    // window
    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(-this.width/4, -this.height/4, this.width/2, this.height/2);
    // lights (headlights glow if night)
    const night = (timeOfDay<6 || timeOfDay>19);
    if (night){
      ctx.fillStyle = 'rgba(255,255,180,0.2)';
      ctx.beginPath();
      ctx.moveTo(this.width/2, -6);
      ctx.lineTo(this.width/2+30, -2);
      ctx.lineTo(this.width/2+30, 2);
      ctx.lineTo(this.width/2, 6);
      ctx.fill();
    }
    // police bar
    if (this.police){
      ctx.fillStyle = '#255';
      ctx.fillRect(-6,-this.height/2-4,12,6);
    }
    ctx.restore();
  }
}

// Simple car drive physics for player
function driveCar(car, dt){
  let throttle = 0, steer = 0;
  const up = keys['KeyW'] || keys['ArrowUp'];
  const down = keys['KeyS'] || keys['ArrowDown'];
  const left = keys['KeyA'] || keys['ArrowLeft'];
  const right = keys['KeyD'] || keys['ArrowRight'];
  const handbrake = keys['Space'];

  if (up) throttle += car.acc;
  if (down) throttle -= car.brake * 0.65;
  if (left) steer -= 1;
  if (right) steer += 1;

  // speed/drag
  car.speed += throttle * dt;
  const max = car.maxSpeed;
  car.speed = Math.max(Math.min(car.speed, max), -max*0.4);

  // friction
  car.speed *= (handbrake? 0.94 : 0.98);

  // turn
  const turnScale = (car.speed/max);
  car.angle += steer * car.turnRate * turnScale * dt;

  // move
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // bounds
  car.x = Math.max(0, Math.min(WORLD_SIZE, car.x));
  car.y = Math.max(0, Math.min(WORLD_SIZE, car.y));

  UI.speed.textContent = Math.abs(Math.round(car.speed*0.18));
}

// AI: wander or chase if police + wanted
class SimpleAI {
  constructor(mode='wander'){
    this.mode = mode;
    this.timer = 0;
    this.target = {x: HALF, y: HALF};
  }
  update(car, dt){
    this.timer -= dt;
    if (this.mode==='wander'){
      if (this.timer <= 0){
        this.target.x = Math.random()*WORLD_SIZE;
        this.target.y = Math.random()*WORLD_SIZE;
        this.timer = 3 + Math.random()*5;
      }
    } else if (this.mode==='cop'){
      // chase player if wanted > 0
      if (player.wanted>0){
        this.target.x = playerCar? playerCar.x : player.x;
        this.target.y = playerCar? playerCar.y : player.y;
      } else {
        // patrol
        if (this.timer<=0){
          this.target.x = HALF + (Math.random()-0.5)*800;
          this.target.y = HALF + (Math.random()-0.5)*800;
          this.timer = 4 + Math.random()*6;
        }
      }
    }
    const dx = this.target.x - car.x;
    const dy = this.target.y - car.y;
    const ang = Math.atan2(dy, dx);
    // steer towards target
    let diff = ((ang - car.angle + Math.PI*3) % (Math.PI*2)) - Math.PI;
    car.angle += Math.max(-2.0, Math.min(2.0, diff)) * dt;
    // speed
    car.speed += (car.acc * 0.6) * dt;
    car.speed = Math.min(car.speed, car.maxSpeed*0.6);
    // move
    car.x += Math.cos(car.angle)*car.speed*dt;
    car.y += Math.sin(car.angle)*car.speed*dt;
    car.x = Math.max(0, Math.min(WORLD_SIZE, car.x));
    car.y = Math.max(0, Math.min(WORLD_SIZE, car.y));
  }
}

// World: roads + districts
const districts = [
  {name:'Downtown', x:HALF-700, y:HALF-700, w:1200, h:900, color:'#1f2933'},
  {name:'Suburbs', x:HALF-1400, y:HALF+100, w:1400, h:900, color:'#253241'},
  {name:'Industrial', x:HALF+200, y:HALF+200, w:1100, h:900, color:'#1a2530'},
  {name:'Docks', x:HALF-1400, y:HALF-1400, w:900, h:600, color:'#1a2230'},
  {name:'Outskirts', x:200, y:200, w:WORLD_SIZE-400, h:WORLD_SIZE-400, color:'#141b22', outline:true},
];

const roads = []; // grid-like
for (let i=0;i<WORLD_SIZE;i+=TILE*2){
  roads.push({x:i, y:0, w:8, h:WORLD_SIZE, vertical:true});
  roads.push({x:0, y:i, w:WORLD_SIZE, h:8, vertical:false});
}

// Static obstacles (buildings as rectangles)
const buildings = [];
function addBuilding(x,y,w,h,color){
  buildings.push({x,y,w,h,color});
}
// Fill downtown with blocks
for (let i=0;i<15;i++){
  const x = HALF-650 + (i%5)*240;
  const y = HALF-650 + Math.floor(i/5)*250;
  addBuilding(x+20, y+20, 200, 210, ['#2a3543','#2e3a4a','#334155'][i%3]);
}

// Park area
addBuilding(HALF-100, HALF-100, 200, 200, '#0f2a1f');

// Vehicles in world
const cars = [];
for (let i=0;i<25;i++){
  const c = new Car(Math.random()*WORLD_SIZE, Math.random()*WORLD_SIZE, ['#a33','#3aa','#aa3','#888'][i%4]);
  c.ai = new SimpleAI('wander');
  cars.push(c);
}
// police
for (let i=0;i<6;i++){
  const p = new Car(HALF+(Math.random()-0.5)*600, HALF+(Math.random()-0.5)*600, '#113', true);
  p.ai = new SimpleAI('cop');
  cars.push(p);
}

let playerCar = null;

// Missions
const missions = [
  { id:1, desc:'Drive to Downtown plaza.', target:{x:HALF-100,y:HALF-180}, reward: 100 },
  { id:2, desc:'Pick up a suspicious package near the docks.', target:{x:HALF-1200,y:HALF-1200}, reward: 200 },
  { id:3, desc:'Lose the cops for 30 seconds.', target:null, reward: 300, loseCops:30 },
  { id:4, desc:'Deliver goods to Industrial gate.', target:{x:HALF+700,y:HALF+300}, reward: 250 },
];
let currentMission = null;
let missionTimer = 0;

function setMission(m){
  currentMission = m; missionTimer = 0;
  UI.mission.textContent = m? m.desc : 'None';
}
function nextMission(){
  const pool = missions.filter(m => !completedMissions.has(m.id));
  if (pool.length===0){
    setMission(null);
    UI.mission.textContent = 'All missions done!';
    return;
  }
  setMission(pool[0]);
}
const completedMissions = new Set();

// Wanted system
let wantedDecay = 0;

// Utility
function rectsOverlap(a,b){
  return !(a.x+a.w < b.x || a.x > b.x+b.w || a.y+a.h < b.y || a.y > b.y+b.h);
}
function pointInRect(px,py,r){
  return (px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h);
}

// Enter/exit car
function tryEnterExit(){
  if (player.onFoot){
    // look for nearby car
    let nearest=null, nd=9999;
    for (const c of cars){
      const dx=c.x - player.x; const dy=c.y - player.y;
      const d=Math.hypot(dx,dy);
      if (d<45 && d<nd){ nd=d; nearest=c; }
    }
    if (nearest){
      player.onFoot=false;
      player.inVehicle=nearest;
      playerCar = nearest;
    }
  } else {
    // exit
    player.onFoot=true;
    player.inVehicle=null;
    playerCar=null;
  }
}
document.addEventListener('keydown', e=>{
  if (e.code==='KeyE') tryEnterExit();
});

// Crime: bumping civilians or police triggers wanted
function handleCollisions(){
  if (!playerCar) return;
  for (const c of cars){
    if (c===playerCar) continue;
    const dx = c.x - playerCar.x;
    const dy = c.y - playerCar.y;
    if (Math.hypot(dx,dy) < 28){
      // light bump
      if (c.police){
        player.wanted = Math.min(5, player.wanted+1);
      } else {
        player.wanted = Math.min(5, player.wanted+ (Math.random()<0.2?1:0));
      }
      wantedDecay = 10;
    }
  }
}

// Mission logic
function updateMission(dt){
  if (!currentMission) return;
  if (currentMission.loseCops){
    if (player.wanted===0){
      missionTimer += dt;
      if (missionTimer >= currentMission.loseCops){
        player.cash += currentMission.reward;
        completedMissions.add(currentMission.id);
        setMission(null);
      }
    } else {
      missionTimer = 0;
    }
    return;
  }
  const t = currentMission.target;
  if (!t) return;
  const px = playerCar? playerCar.x : player.x;
  const py = playerCar? playerCar.y : player.y;
  if (Math.hypot(px-t.x, py-t.y) < 60){
    player.cash += currentMission.reward;
    completedMissions.add(currentMission.id);
    setMission(null);
  }
}

// Draw world
function drawWorld(){
  // sky/day-night tint
  const night = (timeOfDay<6 || timeOfDay>19);
  const fog = weather==='Fog';
  const rain = weather==='Rain';

  ctx.fillStyle = night? '#080b12' : '#0f141b';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // transform
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // districts
  for (const d of districts){
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    if (d.outline){
      ctx.strokeStyle = '#2a3340';
      ctx.strokeRect(d.x, d.y, d.w, d.h);
    }
  }

  // roads
  ctx.fillStyle = '#121820';
  for (const r of roads){
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // buildings
  for (const b of buildings){
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // windows
    ctx.fillStyle = '#0c1220';
    for (let i=0;i<Math.floor(b.w/30);i++){
      for (let j=0;j<Math.floor(b.h/30);j++){
        if ((i+j)%3===0) ctx.fillRect(b.x+8+i*24, b.y+8+j*24, 10, 10);
      }
    }
  }

  // mission target marker
  if (currentMission && currentMission.target){
    const t=currentMission.target;
    ctx.strokeStyle = '#9ad';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 40, 0, Math.PI*2);
    ctx.stroke();
  }

  // vehicles
  for (const c of cars) c.draw(ctx);

  // player on-foot
  if (player.onFoot){
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.arc(0,0, player.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // rain/fog overlays
  ctx.restore();

  if (fog){
    ctx.fillStyle = 'rgba(140,160,180,0.08)';
    for (let i=0;i<6;i++){
      ctx.beginPath();
      ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height, 200+Math.random()*200, 0, Math.PI*2);
      ctx.fill();
    }
  }
  if (night){
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  if (rain){
    ctx.strokeStyle = 'rgba(180,200,255,0.35)';
    ctx.lineWidth = 1;
    for (let i=0;i<120;i++){
      const x = Math.random()*canvas.width;
      const y = Math.random()*canvas.height;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(x+2,y+12);
      ctx.stroke();
    }
  }
}

// Minimap
function drawMinimap(){
  if (!showMini) return;
  mini.classList.remove('hidden');
  mctx.fillStyle = '#0b1016';
  mctx.fillRect(0,0,mini.width,mini.height);
  const scale = mini.width/WORLD_SIZE;

  // districts
  for (const d of districts){
    mctx.fillStyle = '#1b2430';
    mctx.fillRect(d.x*scale, d.y*scale, d.w*scale, d.h*scale);
  }
  // player / car
  const px = playerCar? playerCar.x : player.x;
  const py = playerCar? playerCar.y : player.y;
  mctx.fillStyle = '#9cf';
  mctx.fillRect(px*scale-2, py*scale-2, 4, 4);
  // mission
  if (currentMission && currentMission.target){
    const t=currentMission.target;
    mctx.strokeStyle = '#fff';
    mctx.strokeRect(t.x*scale-6, t.y*scale-6, 12, 12);
  }
} 

// Update loop
let last=performance.now();
function loop(ts){
  const dt = Math.min(0.033, (ts-last)/1000); last=ts;
  updateClock(dt);

  // Player logic
  if (player.onFoot){
    // simple walking
    let vx = (keys['KeyD']||keys['ArrowRight']?1:0) - (keys['KeyA']||keys['ArrowLeft']?1:0);
    let vy = (keys['KeyS']||keys['ArrowDown']?1:0) - (keys['KeyW']||keys['ArrowUp']?1:0);
    const sp = 120;
    player.x += vx*sp*dt;
    player.y += vy*sp*dt;
    player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
    player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));
    UI.speed.textContent = Math.abs(Math.round(Math.hypot(vx,vy)*sp*0.18));
  } else if (player.inVehicle){
    driveCar(player.inVehicle, dt);
  }

  // AI cars
  for (const c of cars) c.update(dt);

  // wanted decay
  if (player.wanted>0){
    wantedDecay -= dt;
    if (wantedDecay<=0){
      player.wanted = Math.max(0, player.wanted-1);
      wantedDecay = 8;
    }
  }

  // camera follow
  const fx = playerCar? playerCar.x : player.x;
  const fy = playerCar? playerCar.y : player.y;
  camera.x += (fx - camera.x)*0.08;
  camera.y += (fy - camera.y)*0.08;

  // zoom with speed
  const spd = playerCar? Math.abs(playerCar.speed) : 0;
  const targetZoom = 1 + Math.min(0.4, spd/400);
  camera.zoom += (targetZoom - camera.zoom)*0.05;

  handleCollisions();
  updateMission(dt);

  // draw
  drawWorld();
  if (showMini) drawMinimap(); else mini.classList.add('hidden');

  // HUD
  UI.wanted.textContent = player.wanted;
  UI.cash.textContent = player.cash;

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Spawn initial mission
setTimeout(nextMission, 1000);

// Resize handling
function fit(){
  const w = Math.min(window.innerWidth-20, 1280);
  const h = Math.min(window.innerHeight-120, 780);
  canvas.width = Math.max(960, w);
  canvas.height = Math.max(540, h);
}
window.addEventListener('resize', fit);
fit();
