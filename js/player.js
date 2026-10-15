import {AC} from './audio.js';
import {reverseBuf, crushBuf} from './fx.js';

/* ================= Lecteur : un disque + une pédale branchée ================= */
export class Player{
  constructor(buf, offset = 0){
    const c = this.c = AC();
    this.buf = buf; this.dur = buf.duration; this.vars = {fwd: buf};
    this.bus = c.createGain();
    this.master = c.createGain(); this.master.gain.value = 0; this.master.gain.setTargetAtTime(.85, c.currentTime, .03);
    this.an = c.createAnalyser(); this.an.fftSize = 512;
    this.master.connect(this.an); this.an.connect(c.destination);
    this.variant = 'fwd'; this.rate = 1; this.seg = null; this.src = null; this.slot = null; this.timers = []; this.stuttering = false;
    this.play(offset);
  }
  buffer(v){ if(!this.vars[v]) this.vars[v] = v === 'rev' ? reverseBuf(this.buf) : crushBuf(this.buf); return this.vars[v]; }
  offset(){
    const el = (this.c.currentTime - this.t0) * this.rate;
    if(this.seg){ const [a, b] = this.seg, L = b - a; return a + (((this.o0 - a + el) % L) + L) % L; }
    return (((this.o0 + el) % this.dur) + this.dur) % this.dur;
  }
  play(offset, seg){
    const c = this.c, now = c.currentTime, s = c.createBufferSource(), g = c.createGain();
    offset = Math.max(0, Math.min(offset, this.dur - .01));
    s.buffer = this.buffer(this.variant); s.loop = true; s.playbackRate.value = this.rate;
    if(seg){ s.loopStart = seg[0]; s.loopEnd = seg[1]; }
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + .025);
    s.connect(g); g.connect(this.bus); s.start(now, offset);
    if(this.src){
      const os = this.src, og = this.srcGain;
      og.gain.cancelScheduledValues(now); og.gain.setValueAtTime(og.gain.value, now); og.gain.linearRampToValueAtTime(0, now + .025);
      try{ os.stop(now + .04); }catch(e){}
    }
    this.src = s; this.srcGain = g; this.o0 = offset; this.t0 = now; this.seg = seg || null;
  }
  transport(tp = {}){
    const rate = tp.rate || 1, variant = tp.variant || 'fwd', stutter = !!tp.stutter;
    if(this.stuttering && !stutter) this.stutterOff();
    if(variant !== this.variant){
      const o = this.offset(), song = this.variant === 'rev' ? this.dur - o : o;
      this.variant = variant; this.rate = rate;
      this.play(variant === 'rev' ? this.dur - song : song);
    } else if(rate !== this.rate){
      this.o0 = this.offset(); this.t0 = this.c.currentTime; this.rate = rate;
      this.src.playbackRate.setValueAtTime(rate, this.c.currentTime);
    }
    if(stutter && !this.stuttering) this.stutterOn();
  }
  stutterOn(){
    this.stuttering = true;
    const hit = () => {
      let o = this.offset(); if(o > this.dur - .6) o = 0;
      this.play(o, [o, o + .12 + Math.random() * .1]);
      this.timers.push(setTimeout(() => { if(this.stuttering) this.play(this.offset() + .02); }, 380 + Math.random() * 260));
    };
    hit(); this.stutterIv = setInterval(hit, 1000);
  }
  stutterOff(){ this.stuttering = false; clearInterval(this.stutterIv); this.timers.forEach(clearTimeout); this.timers = []; this.play(this.offset()); }
  setFx(fx){
    const c = this.c, now = c.currentTime, keep = [], input = c.createGain(), output = c.createGain(), x = c.createGain();
    if(fx.wire) fx.wire(c, input, output, keep); else input.connect(output);
    x.gain.setValueAtTime(0, now); x.gain.linearRampToValueAtTime(1, now + .12);
    this.bus.connect(input); output.connect(x); x.connect(this.master);
    const old = this.slot;
    if(old){
      old.x.gain.cancelScheduledValues(now); old.x.gain.setValueAtTime(old.x.gain.value, now); old.x.gain.linearRampToValueAtTime(0, now + .12);
      setTimeout(() => { try{ this.bus.disconnect(old.input); }catch(e){} try{ old.x.disconnect(); }catch(e){} old.keep.forEach(n => { try{ n.stop(); }catch(e){} }); }, 260);
    }
    this.slot = {input, x, keep};
    this.transport(fx.tp);
  }
  level(){
    const d = this._d || (this._d = new Float32Array(this.an.fftSize)); this.an.getFloatTimeDomainData(d);
    let s = 0; for(let i = 0; i < d.length; i += 4) s += d[i] * d[i];
    return Math.sqrt(s / (d.length / 4));
  }
  stop(){
    const c = this.c, now = c.currentTime;
    this.stuttering = false; clearInterval(this.stutterIv); this.timers.forEach(clearTimeout);
    this.master.gain.cancelScheduledValues(now); this.master.gain.setTargetAtTime(0, now, .05);
    const src = this.src, slot = this.slot;
    setTimeout(() => { try{ src.stop(); }catch(e){} if(slot) slot.keep.forEach(n => { try{ n.stop(); }catch(e){} }); try{ this.master.disconnect(); this.an.disconnect(); }catch(e){} }, 400);
  }
}

