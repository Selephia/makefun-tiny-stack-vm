import fs from'node:fs';import path from'node:path';
const M=new Uint8Array(256);
M[0]=1;M[1]=66;M[2]=69;M[3]=9;M[4]=137;M[5]=145;M[6]=209;M[7]=217;
for(let i=0x10;i<=0x16;i++)M[i]=81;
M[0x17]=73;
for(let i=0x18;i<=0x1a;i++)M[i]=81;
M[0x1b]=73;
for(let i=0x1c;i<=0x1e;i++)M[i]=81;
for(let i=0x20;i<=0x22;i++)M[i]=81;
M[0x30]=3;M[0x31]=M[0x32]=11;M[0x33]=3;M[0x34]=1;
M[0x40]=73;M[0x41]=17;
M[0x50]=M[0x51]=M[0x53]=9;M[0x52]=65;

function vm(p,input){
 const s=new Int32Array(256),c=new Int32Array(64),mem=new Int32Array(256),out=new Uint8Array(65536);
 let sp=0,cp=0,pc=0,ip=0,ol=0,st=0,ec=0;
 const n=p.length;
 L:for(;;){
  if(st===1000000){ec=10;break L}
  if(pc<0||pc>=n){ec=9;break L}
  const op=p[pc];let z=M[op];
  if(!z){ec=5;break L}
  --z;
  const im=z&7,po=(z>>3)&7,pu=z>>6;
  if(pc+im>=n){ec=9;break L}
  if(sp<po){ec=2;break L}
  if(sp-po+pu>256){ec=3;break L}
  st++;
  let np=pc+1+im;
  switch(op){
   case 0:ec=0;break L;
   case 1:s[sp++]=(p[pc+1]<<24)>>24;break;
   case 2:s[sp++]=p[pc+1]|p[pc+2]<<8|p[pc+3]<<16|p[pc+4]<<24;break;
   case 3:sp--;break;
   case 4:s[sp]=s[sp-1];sp++;break;
   case 5:{const t=s[sp-1];s[sp-1]=s[sp-2];s[sp-2]=t;break}
   case 6:s[sp]=s[sp-2];sp++;break;
   case 7:{const a=s[sp-3],b=s[sp-2],d=s[sp-1];s[sp-3]=b;s[sp-2]=d;s[sp-1]=a;break}
   case 0x10:case 0x11:case 0x12:case 0x13:case 0x14:case 0x15:case 0x16:{
    const b=s[--sp],a=s[--sp];let r=0;
    switch(op){
     case 0x10:r=(a+b)|0;break;
     case 0x11:r=(a-b)|0;break;
     case 0x12:r=Math.imul(a,b);break;
     case 0x13:if(b===0){ec=4;break L}r=(a/b)|0;break;
     case 0x14:if(b===0){ec=4;break L}r=(a%b)|0;break;
     case 0x15:if(b===0){ec=4;break L}r=Math.floor((a>>>0)/(b>>>0))|0;break;
     case 0x16:if(b===0){ec=4;break L}r=((a>>>0)%(b>>>0))|0;break;
    }
    s[sp++]=r;break;
   }
   case 0x17:s[sp-1]=(-s[sp-1])|0;break;
   case 0x18:case 0x19:case 0x1a:case 0x1c:case 0x1d:case 0x1e:{
    const b=s[--sp],a=s[--sp];let r=0;
    switch(op){
     case 0x18:r=a&b;break;
     case 0x19:r=a|b;break;
     case 0x1a:r=a^b;break;
     case 0x1c:r=a<<(b&31);break;
     case 0x1d:r=a>>(b&31);break;
     case 0x1e:r=(a>>>(b&31))|0;break;
    }
    s[sp++]=r;break;
   }
   case 0x1b:s[sp-1]=~s[sp-1];break;
   case 0x20:case 0x21:case 0x22:{
    const b=s[--sp],a=s[--sp];let r=0;
    switch(op){
     case 0x20:r=a===b?1:0;break;
     case 0x21:r=a<b?1:0;break;
     case 0x22:r=(a>>>0)<(b>>>0)?1:0;break;
    }
    s[sp++]=r;break;
   }
   case 0x30:{const d=((p[pc+1]|(p[pc+2]<<8))<<16)>>16;np=np+d;break}
   case 0x31:case 0x32:{
    const v=s[--sp];
    if(op===0x31?v===0:v!==0){const d=((p[pc+1]|(p[pc+2]<<8))<<16)>>16;np=np+d}
    break;
   }
   case 0x33:
    if(cp===64){ec=7;break L}
    c[cp++]=np;np=p[pc+1]|(p[pc+2]<<8);break;
   case 0x34:
    if(cp===0){ec=8;break L}
    np=c[--cp];break;
   case 0x40:{
    const a=s[sp-1];
    if(a<0||a>255){ec=6;break L}
    s[sp-1]=mem[a];break;
   }
   case 0x41:{
    const a=s[--sp],v=s[--sp];
    if(a<0||a>255){ec=6;break L}
    mem[a]=v;break;
   }
   case 0x50:{
    const v=s[--sp],t=String(v);
    if(ol+t.length>65536){ec=11;break L}
    for(let i=0;i<t.length;i++)out[ol++]=t.charCodeAt(i);
    break;
   }
   case 0x51:{
    const v=s[--sp];
    if(ol>=65536){ec=11;break L}
    out[ol++]=v&255;break;
   }
   case 0x52:s[sp++]=ip<input.length?input[ip++]:-1;break;
   case 0x53:ec=s[--sp]&255;break L;
  }
  pc=np;
 }
 return [out,ol,ec];
}

const I=process.env.MAKEFUN_INPUT_DIR||'/input',O=process.env.MAKEFUN_OUTPUT_DIR||'/output';
fs.mkdirSync(O,{recursive:true});
for(const id of fs.readdirSync(I).sort()){
 const d=path.join(I,id);
 if(!fs.statSync(d).isDirectory())continue;
 let p;
 try{p=fs.readFileSync(path.join(d,'program.bin'))}catch{continue}
 let input;
 try{input=fs.readFileSync(path.join(d,'input.bin'))}catch{input=Buffer.alloc(0)}
 const [out,n,code]=vm(p,input),o=path.join(O,id);
 fs.mkdirSync(o,{recursive:true});
 fs.writeFileSync(path.join(o,'stdout.bin'),out.subarray(0,n));
 fs.writeFileSync(path.join(o,'exit.txt'),String(code)+'\n');
}