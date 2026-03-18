"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { getApiBase, getToken } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
type Role     = "user" | "assistant";
type MsgState = "typing" | "done" | "error";

interface ToolResult {
  name: string; success: boolean; output: string; image?: string;
}
interface Message {
  id: string; role: Role; text: string; time: Date;
  state?: MsgState; toolResults?: ToolResult[]; imageData?: string;
}

// ── Web Speech API types ───────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: unknown;
    webkitSpeechRecognition: unknown;
  }
}

// ── JARVIS Tools ───────────────────────────────────────────────────────────
const JARVIS_TOOLS = [
  { name:"screenshot",    description:"Ambil screenshot layar PC. Pakai saat user minta lihat layar.", input_schema:{type:"object",properties:{},required:[]} },
  { name:"get_status",    description:"Info sistem: CPU, RAM, disk, baterai, IP.",                    input_schema:{type:"object",properties:{},required:[]} },
  { name:"open_app",      description:"Buka aplikasi di PC.",                                         input_schema:{type:"object",properties:{app:{type:"string"}},required:["app"]} },
  { name:"close_app",     description:"Tutup aplikasi.",                                              input_schema:{type:"object",properties:{app:{type:"string"}},required:["app"]} },
  { name:"set_volume",    description:"Set volume 0-100.",                                            input_schema:{type:"object",properties:{level:{type:"number"}},required:["level"]} },
  { name:"type_text",     description:"Ketik teks di kursor aktif.",                                  input_schema:{type:"object",properties:{text:{type:"string"}},required:["text"]} },
  { name:"press_key",     description:"Tekan tombol keyboard.",                                       input_schema:{type:"object",properties:{key:{type:"string"}},required:["key"]} },
  { name:"run_command",   description:"Jalankan perintah PowerShell.",                                input_schema:{type:"object",properties:{cmd:{type:"string"}},required:["cmd"]} },
  { name:"speak",         description:"JARVIS bicara keras di PC target.",                            input_schema:{type:"object",properties:{text:{type:"string"}},required:["text"]} },
  { name:"lock_pc",       description:"Kunci layar PC.",                                              input_schema:{type:"object",properties:{},required:[]} },
  { name:"get_clipboard", description:"Baca clipboard PC.",                                           input_schema:{type:"object",properties:{},required:[]} },
  { name:"webcam",        description:"Foto dari webcam.",                                            input_schema:{type:"object",properties:{},required:[]} },
  { name:"show_popup",    description:"Tampilkan popup di PC.",                                       input_schema:{type:"object",properties:{title:{type:"string"},message:{type:"string"}},required:["title","message"]} },
  // Vault tools
  { name:"vault_save",    description:"Simpan data/catatan/kontak/reminder ke JARVIS vault. Gunakan saat user minta simpan sesuatu.",
    input_schema:{type:"object",properties:{
      type:{type:"string",enum:["note","contact","reminder","snippet"],description:"Tipe data"},
      title:{type:"string",description:"Judul/nama"},
      content:{type:"string",description:"Isi data"},
      tags:{type:"string",description:"Tag opsional, pisah koma"},
    },required:["type","title","content"]} },
  { name:"vault_search",  description:"Cari data di JARVIS vault.",
    input_schema:{type:"object",properties:{query:{type:"string"}},required:["query"]} },
  { name:"vault_list",    description:"Tampilkan semua item di vault berdasarkan tipe.",
    input_schema:{type:"object",properties:{type:{type:"string",enum:["note","contact","reminder","snippet","all"]}},required:["type"]} },
];

const SYSTEM_PROMPT = `Kamu adalah JARVIS — AI assistant Iron Man yang mengontrol PC Windows dari jarak jauh.

Kepribadian: cerdas, sedikit sarkastis, helpful, bicara bahasa Indonesia natural dan ringkas.
Konfirmasi aksi berbahaya (shutdown, hapus file).

Kemampuan tambahan — JARVIS Vault:
- Bisa simpan catatan, kontak, reminder, dan kode program
- Saat user minta "simpan", "catat", "ingat ini" → gunakan vault_save
- Saat user minta "cari", "ingat kamu simpan" → gunakan vault_search
- Saat user minta "tampilkan" data → gunakan vault_list

Instruksi penting:
- Jika ada tools yang relevan, SELALU gunakan — jangan hanya teks
- Setelah eksekusi tool, laporan hasil dengan ringkas
- Untuk voice mode: respons lebih pendek dan conversational
- Ingat konteks percakapan sebelumnya`;

// ── Helpers ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,9);

function useWindowWidth() {
  const [w,setW] = useState(0);
  useEffect(()=>{
    const u=()=>setW(window.innerWidth); u();
    window.addEventListener("resize",u);
    return ()=>window.removeEventListener("resize",u);
  },[]);
  return w;
}

// ── JARVIS API ─────────────────────────────────────────────────────────────
async function callJarvisTool(tool:string, params:Record<string,unknown>): Promise<ToolResult> {
  const base=getApiBase(), token=getToken();
  const map:Record<string,string> = {
    screenshot:"screenshot",get_status:"get_status",open_app:"open_app",
    close_app:"close_app",set_volume:"set_volume",type_text:"type_text",
    press_key:"press_key",run_command:"run_cmd",speak:"speak",
    lock_pc:"lock",get_clipboard:"clipboard_get",webcam:"webcam",
    show_popup:"popup",vault_save:"vault_save",vault_search:"vault_search",vault_list:"vault_list",
  };
  try {
    const resp = await fetch(`${base}/api/control`,{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({action:map[tool]||tool,params}),
    });
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as Record<string,unknown>;
    if(data.error) throw new Error(data.error as string);
    let output="", image:string|undefined;
    if(tool==="get_status") {
      output=[`CPU: ${data.cpu_percent??'?'}%`,`RAM: ${data.ram_used_mb??'?'}MB/${data.ram_total_mb??'?'}MB`,
              `Disk: ${data.disk_used_gb??'?'}GB/${data.disk_total_gb??'?'}GB`,
              `Baterai: ${data.battery_percent!=null?data.battery_percent+'%':'N/A'}`,
              `IP: ${data.local_ip??'?'}`].join("\n");
    } else if((tool==="screenshot"||tool==="webcam")&&data.image) {
      image=data.image as string; output=`${tool==="screenshot"?"Screenshot":"Webcam"} berhasil.`;
    } else if(tool==="vault_save") {
      output=`✅ Tersimpan: ${params.title}`;
    } else if(tool==="vault_search"||tool==="vault_list") {
      const items = data.items as Array<{title:string;content:string;type:string}>|undefined;
      if(items && items.length>0) {
        output=items.map((it,i)=>`${i+1}. [${it.type}] ${it.title}: ${it.content.slice(0,100)}`).join("\n");
      } else { output="Tidak ada data ditemukan."; }
    } else { output=(data.output as string)||"Berhasil."; }
    return {name:tool,success:true,output,image};
  } catch(e:unknown) {
    return {name:tool,success:false,output:`Gagal: ${e instanceof Error?e.message:String(e)}`};
  }
}

// ── Claude API ─────────────────────────────────────────────────────────────
async function callClaude(
  messages:Array<{role:string;content:string}>, claudeKey:string,
  onTool:(t:string,p:Record<string,unknown>)=>Promise<ToolResult>,
):Promise<{text:string;toolResults:ToolResult[]}> {
  const allResults:ToolResult[]=[];
  const resp = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":claudeKey,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514",max_tokens:1024,
      system:SYSTEM_PROMPT,
      tools:JARVIS_TOOLS.map(t=>({name:t.name,description:t.description,input_schema:t.input_schema})),
      messages:messages.map(m=>({role:m.role as "user"|"assistant",content:m.content})),
    }),
  });
  if(!resp.ok) throw new Error(`Claude ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as {
    content:Array<{type:string;text?:string;id?:string;name?:string;input?:Record<string,unknown>}>;
    stop_reason:string;
  };
  if(data.stop_reason==="tool_use") {
    const toolBlocks=data.content.filter(b=>b.type==="tool_use");
    const txtBlocks=data.content.filter(b=>b.type==="text");
    const toolResults:Array<{type:string;tool_use_id:string;content:string}>=[];
    for(const b of toolBlocks) {
      if(b.name&&b.input){
        const r=await onTool(b.name,b.input); allResults.push(r);
        toolResults.push({type:"tool_result",tool_use_id:b.id!,content:r.success?r.output:`Error: ${r.output}`});
      }
    }
    const follow=await callClaude(
      [...messages,{role:"assistant",content:JSON.stringify(data.content)},{role:"user",content:JSON.stringify(toolResults)}],
      claudeKey,onTool,
    );
    const prefix=txtBlocks.map(b=>b.text||"").join(" ").trim();
    return {text:prefix?`${prefix}\n\n${follow.text}`:follow.text,toolResults:[...allResults,...follow.toolResults]};
  }
  return {text:data.content.filter(b=>b.type==="text").map(b=>b.text||"").join("")||"…",toolResults:allResults};
}

// ── Gemini API ─────────────────────────────────────────────────────────────
async function callGemini(
  messages:Array<{role:string;content:string}>, geminiKey:string,
  onTool:(t:string,p:Record<string,unknown>)=>Promise<ToolResult>,
):Promise<{text:string;toolResults:ToolResult[]}> {
  const allResults:ToolResult[]=[];
  const history=messages.slice(0,-1).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
  const last=messages[messages.length-1];
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({
       system_instruction:{parts:[{text:SYSTEM_PROMPT}]},
       contents:[...history,{role:"user",parts:[{text:last.content}]}],
       tools:[{functionDeclarations:JARVIS_TOOLS.map(t=>({name:t.name,description:t.description,parameters:t.input_schema}))}],
       generationConfig:{maxOutputTokens:1024},
     })},
  );
  if(!resp.ok) throw new Error(`Gemini ${resp.status}`);
  const data = await resp.json() as {candidates?:Array<{content?:{parts?:Array<{text?:string;functionCall?:{name:string;args:Record<string,unknown>}}>}}>};
  const parts=data.candidates?.[0]?.content?.parts??[];
  const fcParts=parts.filter(p=>p.functionCall), txtParts=parts.filter(p=>p.text);
  if(fcParts.length>0) {
    const fnResp:Array<{functionResponse:{name:string;response:{result:string}}}>=[];
    for(const p of fcParts) {
      const fc=p.functionCall!; const r=await onTool(fc.name,fc.args); allResults.push(r);
      fnResp.push({functionResponse:{name:fc.name,response:{result:r.output}}});
    }
    const follow=await callGemini(
      [...messages,{role:"assistant",content:fcParts.map(p=>`[${p.functionCall?.name}]`).join(" ")},{role:"user",content:JSON.stringify(fnResp)}],
      geminiKey,onTool,
    );
    const prefix=txtParts.map(p=>p.text||"").join(" ").trim();
    return {text:prefix?`${prefix}\n\n${follow.text}`:follow.text,toolResults:[...allResults,...follow.toolResults]};
  }
  return {text:txtParts.map(p=>p.text||"").join("").trim()||"…",toolResults:allResults};
}

// ── Voice hook ─────────────────────────────────────────────────────────────
function useVoice(onResult:(text:string)=>void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<unknown>(null);

  useEffect(()=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  },[]);

  const start = useCallback(()=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart  = ()=>setListening(true);
    rec.onend    = ()=>setListening(false);
    rec.onerror  = ()=>setListening(false);
    rec.onresult = (e:unknown)=>{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = (e as any).results[0][0].transcript as string;
      if(transcript) onResult(transcript);
    };
    recRef.current = rec;
    rec.start();
  },[onResult]);

  const stop = useCallback(()=>{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recRef.current as any)?.stop?.();
    setListening(false);
  },[]);

  return {listening, supported, start, stop};
}

// ── TTS — JARVIS speaks back ───────────────────────────────────────────────
function speakText(text:string) {
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g,""));
  utt.lang = "id-ID"; utt.rate = 1.05; utt.pitch = 0.9;
  // Try to pick a good Indonesian voice
  const voices = window.speechSynthesis.getVoices();
  const idVoice = voices.find(v=>v.lang.startsWith("id"))||
                  voices.find(v=>v.lang.startsWith("en-GB"))||
                  voices[0];
  if(idVoice) utt.voice = idVoice;
  window.speechSynthesis.speak(utt);
}

// ── Sub-components ─────────────────────────────────────────────────────────
function ToolPill({result}:{result:ToolResult}) {
  const [open,setOpen]=useState(false);
  const icons:Record<string,string>={
    screenshot:"📸",webcam:"📷",get_status:"📊",open_app:"🚀",close_app:"✕",
    set_volume:"🔊",type_text:"⌨️",press_key:"↵",run_command:"💻",
    speak:"🗣️",lock_pc:"🔒",get_clipboard:"📋",show_popup:"💬",
    vault_save:"💾",vault_search:"🔍",vault_list:"📋",
  };
  const ok=result.success;
  return (
    <div style={{marginBottom:4}}>
      <button onClick={()=>setOpen(v=>!v)} style={{
        background:ok?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",
        border:`1px solid ${ok?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)"}`,
        borderRadius:6,padding:"3px 10px",fontSize:"0.68rem",fontWeight:600,
        color:ok?"#22c55e":"#ef4444",cursor:"pointer",fontFamily:"inherit",
        display:"flex",alignItems:"center",gap:5,
      }}>
        <span>{icons[result.name]??"⚡"}</span>
        <span>{result.name}</span>
        <span style={{opacity:0.5}}>{ok?"✓":"✗"}</span>
        <span style={{opacity:0.3,fontSize:"0.6rem"}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{marginTop:3,padding:"6px 10px",background:"rgba(0,0,0,0.35)",
          border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,
          fontFamily:"monospace",fontSize:"0.68rem",color:"rgba(226,232,240,0.6)",
          whiteSpace:"pre-wrap",maxHeight:100,overflowY:"auto"}}>
          {result.output}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{display:"flex",gap:4,padding:"4px 0"}}>
      {[0,1,2].map(i=>(
        <span key={i} style={{width:7,height:7,borderRadius:"50%",
          background:"rgba(0,212,255,0.7)",display:"inline-block",
          animation:`jv-dot 1.2s ease ${i*0.2}s infinite`}}/>
      ))}
    </div>
  );
}

function Bubble({msg,isMobile}:{msg:Message;isMobile:boolean}) {
  const isUser=msg.role==="user", isErr=msg.state==="error";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:isUser?"flex-end":"flex-start",
      gap:5,animation:"jv-up 0.25s ease both"}}>
      {!isUser&&msg.toolResults&&msg.toolResults.length>0&&(
        <div style={{paddingLeft:42}}>
          {msg.toolResults.map((r,i)=><ToolPill key={i} result={r}/>)}
        </div>
      )}
      {msg.imageData&&(
        <div style={{maxWidth:isMobile?"93%":"76%",paddingLeft:isUser?0:42}}>
          <img src={msg.imageData} alt="capture"
            style={{width:"100%",borderRadius:10,border:"1px solid rgba(0,212,255,0.2)"}}/>
        </div>
      )}
      <div style={{display:"flex",alignItems:"flex-end",gap:10}}>
        {!isUser&&(
          <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,
            background:isErr?"rgba(239,68,68,0.12)":"linear-gradient(135deg,rgba(0,212,255,0.3),rgba(124,58,237,0.3))",
            border:`1px solid ${isErr?"rgba(239,68,68,0.3)":"rgba(0,212,255,0.3)"}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem"}}>
            {isErr?"⚠️":"🤖"}
          </div>
        )}
        <div style={{
          maxWidth:isMobile?"84%":"70%",
          background:isUser?"linear-gradient(135deg,rgba(0,212,255,0.18),rgba(124,58,237,0.18))":isErr?"rgba(239,68,68,0.06)":"rgba(255,255,255,0.04)",
          border:`1px solid ${isUser?"rgba(0,212,255,0.28)":isErr?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.07)"}`,
          borderRadius:isUser?"16px 16px 4px 16px":"16px 16px 16px 4px",
          padding:"9px 13px",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
            <span style={{fontSize:"0.63rem",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",
              color:isUser?"rgba(0,212,255,0.65)":isErr?"#ef4444":"rgba(226,232,240,0.35)"}}>
              {isUser?"Kamu":"JARVIS"}
            </span>
            <span style={{fontSize:"0.6rem",color:"rgba(226,232,240,0.22)",marginLeft:"auto"}}>
              {msg.time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
            </span>
          </div>
          {msg.state==="typing"?<TypingDots/>:
            <div style={{fontSize:"0.86rem",color:isErr?"#fca5a5":"#e2e8f0",whiteSpace:"pre-wrap",lineHeight:1.6,wordBreak:"break-word"}}>
              {msg.text}
            </div>}
        </div>
        {isUser&&(
          <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,
            background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.22)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem"}}>👤</div>
        )}
      </div>
    </div>
  );
}

// ── Mic button ─────────────────────────────────────────────────────────────
function MicButton({listening,supported,onStart,onStop}:{
  listening:boolean; supported:boolean; onStart:()=>void; onStop:()=>void;
}) {
  if(!supported) return null;
  return (
    <button onClick={listening?onStop:onStart}
      title={listening?"Stop recording":"Bicara ke JARVIS"}
      style={{
        width:40,height:40,flexShrink:0,borderRadius:"50%",
        border:`1px solid ${listening?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"}`,
        background:listening?"rgba(239,68,68,0.15)":"rgba(255,255,255,0.04)",
        color:listening?"#ef4444":"rgba(226,232,240,0.4)",
        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:"1rem",transition:"all 0.2s",
        boxShadow:listening?"0 0 12px rgba(239,68,68,0.3)":"none",
        animation:listening?"jv-mic-pulse 1.5s ease infinite":"none",
      } as React.CSSProperties}>
      {listening?"⏹":"🎤"}
    </button>
  );
}

// ── Voice mode toggle ──────────────────────────────────────────────────────
function VoiceModeBanner({active,onToggle}:{active:boolean;onToggle:()=>void}) {
  if(!active) return null;
  return (
    <div style={{
      background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
      borderRadius:10,padding:"8px 14px",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      animation:"jv-up 0.2s ease both",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",
          display:"inline-block",animation:"jv-mic-pulse 1.5s ease infinite"}}/>
        <span style={{fontSize:"0.78rem",fontWeight:600,color:"#ef4444"}}>
          Voice Mode Aktif
        </span>
        <span style={{fontSize:"0.7rem",color:"rgba(226,232,240,0.4)"}}>
          — JARVIS mendengarkan dan membalas dengan suara
        </span>
      </div>
      <button onClick={onToggle} style={{
        background:"none",border:"none",color:"rgba(226,232,240,0.4)",
        cursor:"pointer",fontSize:"0.75rem",fontFamily:"inherit",
      }}>
        Matikan
      </button>
    </div>
  );
}

const QUICK=[
  {label:"📸 Screenshot", text:"Ambil screenshot sekarang"},
  {label:"📊 Status PC",  text:"Cek status PC"},
  {label:"🌐 Buka Chrome",text:"Buka Chrome"},
  {label:"🔊 Volume 80",  text:"Set volume ke 80"},
  {label:"💾 Simpan Note",text:"Simpan catatan: ini adalah catatan test dari JARVIS"},
  {label:"🔍 Cari Data",  text:"Cari data yang pernah aku simpan"},
  {label:"📋 Clipboard",  text:"Baca isi clipboard"},
  {label:"📷 Webcam",     text:"Ambil foto dari webcam"},
];

const WELCOME:Message={
  id:"welcome",role:"assistant",time:new Date(),state:"done",
  text:"Selamat datang. Saya JARVIS.\n\nBicara saja secara natural — saya akan mengerti dan langsung mengeksekusi.\n\nAnda juga bisa minta saya menyimpan data: \"simpan nomor telepon Budi: 08123456789\" atau \"catat: password wifi rumah adalah abc123\"",
};

export default function AIChat() {
  const [messages,   setMessages]   = useState<Message[]>([WELCOME]);
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [aiEngine,   setAiEngine]   = useState<"auto"|"claude"|"gemini">("auto");
  const [showConfig, setShowConfig] = useState(false);
  const [claudeKey,  setClaudeKey]  = useState("");
  const [geminiKey,  setGeminiKey]  = useState("");
  const [voiceMode,  setVoiceMode]  = useState(false);  // auto-listen + TTS response
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const winW     = useWindowWidth();
  const isMob    = winW>0&&winW<640;

  useEffect(()=>{
    try{
      setClaudeKey(sessionStorage.getItem("jv_ck")||"");
      setGeminiKey(sessionStorage.getItem("jv_gk")||"");
    }catch{}
  },[]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  useEffect(()=>{
    const el=inputRef.current; if(!el) return;
    el.style.height="auto";
    el.style.height=Math.min(el.scrollHeight,120)+"px";
  },[input]);

  const history = useMemo(()=>
    messages.filter(m=>m.state==="done"&&m.id!=="welcome")
      .map(m=>({role:m.role as "user"|"assistant",content:m.text})),
    [messages]);

  // ── Send ──────────────────────────────────────────────────────────────
  const send = useCallback(async(overrideText?:string)=>{
    const text=(overrideText||input).trim();
    if(!text||loading) return;
    const userMsg:Message={id:uid(),role:"user",text,time:new Date(),state:"done"};
    setMessages(prev=>[...prev,userMsg]);
    if(!overrideText) setInput("");
    setLoading(true);
    const typingId=uid();
    setMessages(prev=>[...prev,{id:typingId,role:"assistant",text:"",time:new Date(),state:"typing"}]);

    const msgs=[...history,{role:"user" as const,content:text}];
    const onTool=(t:string,p:Record<string,unknown>)=>callJarvisTool(t,p);

    try {
      let result:{text:string;toolResults:ToolResult[]};
      const engine=aiEngine==="auto"?(claudeKey?"claude":geminiKey?"gemini":"builtin"):aiEngine;

      if(engine==="claude"&&claudeKey) {
        result=await callClaude(msgs,claudeKey,onTool);
      } else if(engine==="gemini"&&geminiKey) {
        result=await callGemini(msgs,geminiKey,onTool);
      } else {
        const base=getApiBase(),token=getToken();
        const resp=await fetch(`${base}/api/ai/chat`,{
          method:"POST",
          headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
          body:JSON.stringify({message:text,history}),
        });
        const data=await resp.json() as {response?:string;action?:string;params?:Record<string,unknown>};
        result={text:data.response||"…",toolResults:[]};
        if(data.action){const tr=await callJarvisTool(data.action,data.params||{});result.toolResults.push(tr);}
      }

      const imgResult=result.toolResults.find(r=>r.image);
      setMessages(prev=>prev.map(m=>m.id!==typingId?m:{
        ...m,text:result.text,state:"done",toolResults:result.toolResults,
        imageData:imgResult?.image?`data:image/png;base64,${imgResult.image}`:undefined,
      }));

      // Voice mode: speak response
      if(voiceMode && result.text) {
        // Only speak first 200 chars to avoid very long TTS
        speakText(result.text.slice(0,200));
      }
    } catch(e:unknown) {
      const err=e instanceof Error?e.message:String(e);
      setMessages(prev=>prev.map(m=>m.id!==typingId?m:{
        ...m,text:`Gagal: ${err}`,state:"error",
      }));
    } finally {
      setLoading(false);
      setTimeout(()=>inputRef.current?.focus(),50);
      // Voice mode: auto-start listening again after response
      if(voiceMode && !overrideText) {
        setTimeout(()=>voice.start(),1200);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[input,loading,history,aiEngine,claudeKey,geminiKey,voiceMode]);

  // ── Voice ──────────────────────────────────────────────────────────────
  const voice = useVoice(useCallback((transcript:string)=>{
    send(transcript);
  },[send]));

  const handleVoiceMode = () => {
    const next = !voiceMode;
    setVoiceMode(next);
    if(next) voice.start();
    else     voice.stop();
  };

  const saveKeys=()=>{
    try{sessionStorage.setItem("jv_ck",claudeKey);sessionStorage.setItem("jv_gk",geminiKey);}catch{}
    setShowConfig(false);
  };

  return (
    <>
      <style>{`
        @keyframes jv-dot{0%,80%,100%{transform:scale(0.7);opacity:0.4;}40%{transform:scale(1.1);opacity:1;}}
        @keyframes jv-up{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
        @keyframes jv-mic-pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
      `}</style>

      <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 140px)",minHeight:460,gap:10}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <h2 style={{fontSize:"1rem",fontWeight:700,color:"#e2e8f0",margin:"0 0 2px"}}>🤖 JARVIS AI</h2>
            <p style={{fontSize:"0.68rem",color:"rgba(226,232,240,0.35)",margin:0}}>
              Ngobrol natural · eksekusi otomatis · simpan data
            </p>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {/* Engine */}
            <div style={{display:"flex",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,overflow:"hidden"}}>
              {(["auto","claude","gemini"] as const).map(e=>(
                <button key={e} onClick={()=>setAiEngine(e)} style={{
                  fontSize:"0.68rem",padding:"4px 9px",border:"none",
                  background:aiEngine===e?"rgba(0,212,255,0.2)":"transparent",
                  color:aiEngine===e?"#00d4ff":"rgba(226,232,240,0.4)",
                  fontWeight:aiEngine===e?700:400,cursor:"pointer",fontFamily:"inherit",
                }}>{e==="auto"?"Auto":e==="claude"?"Claude":"Gemini"}</button>
              ))}
            </div>
            {/* Voice mode toggle */}
            {voice.supported&&(
              <button onClick={handleVoiceMode} style={{
                background:voiceMode?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.04)",
                border:`1px solid ${voiceMode?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.08)"}`,
                color:voiceMode?"#ef4444":"rgba(226,232,240,0.5)",
                borderRadius:7,padding:"4px 10px",fontSize:"0.72rem",fontWeight:600,
                cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,
              }}>
                {voiceMode?"🔴 Voice On":"🎤 Voice Mode"}
              </button>
            )}
            <button onClick={()=>setShowConfig(v=>!v)} style={{
              background:showConfig?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.04)",
              border:`1px solid ${showConfig?"rgba(0,212,255,0.25)":"rgba(255,255,255,0.08)"}`,
              color:showConfig?"#00d4ff":"rgba(226,232,240,0.4)",
              borderRadius:7,padding:"4px 9px",fontSize:"0.72rem",cursor:"pointer",fontFamily:"inherit",
            }}>⚙️</button>
            <button onClick={()=>setMessages([{...WELCOME,time:new Date()}])} style={{
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              color:"rgba(226,232,240,0.4)",borderRadius:7,padding:"4px 9px",
              fontSize:"0.72rem",cursor:"pointer",fontFamily:"inherit",
            }}>🧹</button>
          </div>
        </div>

        {/* Voice mode banner */}
        <VoiceModeBanner active={voiceMode} onToggle={handleVoiceMode}/>

        {/* Config */}
        {showConfig&&(
          <div style={{background:"rgba(6,10,22,0.95)",border:"1px solid rgba(0,212,255,0.15)",
            borderRadius:12,padding:14,animation:"jv-up 0.2s ease both"}}>
            <p style={{fontSize:"0.7rem",color:"rgba(226,232,240,0.38)",marginBottom:10}}>
              Kosongkan untuk pakai AI bawaan JARVIS. Keys disimpan di session saja.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {([
                {label:"Claude (Anthropic)",value:claudeKey,set:setClaudeKey,ph:"sk-ant-..."},
                {label:"Gemini (Google)",value:geminiKey,set:setGeminiKey,ph:"AIza..."},
              ] as const).map(({label,value,set,ph})=>(
                <div key={label} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:"0.68rem",color:"rgba(226,232,240,0.4)",width:130,flexShrink:0}}>{label}</span>
                  <input type="password" value={value} onChange={e=>(set as (v:string)=>void)(e.target.value)} placeholder={ph}
                    style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:6,padding:"6px 10px",color:"#e2e8f0",fontSize:"0.78rem",
                      fontFamily:"monospace",outline:"none"}}/>
                </div>
              ))}
              <button onClick={saveKeys} style={{
                background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.25)",color:"#00d4ff",
                borderRadius:7,padding:"6px 14px",fontSize:"0.76rem",fontWeight:600,
                cursor:"pointer",fontFamily:"inherit",alignSelf:"flex-start",
              }}>💾 Simpan</button>
            </div>
          </div>
        )}

        {/* Quick chips */}
        <div style={{display:"flex",flexWrap:"wrap",gap:5,
          maxHeight:isMob?58:"none",overflowY:isMob?"auto":"visible"}}>
          {QUICK.map(q=>(
            <button key={q.text} onClick={()=>{setInput(q.text);inputRef.current?.focus();}} style={{
              background:"rgba(0,212,255,0.05)",border:"1px solid rgba(0,212,255,0.13)",
              color:"rgba(0,212,255,0.75)",borderRadius:20,padding:"3px 10px",
              fontSize:"0.68rem",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",
            }}>{q.label}</button>
          ))}
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",display:"flex",flexDirection:"column",
          gap:12,background:"rgba(4,8,18,0.7)",borderRadius:14,padding:"14px",
          border:"1px solid rgba(0,212,255,0.07)",boxShadow:"inset 0 0 24px rgba(0,0,0,0.3)"}}>
          {messages.map(msg=><Bubble key={msg.id} msg={msg} isMobile={isMob}/>)}
          <div ref={endRef}/>
        </div>

        {/* Input bar */}
        <div style={{display:"flex",gap:8,alignItems:"flex-end",
          background:"rgba(4,8,18,0.9)",
          border:`1px solid rgba(0,212,255,${input.trim()?"0.38":"0.16"})`,
          borderRadius:16,padding:"8px 12px",transition:"all 0.2s",
          boxShadow:input.trim()?"0 0 16px rgba(0,212,255,0.06)":"none"}}>
          <textarea ref={inputRef} value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder={voiceMode?"Voice mode aktif — atau ketik di sini...":"Ketik perintah atau pertanyaan..."}
            rows={1} disabled={loading}
            style={{flex:1,background:"none",border:"none",outline:"none",color:"#e2e8f0",
              fontSize:"0.88rem",resize:"none",maxHeight:120,minHeight:24,lineHeight:1.5,
              padding:"5px 0",fontFamily:"inherit",caretColor:"#00d4ff",opacity:loading?0.5:1}}/>
          <MicButton
            listening={voice.listening} supported={voice.supported}
            onStart={voice.start} onStop={voice.stop}/>
          <button onClick={()=>send()} disabled={loading||!input.trim()}
            style={{width:38,height:38,flexShrink:0,borderRadius:"50%",
              border:`1px solid ${loading||!input.trim()?"rgba(255,255,255,0.08)":"rgba(0,212,255,0.38)"}`,
              background:loading||!input.trim()?"rgba(255,255,255,0.04)":"rgba(0,212,255,0.14)",
              color:loading||!input.trim()?"rgba(226,232,240,0.2)":"#00d4ff",
              cursor:loading||!input.trim()?"not-allowed":"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"0.95rem",transition:"all 0.2s"} as React.CSSProperties}>
            {loading
              ?<span style={{width:13,height:13,borderRadius:"50%",border:"2px solid rgba(0,212,255,0.3)",
                  borderTopColor:"#00d4ff",display:"inline-block",animation:"jv-dot 0.7s linear infinite"}}/>
              :"➤"}
          </button>
        </div>

        <p style={{fontSize:"0.63rem",color:"rgba(226,232,240,0.18)",textAlign:"center",margin:0}}>
          Enter kirim · Shift+Enter baris baru · 🎤 voice · simpan data: "catat nomor Budi: 08xxx"
        </p>
      </div>
    </>
  );
}