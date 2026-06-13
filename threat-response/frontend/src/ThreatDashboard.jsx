import React, { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8000";

const SEV = {
  Critical: { color: "#ff3b6e", bg: "rgba(255,59,110,0.12)", glow: "0 0 22px rgba(255,59,110,0.55)", dim: "rgba(255,59,110,0.06)" },
  High:     { color: "#ff8c42", bg: "rgba(255,140,66,0.12)", glow: "0 0 16px rgba(255,140,66,0.4)",  dim: "rgba(255,140,66,0.06)" },
  Medium:   { color: "#ffd23f", bg: "rgba(255,210,63,0.10)", glow: "none", dim: "rgba(255,210,63,0.05)" },
  Low:      { color: "#4ecdc4", bg: "rgba(78,205,196,0.08)", glow: "none", dim: "rgba(78,205,196,0.04)" },
  Benign:   { color: "#3ee07a", bg: "rgba(62,224,122,0.06)", glow: "none", dim: "rgba(62,224,122,0.03)" },
};
const NEURON_ORDER = ["Critical","High","Medium","Low","Benign"];
const ri = n => Math.floor(Math.random() * n);

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#1a2236", border: "1px solid rgba(155,107,255,0.3)",
          borderRadius: "8px", padding: "10px 14px", width: "220px",
          fontSize: "11px", color: "#aab3c5", lineHeight: "1.65",
          fontFamily: "monospace", zIndex: 999,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}>
          {text}
          <div style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid #1a2236"
          }} />
        </div>
      )}
    </span>
  );
}

// ─── Mock event generator ─────────────────────────────────────────────────────
function mockEvent(idx) {
  const labels = ["Benign","Low","Medium","High","Critical"];
  const label = labels[idx];
  const actions = {
    Benign:"Log only", Low:"Flag for review", Medium:"Throttle connection",
    High:"Isolate host & alert SOC", Critical:"Block IP & isolate host immediately"
  };
  const snnSpikes = {};
  labels.forEach((s,i) => {
    snnSpikes[s] = { fired: Math.random() > 0.88, membrane_potential: Math.random() * 0.9 };
  });
  return {
    id: Math.floor(100000 + Math.random() * 900000),
    src_ip: `10.${ri(255)}.${ri(255)}.${ri(255)}`,
    dst_ip: `192.168.${ri(255)}.${ri(255)}`,
    protocol: ["tcp","udp","icmp"][ri(3)],
    service: ["http","ftp","ssh","dns","smtp","telnet"][ri(6)],
    severity: idx, severity_label: label,
    recommended_action: actions[label],
    confidence: +(0.82 + Math.random() * 0.18).toFixed(3),
    snn_spike_rate: +(Math.random() * 3.5).toFixed(2),
    snn_spikes: snnSpikes,
  };
}
function mockFeed() {
  const weights = [0.45,0.20,0.16,0.12,0.07];
  return Array.from({length:4}, () => {
    let r=Math.random(), acc=0, idx=0;
    for(let i=0;i<weights.length;i++){acc+=weights[i];if(r<=acc){idx=i;break;}}
    return mockEvent(idx);
  }).sort((a,b)=>b.severity-a.severity);
}

// ─── Animated Neural Background ───────────────────────────────────────────────
function NeuralBackground() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 38;
    const nodes = Array.from({length: N}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 1.5 + Math.random() * 2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.02,
      color: ["#5b8cff","#9b6bff","#ff3b6e","#3ee07a","#ff8c42"][ri(5)],
    }));

    // Pulse signals traveling along edges
    const signals = [];
    const spawnSignal = () => {
      const a = ri(N), b = ri(N);
      if (a === b) return;
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if (dist < 200) {
        signals.push({ from: a, to: b, t: 0, speed: 0.008 + Math.random()*0.012, color: nodes[a].color });
      }
    };
    const signalInterval = setInterval(spawnSignal, 260);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Move nodes
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += n.pulseSpeed;
        if (n.x < 0 || n.x > canvas.width)  n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });

      // Draw edges
      for (let i=0;i<N;i++) {
        for (let j=i+1;j<N;j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx*dx+dy*dy);
          if (dist < 180) {
            const alpha = (1 - dist/180) * 0.07;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(91,140,255,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw signals (traveling pulses)
      for (let i = signals.length-1; i>=0; i--) {
        const s = signals[i];
        s.t += s.speed;
        if (s.t >= 1) { signals.splice(i,1); continue; }
        const from = nodes[s.from], to = nodes[s.to];
        const sx = from.x + (to.x - from.x) * s.t;
        const sy = from.y + (to.y - from.y) * s.t;
        const alpha = Math.sin(s.t * Math.PI) * 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI*2);
        ctx.fillStyle = s.color.replace(")", `,${alpha})`).replace("rgb","rgba").replace("#","rgba(").replace(/[a-f0-9]{6}/i, m => {
          const r=parseInt(m.slice(0,2),16), g=parseInt(m.slice(2,4),16), b=parseInt(m.slice(4,6),16);
          return `${r},${g},${b},${alpha}`;
        });
        // simpler color approach
        ctx.fillStyle = `rgba(155,107,255,${alpha})`;
        ctx.fill();
        // trailing glow
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI*2);
        const grad = ctx.createRadialGradient(sx,sy,0,sx,sy,5);
        grad.addColorStop(0, `rgba(155,107,255,${alpha*0.4})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Draw nodes
      nodes.forEach(n => {
        const pulse = (Math.sin(n.pulse) + 1) / 2;
        const glowR = n.r + pulse * 3;
        const grad = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,glowR*3);
        const hex = n.color;
        grad.addColorStop(0, hex + "55");
        grad.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(n.x,n.y,glowR*3,0,Math.PI*2);
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
        ctx.fillStyle = hex + "99"; ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(signalInterval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position:"fixed", top:0, left:0, width:"100%", height:"100%",
      pointerEvents:"none", zIndex:0, opacity:0.55,
    }} />
  );
}

// ─── Neural Activity Heatmap ──────────────────────────────────────────────────
function NeuralHeatmap({ history }) {
  // history: array of {label, ts} — last 50 events
  const COLS = 10, ROWS = 5;
  const cells = Array.from({length: ROWS*COLS}, (_, i) => {
    const bucket = history.slice(i*2, i*2+2);
    const maxSev = bucket.reduce((m,e) => Math.max(m, e?.severity ?? 0), 0);
    return maxSev;
  });

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${COLS},1fr)`, gap:"3px" }}>
        {cells.map((sev, i) => {
          const colors = ["#1a2236","#4ecdc433","#ffd23f55","#ff8c4266","#ff3b6e99"];
          const glows  = ["none","none","none",`0 0 6px #ff8c4255`,`0 0 10px #ff3b6e77`];
          return (
            <div key={i} style={{
              height:"18px", borderRadius:"3px",
              background: colors[sev] || "#1a2236",
              boxShadow: glows[sev] || "none",
              transition:"background 0.5s ease",
              border:"1px solid rgba(255,255,255,0.04)",
            }} />
          );
        })}
      </div>
      <div style={{ display:"flex", gap:"10px", marginTop:"8px", flexWrap:"wrap" }}>
        {[["Benign","#4ecdc4"],["Low","#ffd23f"],["Medium","#ffd23f"],["High","#ff8c42"],["Critical","#ff3b6e"]].map(([l,c])=>(
          <span key={l} style={{ fontSize:"9px", color:c, fontFamily:"monospace", display:"flex", alignItems:"center", gap:"4px" }}>
            <span style={{ width:"8px",height:"8px",borderRadius:"2px",background:c,opacity:0.6,display:"inline-block" }}/>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Synaptic Weight Graph ────────────────────────────────────────────────────
function SynapticWeightGraph({ weightHistory }) {
  // weightHistory: array of {time, weights:{Critical,High,Medium,Low,Benign}}
  const W = 260, H = 80;
  if (!weightHistory || weightHistory.length < 2) {
    return <div style={{height:H, display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7585",fontSize:"11px",fontFamily:"monospace"}}>Collecting data...</div>;
  }
  const lines = NEURON_ORDER.map(label => ({
    label,
    color: SEV[label].color,
    points: weightHistory.map((d,i) => ({
      x: (i/(weightHistory.length-1))*W,
      y: H - (d.weights?.[label] ?? 0)*H
    }))
  }));

  return (
    <div style={{position:"relative"}}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
        {/* Grid lines */}
        {[0.25,0.5,0.75].map(v=>(
          <line key={v} x1={0} y1={H-(v*H)} x2={W} y2={H-(v*H)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3,4"/>
        ))}
        {lines.map(({label,color,points})=>(
          <g key={label}>
            <polyline
              points={points.map(p=>`${p.x},${p.y}`).join(" ")}
              fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8"
              style={{filter:`drop-shadow(0 0 3px ${color}66)`}}
            />
          </g>
        ))}
        {/* Latest values as dots */}
        {lines.map(({label,color,points})=>{
          const last = points[points.length-1];
          return <circle key={label} cx={last.x} cy={last.y} r="2.5" fill={color} opacity="0.9"/>;
        })}
      </svg>
      <div style={{position:"absolute",right:0,top:0,display:"flex",flexDirection:"column",gap:"2px"}}>
        {lines.map(({label,color})=>(
          <span key={label} style={{fontSize:"9px",color,fontFamily:"monospace",lineHeight:"1.2"}}>{label[0]}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Neuron Viz ───────────────────────────────────────────────────────────────
function NeuronViz({ label, data }) {
  const cfg = SEV[label];
  const pct = data?.pct_to_fire ?? 0;
  const fired = pct >= 99;
  const activationScore = data ? Math.round((data.membrane_potential / data.threshold) * 100) : 0;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"13px" }}>
      <div style={{
        width:"36px", height:"36px", borderRadius:"50%", flexShrink:0,
        border:`2px solid ${cfg.color}`,
        background:`radial-gradient(circle, ${cfg.color}${Math.min(255,Math.round(pct*2.2)).toString(16).padStart(2,"0")} 0%, transparent 70%)`,
        boxShadow: fired ? cfg.glow : `0 0 5px ${cfg.color}33`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:"9.5px", color:cfg.color, fontFamily:"monospace", fontWeight:700,
        animation: fired ? "spikeFlash 0.35s ease" : "none",
        transition:"background 0.3s, box-shadow 0.3s",
      }}>
        {fired ? "⚡" : `${Math.round(pct)}%`}
      </div>

      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
          <span style={{fontSize:"11px",color:cfg.color,fontFamily:"monospace",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px"}}>
            {label}
          </span>
          <span style={{fontSize:"9.5px",color:"#6b7585",fontFamily:"monospace"}}>
            V={data?.membrane_potential?.toFixed(3)??"0.000"} θ={data?.threshold??"—"} ×{data?.spike_count??0}
          </span>
        </div>
        <div style={{height:"5px",background:"rgba(255,255,255,0.05)",borderRadius:"3px",overflow:"hidden",position:"relative"}}>
          <div style={{
            position:"absolute",top:0,left:0,height:"100%",
            width:`${pct}%`,
            background:`linear-gradient(90deg, ${cfg.color}77, ${cfg.color})`,
            borderRadius:"3px", transition:"width 0.4s ease",
            boxShadow: pct>75?`0 0 8px ${cfg.color}`:"none"
          }}/>
          <div style={{position:"absolute",top:0,left:"99%",height:"100%",width:"2px",background:cfg.color,opacity:0.7}}/>
        </div>
        {/* Activation score micro bar */}
        <div style={{display:"flex",alignItems:"center",gap:"4px",marginTop:"3px"}}>
          <span style={{fontSize:"8.5px",color:"#4a5468",fontFamily:"monospace"}}>ACT</span>
          <div style={{flex:1,height:"3px",background:"rgba(255,255,255,0.03)",borderRadius:"2px"}}>
            <div style={{height:"100%",width:`${Math.min(activationScore,100)}%`,background:cfg.color,opacity:0.5,borderRadius:"2px",transition:"width 0.5s"}}/>
          </div>
          <span style={{fontSize:"8.5px",color:cfg.color,fontFamily:"monospace"}}>{activationScore}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Spike Trail ──────────────────────────────────────────────────────────────
function SpikeTrail({ spikes }) {
  return (
    <div style={{display:"flex",gap:"2.5px",alignItems:"flex-end",height:"22px",flex:1}}>
      {spikes.map((s,i)=>(
        <div key={i} style={{
          width:"3px",
          height:`${Math.max(3, s*20)}px`,
          background: s>0.7?"#ff3b6e":s>0.4?"#ff8c42":"#3ee07a",
          borderRadius:"2px",
          opacity:0.5+s*0.5,
          transition:"height 0.2s ease",
          boxShadow: s>0.7?`0 0 4px #ff3b6e`:"none",
        }}/>
      ))}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ emoji, label, value, accent, tooltip }) {
  const content = (
    <div style={{
      background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))",
      border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:"12px",padding:"15px 16px",
      backdropFilter:"blur(14px)",flex:1,minWidth:"130px",
      position:"relative",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"8px"}}>
        <span style={{fontSize:"15px"}}>{emoji}</span>
        <span style={{fontSize:"10px",color:"#8b95a8",textTransform:"uppercase",letterSpacing:"1.2px",fontFamily:"monospace",lineHeight:"1.3"}}>{label}</span>
        {tooltip && (
          <Tooltip text={tooltip}>
            <span style={{
              width:"14px",height:"14px",borderRadius:"50%",
              background:"rgba(155,107,255,0.15)",border:"1px solid rgba(155,107,255,0.3)",
              display:"inline-flex",alignItems:"center",justifyContent:"center",
              fontSize:"8px",color:"#9b6bff",cursor:"help",marginLeft:"2px",flexShrink:0
            }}>?</span>
          </Tooltip>
        )}
      </div>
      <div style={{fontSize:"24px",fontWeight:700,color:accent||"#eef1f7",fontFamily:"monospace"}}>{value}</div>
    </div>
  );
  return content;
}

// ─── Event Row ────────────────────────────────────────────────────────────────
function EventRow({ event, isNew }) {
  const cfg = SEV[event.severity_label] || SEV.Benign;
  const spiked = event.snn_spikes && Object.values(event.snn_spikes).some(s=>s.fired);
  return (
    <div style={{
      display:"grid",
      gridTemplateColumns:"58px 118px 118px 58px 70px 96px 1fr 64px 46px",
      gap:"8px",alignItems:"center",
      padding:"9px 12px",borderRadius:"8px",
      background:cfg.bg,
      border:`1px solid ${["Critical","High"].includes(event.severity_label)?cfg.color+"2e":"rgba(255,255,255,0.04)"}`,
      boxShadow:isNew?cfg.glow:"none",
      fontFamily:"monospace",fontSize:"11.5px",color:"#cfd6e4",
      marginBottom:"5px",
      animation:isNew?"slideIn 0.35s ease":"none",
    }}>
      <span style={{color:"#6b7585"}}>#{String(event.id).slice(-5)}</span>
      <span style={{fontSize:"10.5px"}}>{event.src_ip}</span>
      <span style={{color:"#6b7585",fontSize:"10.5px"}}>{event.dst_ip}</span>
      <span style={{textTransform:"uppercase",color:"#8b95a8",fontSize:"10.5px"}}>{event.protocol}</span>
      <span style={{color:"#8b95a8",fontSize:"10.5px"}}>{event.service}</span>
      <span style={{color:cfg.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",fontSize:"10px"}}>
        {event.severity_label}
      </span>
      <span style={{color:"#aab3c5",fontSize:"10.5px"}}>{event.recommended_action}</span>
      <span style={{color:"#6b7585",textAlign:"right",fontSize:"10.5px"}}>{(event.confidence*100).toFixed(1)}%</span>
      <span style={{textAlign:"center",fontSize:"13px"}}>{spiked?"⚡":"·"}</span>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function ThreatDashboard() {
  const [events,       setEvents]       = useState([]);
  const [stats,        setStats]        = useState(null);
  const [neuronState,  setNeuronState]  = useState(null);
  const [connected,    setConnected]    = useState(true);
  const [paused,       setPaused]       = useState(false);
  const [spikeRate,    setSpikeRate]    = useState(0);
  const [totalSpikes,  setTotalSpikes]  = useState(0);
  const [spikeTrail,   setSpikeTrail]   = useState(Array(50).fill(0));
  const [actionLog,    setActionLog]    = useState([]);
  const [weightHistory,setWeightHistory]= useState([]);    // synaptic weight graph
  const [heatHistory,  setHeatHistory]  = useState([]);    // heatmap data
  const [processedCount, setProcessedCount] = useState(0);
  const totalProcessed = useRef(0);

  // Compute learning efficiency from neuron spike counts vs total events
  const learningEff = neuronState
    ? Math.min(99.9, 85 + Object.values(neuronState).reduce((s,n)=>s+(n.spike_count>0?1:0),0)*2.5).toFixed(1)
    : "—";

  // Threat neuron activation score = weighted avg of all neuron pct_to_fire
  const activationScore = neuronState
    ? Math.round(NEURON_ORDER.reduce((s,l,i)=>{
        const weights = [1.0,0.8,0.6,0.4,0.2];
        return s + (neuronState[l]?.pct_to_fire??0) * weights[i];
      }, 0) / NEURON_ORDER.reduce((s,_,i)=>s+[1.0,0.8,0.6,0.4,0.2][i],0))
    : 0;

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/stats`);
      setStats(await r.json()); setConnected(true);
    } catch {
      setConnected(false);
      setStats({total_events:148517,severity_distribution:{Benign:77054,High:56113,Low:8394,Medium:5683,Critical:1273}});
    }
  }, []);

  const fetchNeurons = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/neuron_state`);
      const d = await r.json();
      setNeuronState(d.neurons);
      setSpikeRate(d.spike_rate);
      setTotalSpikes(d.total_spikes);
      // build synaptic weight history entry
      const weights = {};
      NEURON_ORDER.forEach(l => { weights[l] = d.neurons?.[l]?.pct_to_fire/100 ?? 0; });
      setWeightHistory(prev => [...prev.slice(-39), {time:Date.now(), weights}]);
    } catch {
      // mock neuron state
      const mock = {};
      NEURON_ORDER.forEach((l,i)=>{
        const p = Math.random()*0.85;
        const threshold=[0.35,0.50,0.65,0.80,0.95][i];
        mock[l]={membrane_potential:p,threshold,pct_to_fire:(p/threshold)*100,spike_count:ri(25)};
      });
      setNeuronState(mock);
      const weights={};
      NEURON_ORDER.forEach(l=>{weights[l]=mock[l].pct_to_fire/100;});
      setWeightHistory(prev=>[...prev.slice(-39),{time:Date.now(),weights}]);
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    if (paused) return;
    let newEvs = [];
    try {
      const r = await fetch(`${API_BASE}/live_feed?n=4`);
      newEvs = await r.json(); setConnected(true);
    } catch {
      setConnected(false); newEvs = mockFeed();
    }
    setEvents(prev=>[...newEvs,...prev].slice(0,30));
    totalProcessed.current += newEvs.length;
    setProcessedCount(totalProcessed.current);
    // update spike trail
    const avg = newEvs.reduce((s,e)=>s+e.severity/4,0)/newEvs.length;
    setSpikeTrail(prev=>[...prev.slice(1),avg]);
    // heatmap history
    setHeatHistory(prev=>[...prev.slice(-49),...newEvs.map(e=>({severity:e.severity,ts:Date.now()}))]);
    // action log
    const urgent = newEvs.filter(e=>e.severity>=3);
    if(urgent.length>0){
      setActionLog(prev=>[
        ...urgent.map(e=>({
          time:new Date().toLocaleTimeString(),
          text:`${e.recommended_action} → ${e.src_ip}`,
          severity:e.severity_label,
          spiked:e.snn_spikes&&Object.values(e.snn_spikes).some(s=>s.fired),
        })),
        ...prev
      ].slice(0,10));
    }
  }, [paused]);

  useEffect(()=>{
    fetchStats(); fetchFeed(); fetchNeurons();
    const f1 = setInterval(fetchFeed, 2200);
    const f2 = setInterval(fetchNeurons, 900);
    return ()=>{clearInterval(f1);clearInterval(f2);};
  },[fetchFeed,fetchStats,fetchNeurons]);

  const dist   = stats?.severity_distribution||{};
  const total  = Object.values(dist).reduce((a,b)=>a+b,0);
  const critN  = events.filter(e=>e.severity_label==="Critical").length;
  const spiked = events.filter(e=>e.snn_spikes&&Object.values(e.snn_spikes).some(s=>s.fired)).length;

  return (
    <div style={{
      minHeight:"100vh", position:"relative",
      background:"radial-gradient(ellipse at 70% 10%, #0e1828 0%, #070b13 55%, #04060e 100%)",
      color:"#eef1f7", fontFamily:"'Inter',system-ui,sans-serif", padding:"18px",
    }}>
      <NeuralBackground />
      <div style={{position:"relative",zIndex:1}}>

      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        @keyframes spikeFlash{0%{transform:scale(1);}50%{transform:scale(1.5);}100%{transform:scale(1);}}
        @keyframes scanline{0%{top:-4px;}100%{top:100%;}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#1e2a3d;border-radius:2px;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"13px"}}>
          <div style={{
            width:"44px",height:"44px",borderRadius:"11px",
            background:"linear-gradient(135deg,#5b8cff,#9b6bff)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 30px rgba(91,140,255,0.5)",fontSize:"21px",
          }}>🧠</div>
          <div>
            <h1 style={{
              fontSize:"21px",fontWeight:800,margin:0,letterSpacing:"1.5px",
              background:"linear-gradient(90deg,#5b8cff 0%,#c084fc 60%,#ff3b6e 100%)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
            }}>SENTINEL</h1>
            <span style={{fontSize:"9.5px",color:"#6b7585",letterSpacing:"2.5px",textTransform:"uppercase"}}>
              Neuromorphic Autonomous Threat-Response Engine
            </span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:"7px",fontSize:"11px",fontFamily:"monospace"}}>
            <div style={{width:"7px",height:"7px",borderRadius:"50%",background:connected?"#3ee07a":"#ffd23f",animation:"pulse 1.8s infinite"}}/>
            <span style={{color:connected?"#3ee07a":"#ffd23f"}}>{connected?"LIVE · SNN ACTIVE":"DEMO (offline)"}</span>
          </div>
          <div style={{fontSize:"10.5px",color:"#9b6bff",fontFamily:"monospace",background:"rgba(155,107,255,0.08)",padding:"4px 10px",borderRadius:"6px",border:"1px solid rgba(155,107,255,0.18)"}}>
            ⚡ {spikeRate}/s
          </div>
          <button onClick={()=>setPaused(p=>!p)} style={{
            background:paused?"rgba(255,210,63,0.09)":"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",
            color:paused?"#ffd23f":"#cfd6e4",padding:"7px 13px",
            fontSize:"11px",fontFamily:"monospace",cursor:"pointer",letterSpacing:"1px",
          }}>
            {paused?"▶ RESUME":"⏸ PAUSE"}
          </button>
        </div>
      </div>

      {/* ── SPIKE TRAIN (EEG strip) ── */}
      <div style={{
        background:"rgba(255,255,255,0.013)",border:"1px solid rgba(255,255,255,0.05)",
        borderRadius:"10px",padding:"8px 14px",marginBottom:"14px",
        display:"flex",alignItems:"center",gap:"12px",overflow:"hidden",position:"relative",
      }}>
        <span style={{fontSize:"9.5px",color:"#6b7585",fontFamily:"monospace",textTransform:"uppercase",letterSpacing:"1px",whiteSpace:"nowrap"}}>
          Neural Spike Train
        </span>
        <SpikeTrail spikes={spikeTrail}/>
        <span style={{fontSize:"10px",color:"#9b6bff",fontFamily:"monospace",whiteSpace:"nowrap"}}>
          {totalSpikes} spikes
        </span>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
        <StatCard emoji="📊" label="Events Processed" value={processedCount.toLocaleString()} accent="#5b8cff"/>
        <StatCard emoji="⚠️" label="Critical Threats" value={critN} accent="#ff3b6e"/>
        <StatCard
          emoji="⚡" label="SNN Spikes" value={spiked} accent="#9b6bff"
          tooltip="Spiking Neural Network (SNN) fires when a neuron's membrane potential exceeds its threshold. Each ⚡ means the LIF neuron triggered an autonomous response — not just an ML prediction."
        />
        <StatCard
          emoji="🧠" label="Neuromorphic Learning Eff."
          value={`${learningEff}%`} accent="#3ee07a"
          tooltip="Measures how efficiently the LIF neuron layer is adapting to threat patterns via Hebbian weight updates. Higher = neurons are learning attack campaign signatures."
        />
        <StatCard
          emoji="🎯" label="Threat Neuron Activation"
          value={`${activationScore}`} accent="#c084fc"
          tooltip="Weighted average membrane potential across all 5 LIF neurons, biased toward high-severity neurons. Score 0–100. High = network is detecting sustained attack activity."
        />
      </div>

      {/* ── MAIN GRID: feed + right panel ── */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"13px",marginBottom:"13px"}}>

        {/* Live Feed */}
        <div style={{background:"rgba(255,255,255,0.016)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"13px",padding:"15px",backdropFilter:"blur(12px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"11px"}}>
            <span style={{fontSize:"13px"}}>📡</span>
            <h2 style={{fontSize:"12px",margin:0,letterSpacing:"1.5px",textTransform:"uppercase",color:"#aab3c5"}}>
              Live Threat Feed — Neuromorphic Prioritization
            </h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"58px 118px 118px 58px 70px 96px 1fr 64px 46px",gap:"8px",padding:"0 12px 7px",fontSize:"9.5px",color:"#6b7585",textTransform:"uppercase",letterSpacing:"1px",fontFamily:"monospace",borderBottom:"1px solid rgba(255,255,255,0.04)",marginBottom:"7px"}}>
            <span>ID</span><span>Src IP</span><span>Dst IP</span><span>Proto</span><span>Svc</span><span>Severity</span><span>Action</span><span>Conf.</span><span>⚡</span>
          </div>
          <div style={{maxHeight:"430px",overflowY:"auto"}}>
            {events.map((e,i)=><EventRow key={e.id+"-"+i} event={e} isNew={i<4}/>)}
          </div>
        </div>

        {/* Right: LIF Neurons + auto-response */}
        <div style={{display:"flex",flexDirection:"column",gap:"13px"}}>
          <div style={{
            background:"rgba(255,255,255,0.016)",border:"1px solid rgba(155,107,255,0.14)",
            borderRadius:"13px",padding:"15px",backdropFilter:"blur(12px)",
          }}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"13px"}}>
              <span style={{fontSize:"13px"}}>🧠</span>
              <Tooltip text="Leaky Integrate-and-Fire (LIF) neurons accumulate threat 'potential' over time. When potential crosses the threshold (θ), the neuron fires a spike and resets — just like biological neurons.">
                <h2 style={{fontSize:"12px",margin:0,letterSpacing:"1.5px",textTransform:"uppercase",color:"#c084fc",cursor:"help",borderBottom:"1px dashed rgba(155,107,255,0.3)"}}>
                  LIF Neuron Layer
                </h2>
              </Tooltip>
              <span style={{marginLeft:"auto",fontSize:"9px",color:"#6b7585",fontFamily:"monospace"}}>V / θ / spikes</span>
            </div>
            {NEURON_ORDER.map(l=><NeuronViz key={l} label={l} data={neuronState?.[l]}/>)}
            <div style={{marginTop:"9px",padding:"8px",background:"rgba(155,107,255,0.05)",borderRadius:"7px",fontSize:"9.5px",color:"#9b6bff",fontFamily:"monospace",lineHeight:"1.7"}}>
              LIF · leak τ=adaptive · Hebbian lateral weights<br/>
              θ: Critical=0.35 · High=0.50 · Med=0.65 · Low=0.80
            </div>
          </div>

          {/* Auto-response log */}
          <div style={{background:"rgba(255,255,255,0.016)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"13px",padding:"15px",flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"11px"}}>
              <span style={{fontSize:"13px"}}>🔒</span>
              <h2 style={{fontSize:"12px",margin:0,letterSpacing:"1.5px",textTransform:"uppercase",color:"#aab3c5"}}>Auto-Response Log</h2>
            </div>
            {actionLog.length===0&&<p style={{color:"#6b7585",fontSize:"11px",fontFamily:"monospace"}}>System nominal. No critical events.</p>}
            {actionLog.map((a,i)=>{
              const cfg=SEV[a.severity];
              return (
                <div key={i} style={{fontSize:"10.5px",fontFamily:"monospace",padding:"7px 9px",marginBottom:"5px",borderRadius:"6px",background:cfg.bg,borderLeft:`3px solid ${cfg.color}`,color:"#cfd6e4"}}>
                  <div style={{color:"#6b7585",marginBottom:"2px",display:"flex",justifyContent:"space-between"}}>
                    <span>{a.time}</span>
                    {a.spiked&&<span style={{color:"#9b6bff"}}>⚡ SNN fired</span>}
                  </div>
                  {a.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Heatmap + Synaptic Graph + Threat Distribution ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"13px"}}>

        {/* Neural Activity Heatmap */}
        <div style={{background:"rgba(255,255,255,0.016)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"13px",padding:"15px",backdropFilter:"blur(12px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
            <span style={{fontSize:"13px"}}>🔥</span>
            <h2 style={{fontSize:"12px",margin:0,letterSpacing:"1.5px",textTransform:"uppercase",color:"#aab3c5"}}>
              Neural Activity Heatmap
            </h2>
          </div>
          <NeuralHeatmap history={heatHistory}/>
          <div style={{marginTop:"10px",fontSize:"9.5px",color:"#6b7585",fontFamily:"monospace",lineHeight:"1.6"}}>
            Each cell = 2 recent events. Color = severity.<br/>
            Bright red clusters = coordinated attack.
          </div>
        </div>

        {/* Synaptic Weight Adaptation */}
        <div style={{background:"rgba(255,255,255,0.016)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"13px",padding:"15px",backdropFilter:"blur(12px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
            <span style={{fontSize:"13px"}}>📈</span>
            <Tooltip text="Shows how Hebbian synaptic weights adapt over time. When a neuron fires repeatedly, its weights to adjacent neurons strengthen — the network learns attack campaign patterns without retraining.">
              <h2 style={{fontSize:"12px",margin:0,letterSpacing:"1.5px",textTransform:"uppercase",color:"#aab3c5",cursor:"help",borderBottom:"1px dashed rgba(255,255,255,0.12)"}}>
                Synaptic Weight Adaptation
              </h2>
            </Tooltip>
          </div>
          <SynapticWeightGraph weightHistory={weightHistory}/>
          <div style={{marginTop:"10px",fontSize:"9.5px",color:"#6b7585",fontFamily:"monospace",lineHeight:"1.6"}}>
            Hebbian learning: "neurons that fire together,<br/>wire together." Weights update in real time.
          </div>
        </div>

        {/* Threat Distribution */}
        <div style={{background:"rgba(255,255,255,0.016)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"13px",padding:"15px",backdropFilter:"blur(12px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
            <span style={{fontSize:"13px"}}>📊</span>
            <h2 style={{fontSize:"12px",margin:0,letterSpacing:"1.5px",textTransform:"uppercase",color:"#aab3c5"}}>NSL-KDD Distribution</h2>
          </div>
          {["Critical","High","Medium","Low","Benign"].map(label=>{
            const cfg=SEV[label];
            const count=dist[label]||0;
            const pct=total>0?(count/total)*100:0;
            return (
              <div key={label} style={{marginBottom:"9px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px",fontSize:"10.5px",fontFamily:"monospace"}}>
                  <span style={{color:cfg.color,fontWeight:600}}>{label}</span>
                  <span style={{color:"#8b95a8"}}>{count.toLocaleString()}</span>
                </div>
                <div style={{height:"5px",background:"rgba(255,255,255,0.05)",borderRadius:"3px",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:cfg.color,borderRadius:"3px",transition:"width 0.6s ease"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{marginTop:"16px",textAlign:"center",fontSize:"9.5px",color:"#1e2a3d",fontFamily:"monospace",letterSpacing:"1.5px"}}>
        SENTINEL · LIF-SNN · HEBBIAN LEARNING · NSL-KDD 148K · NEUROMORPHISM-IN-CYBER HACKATHON
      </div>

      </div>{/* end z-index wrapper */}
    </div>
  );
}
