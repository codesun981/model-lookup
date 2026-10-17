"use strict";
/* ---- extracted verbatim from the original bundle (renamed for readability) ---- */
const TAU = Math.PI*2, STAR_MAX = 3e4, PIXEL_BUDGET = 22e5;

function xorshift(e){ let t=e>>>0;
  return t=Math.imul(t^t>>>16,2146121005),
         t=Math.imul(t^t>>>15,2221713035),
         (t^t>>>16)>>>0; }
function hash01(e){ return (xorshift(e)>>>8)/16777216; }

// base colors (pre hue-rotation)
const C_SKY=[56,189,248], C_VIOLET=[192,132,252], C_PLUM=[70,15,85],
      C_SILVER=[250,250,252], C_BLACK=[9,9,11];

// hue-rotate palette (3x3 matrix, luma weights .213/.715/.072)
function palette(hueDeg){
  const t=hueDeg*Math.PI/180, n=Math.cos(t), r=Math.sin(t);
  const m=[[.213+n*.787-r*.213, .715-n*.715-r*.715, .072-n*.072+r*.928],
           [.213-n*.213+r*.143, .715+n*.285+r*.14,  .072-n*.072-r*.283],
           [.213-n*.213-r*.787, .715-n*.715+r*.715, .072+n*.928+r*.072]];
  const apply=(e,t)=>Math.min(255,Math.max(0,e[0]*t[0]+e[1]*t[1]+e[2]*t[2]));
  const o=e=>[apply(m[0],e),apply(m[1],e),apply(m[2],e)];
  return { sky:o(C_SKY), violet:o(C_VIOLET), plum:o(C_PLUM), silver:o(C_SILVER), black:o(C_BLACK) };
}

// wave geometry from viewport size
function waveGeom(w,h){
  const n=Math.min(2,Math.max(.5,Math.sqrt(w*h/(1920*1080))));
  const r=-724*n+(w-1920*n)*.4, i=2e3*n, a=2500*n;
  const o=r+Math.sqrt(a*a-i*i), s=w-r;
  const c=a>s ? i-Math.sqrt(a*a-s*s) : 1/0;
  const l=Math.min(o,w*.405), u=Math.min(c,h*.585);
  const d=w-l, f=u, p=Math.hypot(d,f), m=p*.062;
  const h_=p*p/(8*m)+m*.5;
  const g=(l+w)*.5-f/p*(h_-m), _=u*.5+d/p*(h_-m);
  let v=1/0, y=-1/0;
  for(let n2=0;n2<=32;n2++){
    const r2=n2/32;
    for(const [nn,ii] of [[w*r2,0],[w*r2,h],[0,h*r2],[w,h*r2]]){
      const e=Math.atan2(ii-_,nn-g);
      e<v&&(v=e), e>y&&(y=e);
    }
  }
  return { scale:n, centerX:g, centerY:_, radius:h_, thetaMin:v-.04, thetaMax:y+.04 };
}

// the renderer — exact port of the original, plus `timeSec` for animation
// (wave undulation via phase; stars drift upward with per-star speed)
function renderWave(canvas, W, H, hue, timeSec){
  const phase = timeSec*0.5;
  const breathe = Math.sin(timeSec*0.9)*10;   // radial breathing, px (scaled by a below)
  canvas.width=W; canvas.height=H;
  const pal=palette(hue);
  const {scale:a,centerX:ox,centerY:oy,radius:cr0,thetaMin:thMin,thetaMax:thMax}=waveGeom(W,H);
  const cr = cr0 + breathe*a;   // breathing wave radius (particles ride along)
  const d=TAU*2.2/(thMax-thMin), f=500*a;
  const p=Math.min(STAR_MAX, Math.round(.1*.25*(thMax-thMin)*(cr-f/2)*f*.25));
  const ctx=canvas.getContext('2d');
  if(!ctx) return;
  const img=ctx.createImageData(W,H), g=img.data;
  const _=W/2, v=H/2, y=1600*a;
  const b=(e,t)=>{ const n=Math.hypot(e-_,t-v)/y, r=1-n*n*n; return r>.2?r:.2; };
  const x=Math.ceil(W/2), ee=Math.ceil(H/2);
  const S=new Float32Array(x*ee*3), te=new Uint8Array(x*ee);
  const C=14*a, ne=120*a, re=600*a, ie=10*a, ae=30*a, oe=5*a;

  // pass 1: wave field at half res
  for(let e=0;e<ee;e++){
    const t=e*2, n=t-oy;
    for(let r=0;r<x;r++){
      const a2=r*2, s=a2-ox, l=Math.hypot(s,n)-cr;
      if(l<0) continue;
      const u=b(a2+1,t+1); let fl=null, pr=u;
      const ang=Math.atan2(n,s)+phase;
      if(l<oe){ pr*=1+.16*Math.sin(ang*d); fl=pal.sky; }
      else{
        const t2=Math.exp(-l/C),
              a3=Math.exp(-l/ne)*Math.min(1,l/ie)*.85,
              o2=Math.exp(-l/re)*Math.min(1,l/ae)*.7,
              c2=Math.min(1,t2+a3+o2);
        if(c2>.003){
          const o3=hash01(e*x+r^539363090);
          if(o3<t2){ pr*=1+.16*Math.sin(ang*d); fl=pal.sky; }
          else if(o3<t2+a3){ fl=pal.violet; }
          else if(o3<c2){ fl=pal.plum; }
        }
      }
      if(fl){ const t3=e*x+r; te[t3]=1; S[t3*3]=fl[0]*pr; S[t3*3+1]=fl[1]*pr; S[t3*3+2]=fl[2]*pr; }
    }
  }

  // pass 2: upscale + dither to full res
  let se=0, w=0;
  for(let e=0;e<H;e++){
    const n2=(e>>1)*x;
    for(let r=0;r<W;r++,se++,w+=4){
      const t2=(hash01(se^2654435769)-.5)*24;
      const a2=n2+(r>>1); let o2,s2,c2;
      if(te[a2]){ o2=S[a2*3]; s2=S[a2*3+1]; c2=S[a2*3+2]; }
      else { const t3=b(r+.5,e+.5); o2=pal.black[0]*t3; s2=pal.black[1]*t3; c2=pal.black[2]*t3; }
      g[w]=o2+t2; g[w+1]=s2+t2; g[w+2]=c2+t2; g[w+3]=255;
    }
  }

  // pass 3: crest particles rising upward from the wave.
  // Full density (original distribution) for the grand, atmospheric cloud.
  // (canvas +y = screen up because the container is scaleY(-1) flipped)
  for(let e=0;e<p;e++){  // full density for the mist-like cloud
    const r= xorshift(e^2769414579);
    const d2=thMin+(thMax-thMin)*hash01(r);
    const v2=.004+hash01(r^668265263)*.011;
    const y2=hash01(r^374761393)*TAU+phase;
    // original depth distribution: dense at crest, thinning outward (natural gradient)
    const p2=f*(1-Math.cbrt(hash01(r^1675113877)));
    const m2=Math.max(p2,14*a);
    const h2=hash01(r^3266489909)*m2;
    const _2=cr-h2;
    const x2=d2+-(.06*a)/v2*(Math.cos(y2)/Math.max(_2,1));
    // slow outward drift along radial direction
    const speed=8+hash01(r^444444)*16;                      // 8-24 px/s, very slow
    const maxRise=(40+hash01(r^222222)*120)*a;
    const cyc=(((timeSec*speed+hash01(r^987654321)*maxRise)%maxRise)+maxRise)%maxRise/maxRise;
    const _2r=_2-cyc*maxRise;
    // clip: hide particles still inside the blue line
    if(_2r>cr+2*a) continue;
    const ee2=ox+_2r*Math.cos(x2);
    const S2=oy+_2r*Math.sin(x2);
    const fade=Math.pow(1-cyc, 1.2);
    const te2=Math.max(0,Math.min(h2/3,(m2-h2)/(m2*.25)))*fade;
    if(te2<=0.003) continue;
    const C2=b(ee2,S2), ne2=Math.ceil(ee2-1), re2=Math.ceil(S2-1);
    // 2x2 px tiny particles (like the original mist)
    for(let e2=re2;e2<re2+2;e2++){ if(e2<0||e2>=H) continue;
      for(let n2=ne2;n2<ne2+2;n2++){ if(n2<0||n2>=W) continue;
        const rr=(e2*W+n2)*4;
        g[rr]+=(pal.silver[0]*C2-g[rr])*te2;
        g[rr+1]+=(pal.silver[1]*C2-g[rr+1])*te2;
        g[rr+2]+=(pal.silver[2]*C2-g[rr+2])*te2;
      }
    }
  }

  // pass 4: hash grain overlay
  w=0;
  for(let e=0;e<H;e++){
    const n2=(e&511)*512;
    for(let r=0;r<W;r++,w+=4){
      const t2=hash01(n2+(r&511)^3266489909);
      if(t2<.045){
        const e2=t2<.023?0:255, n3=10/255;
        g[w]+=(e2-g[w])*n3; g[w+1]+=(e2-g[w+1])*n3; g[w+2]+=(e2-g[w+2])*n3;
      }
    }
  }
  ctx.putImageData(img,0,0);
}

/* ---- page wiring ---- */
const canvas=document.getElementById('wave');
const HUE=0;
const t0=performance.now();
let last=0;

function frameSize(){
  const w=Math.max(320, innerWidth), h=Math.max(240, innerHeight);
  const dpr=Math.max(1, devicePixelRatio||1);
  const s=Math.max(.55, Math.min(dpr, Math.sqrt(PIXEL_BUDGET/(w*h))));
  return { w:Math.round(w*s), h:Math.round(h*s) };
}
function draw(now){ const {w,h}=frameSize(); renderWave(canvas,w,h,HUE,(now-t0)/1000); }
let rAF=null;
function loop(ts){
  if(ts-last>120){ draw(ts); last=ts; }  // ~8fps gentle motion
  rAF=requestAnimationFrame(loop);
}
addEventListener('resize', ()=>draw(performance.now()));
if(matchMedia('(prefers-reduced-motion: reduce)').matches){ draw(performance.now()); }
else { draw(performance.now()); rAF=requestAnimationFrame(loop); }
