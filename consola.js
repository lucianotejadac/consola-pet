/* Consola PET: simulador docente. Carga un PET (y su CT) ya reconstruidos y los presenta
   como un examen recien adquirido: reproduce las camas con los tiempos de la cabecera y
   muestra los parametros de reconstruccion como controles de consola que ya no se pueden
   cambiar. Nada se adquiere ni se reconstruye de nuevo. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const LN2 = Math.LN2;

  const E = {
    fase: 'vacio',            // vacio | listo | adquiriendo | pausa | terminado
    pets: [],                 // series PET de la misma adquisicion (trabajos de reconstruccion)
    trabajo: 0,               // indice en pets
    ct: null, otrosCt: [], ignoradas: [],
    camas: [], completa: null, total: 0, continuo: false,
    reloj: 0, vel: 30,
    corte: 0, modo: 'pet', giro: 0, nivel: 1,
    paso: 'pet', pestana: 'routine', unidadDosis: 'mCi',
    mip: null, topo: null, cajaTopo: null, cajaMip: null, cajaAxial: null,
  };

  // ---------- utilidades ----------
  const decir = (t, aviso) => { const m = $('mensaje'); m.textContent = t; m.classList.toggle('aviso', !!aviso); };
  const ceder = () => new Promise(r => setTimeout(r, 0));
  const hms = s => { s = Math.max(0, Math.round(s)); const p = n => String(n).padStart(2, '0'); return p(Math.floor(s / 3600)) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60); };
  const tmASeg = t => { if (!t || t.length < 4) return NaN; return (+t.slice(0, 2)) * 3600 + (+t.slice(2, 4)) * 60 + (parseFloat(t.slice(4)) || 0); };
  const horaDe = t => (t && t.length >= 6) ? t.slice(0, 2) + ':' + t.slice(2, 4) + ':' + t.slice(4, 6) : '—';
  const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fechaDe = d => (d && d.length === 8) ? d.slice(6, 8) + '-' + MESES[+d.slice(4, 6) - 1] + '-' + d.slice(0, 4) : '—';
  const num = (v, d = 1) => (v === undefined || v === null || Number.isNaN(v)) ? '—' : (+v).toFixed(d);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- ZIP minimo (directorio central + deflate del navegador) ----------
  async function abrirZip(nombre, buf) {
    const dv = new DataView(buf);
    let p = buf.byteLength - 22;
    while (p >= 0 && dv.getUint32(p, true) !== 0x06054b50) p--;
    if (p < 0) throw Error('ZIP sin directorio central');
    const n = dv.getUint16(p + 10, true);
    let q = dv.getUint32(p + 16, true);
    const salida = [];
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(q, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(q + 10, true), tc = dv.getUint32(q + 20, true), tu = dv.getUint32(q + 24, true);
      const ln = dv.getUint16(q + 28, true), le = dv.getUint16(q + 30, true), lc = dv.getUint16(q + 32, true);
      const off = dv.getUint32(q + 42, true);
      const interno = new TextDecoder().decode(new Uint8Array(buf, q + 46, ln));
      q += 46 + ln + le + lc;
      if (interno.endsWith('/') || tu === 0) continue;
      const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const datos = new Uint8Array(buf, ini, tc);
      let cuerpo;
      if (metodo === 0) cuerpo = datos.slice().buffer;
      else if (metodo === 8) {
        if (typeof DecompressionStream === 'undefined') throw Error('Este navegador no descomprime ZIP; descomprime la carpeta y cargala');
        cuerpo = await new Response(new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      } else continue;
      salida.push({ nombre: nombre + '/' + interno, buf: cuerpo });
    }
    return salida;
  }

  // ---------- lectura DICOM ----------
  const SINTAXIS_OK = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'];

  function leerDicom(buf) {
    let ds;
    try { ds = dicomParser.parseDicom(new Uint8Array(buf)); } catch (e) { return null; }
    const s = t => { const v = ds.string(t); return v === undefined ? '' : v.trim(); };
    const BINARIOS = ['x00189311', 'x00189345'];
    const f = t => {
      const e = ds.elements[t]; if (!e) return NaN;
      if (e.vr === 'FD' || (!e.vr && BINARIOS.includes(t))) return ds.double(t);
      if (e.vr === 'FL') return ds.float(t);
      if (e.vr === 'US') return ds.uint16(t);
      const v = ds.floatString(t); return v === undefined ? NaN : v;
    };
    const lista = t => { const v = ds.string(t); return v ? v.split('\\').map(Number) : []; };
    const px = ds.elements.x7fe00010;
    const mod = s('x00080060');
    if (!px || (mod !== 'PT' && mod !== 'CT')) return { descartada: mod || 'sin modalidad' };
    const ipp = lista('x00200032'), iop = lista('x00200037'), ps = lista('x00280030');
    if (ipp.length !== 3 || ps.length !== 2) return { descartada: 'sin geometria' };
    const sintaxis = s('x00020010');
    const im = {
      mod, serie: s('x0020000e'), desc: s('x0008103e'), sintaxis,
      comprimida: !!px.encapsulatedPixelData || (sintaxis && !SINTAXIS_OK.includes(sintaxis)),
      axial: iop.length === 6 && Math.abs(iop[0]) > 0.99 && Math.abs(iop[4]) > 0.99,
      ipp, ps, z: ipp[2], rows: ds.uint16('x00280010'), cols: ds.uint16('x00280011'),
      slope: Number.isNaN(f('x00281053')) ? 1 : f('x00281053'),
      inter: Number.isNaN(f('x00281052')) ? 0 : f('x00281052'),
      tAdq: tmASeg(s('x00080032')), tRef: f('x00541300'),
      ma: f('x00181151'), mas: f('x00181152'), ctdi: f('x00189345'),
      tope: lista('x00281050').length && lista('x00281051').length ? lista('x00281050')[0] + lista('x00281051')[0] / 2 : NaN,
    };
    if (im.comprimida) return im;
    const firmado = ds.uint16('x00280103') === 1;
    const n = im.rows * im.cols;
    const copia = buf.slice(px.dataOffset, px.dataOffset + n * 2);
    const crudo = firmado ? new Int16Array(copia) : new Uint16Array(copia);
    if (mod === 'PT') {
      const v = new Float32Array(n);
      for (let i = 0; i < n; i++) v[i] = crudo[i] * im.slope + im.inter;
      im.pix = v;
    } else {
      // El CT se guarda reducido (hasta 256 de lado) para no cargar 100 MB en memoria.
      const k = Math.max(1, Math.round(im.cols / 256));
      const r2 = Math.floor(im.rows / k), c2 = Math.floor(im.cols / k);
      const v = new Int16Array(r2 * c2);
      for (let y = 0; y < r2; y++) for (let x = 0; x < c2; x++) {
        let a = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) a += crudo[(y * k + j) * im.cols + x * k + i];
        v[y * c2 + x] = Math.round(a / (k * k) * im.slope + im.inter);
      }
      im.pix = v; im.k = k; im.r2 = r2; im.c2 = c2;
    }
    im.cab = cabecera(ds, s, f, lista);
    return im;
  }

  function cabecera(ds, s, f, lista) {
    const c = {
      fabricante: s('x00080070'), modelo: s('x00081090'), software: s('x00181020'),
      estudio: s('x00081030'), serie: s('x0008103e'), protocolo: s('x00181030'),
      id: s('x00100020'), nombre: s('x00100010'), sexo: s('x00100040'), edad: s('x00101010'),
      peso: f('x00101030'), talla: f('x00101020'), posicion: s('x00185100'), parte: s('x00180015'),
      fechaEstudio: s('x00080020'), fechaSerie: s('x00080021'), fechaAdq: s('x00080022'),
      horaSerie: s('x00080031'), horaAdq: s('x00080032'),
      grosor: f('x00180050'), ventanaC: lista('x00281050'), ventanaA: lista('x00281051'),
      nucleo: s('x00181210'),
      // PET
      unidades: s('x00541001'), metodo: s('x00541103'), corregida: s('x00280051').split('\\').filter(Boolean),
      atenuacion: s('x00541101'), dispersion: s('x00541105'), aleatorios: s('x00541100'), decaimiento: s('x00541102'),
      duracion: f('x00181242'), tipoSerie: s('x00541000'), aceptacion: f('x00541200'), mash: s('x00541201'),
      // CT
      kv: f('x00180060'), ma: f('x00181151'), mas: f('x00181152'), tExp: f('x00181150'),
      paso: f('x00189311'), ctdi: f('x00189345'), fov: f('x00181100'), fovDatos: f('x00180090'),
      filtro: s('x00181160'),
    };
    const sec = ds.elements.x00540016;
    if (sec && sec.items && sec.items.length) {
      const r = sec.items[0].dataSet;
      const rs = t => { const v = r.string(t); return v === undefined ? '' : v.trim(); };
      const rf = t => { const v = r.floatString(t); return v === undefined ? NaN : v; };
      c.farmaco = rs('x00180031'); c.dosis = rf('x00181074'); c.vidaMedia = rf('x00181075');
      c.horaIny = rs('x00181072'); c.fechaHoraIny = rs('x00181078');
      const nuc = r.elements.x00540300;
      if (nuc && nuc.items && nuc.items.length) { const v = nuc.items[0].dataSet.string('x00080104'); c.nucleido = v ? v.trim() : ''; }
    }
    return c;
  }

  // ---------- armado de volumenes ----------
  function armarSerie(ims) {
    ims.sort((a, b) => b.z - a.z);                         // indice 0 = corte mas craneal (HFS)
    const limpio = ims.filter((im, i) => i === 0 || Math.abs(im.z - ims[i - 1].z) > 1e-3);
    const p = limpio[0], n = limpio.length;
    const rows = p.mod === 'CT' ? p.r2 : p.rows, cols = p.mod === 'CT' ? p.c2 : p.cols;
    const vol = p.mod === 'CT' ? new Int16Array(n * rows * cols) : new Float32Array(n * rows * cols);
    limpio.forEach((im, i) => { if (im.pix.length === rows * cols) vol.set(im.pix, i * rows * cols); im.pix = null; });
    const k = p.k || 1;
    const media = c => { const l = limpio.map(im => im[c]).filter(v => !Number.isNaN(v)); return l.length ? l.reduce((a, b) => a + b, 0) / l.length : NaN; };
    const topes = limpio.map(im => im.tope).filter(v => !Number.isNaN(v)).sort((a, b) => a - b);
    return {
      maMedio: media('ma'), masMedio: media('mas'), ctdiMedio: media('ctdi'), topeMediano: topes.length ? topes[Math.floor(topes.length / 2)] : NaN,
      mod: p.mod, uid: p.serie, desc: p.desc, cab: p.cab, n, rows, cols, vol,
      dx: p.ps[1] * k, dy: p.ps[0] * k,
      x0: p.ipp[0] + (k - 1) * p.ps[1] / 2, y0: p.ipp[1] + (k - 1) * p.ps[0] / 2,
      zs: limpio.map(im => im.z), dz: n > 1 ? Math.abs(limpio[0].z - limpio[n - 1].z) / (n - 1) : (p.cab.grosor || 1),
      tiempos: limpio.map(im => im.tAdq), colsOrig: p.cols, rowsOrig: p.rows, psOrig: p.ps[1],
    };
  }

  function estimarCamas(pet) {
    const t = pet.tiempos, n = pet.n;
    const dur = (pet.cab.duracion || 0) / 1000;
    const validos = t.filter(v => !Number.isNaN(v));
    if (!validos.length) return { camas: [{ t: 0, i0: 0, i1: n - 1, c0: 0, c1: n - 1 }], completa: new Float32Array(n).fill(dur || 60), total: dur || 60, dur: dur || 60, continuo: false, sentido: '—' };
    // Mesetas: tramos de al menos 3 cortes con la misma hora. Cada una es el centro de una cama.
    let mes = [], i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && Math.abs(t[j + 1] - t[i]) <= 1.01) j++;
      if (j - i + 1 >= 3) mes.push({ t: t[Math.floor((i + j) / 2)], i0: i, i1: j });
      i = j + 1;
    }
    mes.sort((a, b) => a.t - b.t);
    mes = mes.filter((m, k) => k === 0 || m.t - mes[k - 1].t > 5);
    const t0 = Math.min(...validos), t1 = Math.max(...validos);
    const d = dur || 60;
    const completa = new Float32Array(n);
    if (!mes.length) {
      for (let k = 0; k < n; k++) completa[k] = t[k] - t0 + d;
      return { camas: [], completa, total: t1 - t0 + d, dur: d, continuo: true, sentido: t[0] <= t[n - 1] ? 'Craniocaudal' : 'Caudocranial' };
    }
    const camas = mes.map((m, k) => {
      const antes = k ? mes[k - 1].t + 1.5 : -Infinity, despues = k + 1 < mes.length ? mes[k + 1].t - 1.5 : Infinity;
      let c0 = n, c1 = -1;
      for (let q = 0; q < n; q++) if (t[q] > antes && t[q] < despues) { c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
      return { t: m.t - t0, i0: m.i0, i1: m.i1, c0, c1 };
    });
    for (let q = 0; q < n; q++) {
      let fin = 0;
      camas.forEach(c => { if (q >= c.c0 && q <= c.c1) fin = Math.max(fin, c.t + d); });
      completa[q] = fin || (t[q] - t0 + d);
    }
    const zc = c => (pet.zs[c.c0] + pet.zs[c.c1]) / 2;
    const sentido = camas.length < 2 ? '—' : (zc(camas[0]) > zc(camas[camas.length - 1]) ? 'Craniocaudal' : 'Caudocranial');
    // Tasa relativa: actividad de la imagen en la cama, llevada a la hora de esa cama.
    const lam = pet.cab.vidaMedia ? LN2 / pet.cab.vidaMedia : 0, plano = pet.rows * pet.cols;
    camas.forEach(c => {
      let a = 0;
      for (let q = c.c0; q <= c.c1; q++) { const b = q * plano; for (let r = 0; r < plano; r += 3) a += pet.vol[b + r]; }
      c.tasa = a * Math.exp(-lam * (c.t + d / 2));
    });
    const mx = Math.max(...camas.map(c => c.tasa)) || 1;
    camas.forEach(c => { c.tasa = 100 * c.tasa / mx; });
    return { camas, completa, total: camas[camas.length - 1].t + d, dur: d, continuo: false, sentido };
  }

  function topograma(v, esCt) {
    // Proyeccion anteroposterior: con CT, suma de atenuacion; sin CT, suma de actividad.
    const p = new Float32Array(v.n * v.cols);
    for (let i = 0; i < v.n; i++) for (let y = 0; y < v.rows; y++) {
      const b = (i * v.rows + y) * v.cols;
      for (let x = 0; x < v.cols; x++) { const h = v.vol[b + x]; p[i * v.cols + x] += esCt ? Math.max(0, h + 1000) : h; }
    }
    const orden = Float32Array.from(p).sort();
    return { p, max: orden[Math.floor(orden.length * 0.995)] || 1, min: esCt ? orden[Math.floor(orden.length * 0.05)] : 0, esCt, cols: v.cols, n: v.n, ancho: v.cols * v.dx, x0: v.x0 - v.dx / 2 };
  }

  // ---------- carga ----------
  async function cargar(archivos) {
    const lista = Array.from(archivos);
    if (!lista.length) return;
    E.fase = 'vacio'; pararReloj();
    decir('Leyendo ' + lista.length + ' archivo(s)…');
    const series = new Map(); let leidos = 0, noDicom = 0, comprimidas = 0; const descartes = {};
    const tomar = buf => {
      const im = leerDicom(buf);
      if (!im) { noDicom++; return; }
      if (im.descartada) { descartes[im.descartada] = (descartes[im.descartada] || 0) + 1; return; }
      if (im.comprimida) { comprimidas++; return; }
      if (!series.has(im.serie)) series.set(im.serie, []);
      series.get(im.serie).push(im); leidos++;
    };
    try {
      for (let k = 0; k < lista.length; k++) {
        const a = lista[k];
        const buf = a.buf || await a.arrayBuffer();
        const nombre = a.nombre || a.name || '';
        if (/\.zip$/i.test(nombre)) {
          const dentro = await abrirZip(nombre, buf);
          for (let q = 0; q < dentro.length; q++) { tomar(dentro[q].buf); if (q % 25 === 0) { decir('Leyendo ' + nombre + ': ' + (q + 1) + ' de ' + dentro.length + '…'); await ceder(); } }
        } else tomar(buf);
        if (k % 25 === 0) { decir('Leyendo archivo ' + (k + 1) + ' de ' + lista.length + '…'); await ceder(); }
      }
    } catch (e) { decir('No se pudo leer: ' + e.message, true); return; }

    const armadas = [], cortas = [];
    series.forEach(ims => { if (ims.filter(im => im.axial).length >= 8) armadas.push(armarSerie(ims.filter(im => im.axial))); else cortas.push((ims[0].desc || ims[0].mod) + ' (no axial)'); });
    const pets = armadas.filter(v => v.mod === 'PT'), cts = armadas.filter(v => v.mod === 'CT');
    if (!pets.length) {
      decir(comprimidas ? 'Las imágenes vienen comprimidas y esta consola solo lee DICOM sin comprimir.' : 'No encontré una serie PET axial entre los archivos (' + leidos + ' imágenes DICOM leídas).', true);
      return;
    }
    const corr = v => v.cab.corregida.includes('ATTN');
    pets.sort((a, b) => (b.n - a.n) || (corr(b) - corr(a)));
    const principal = pets[0];
    const misma = v => v.n === principal.n && Math.abs(v.zs[0] - principal.zs[0]) < 1 && v.rows === principal.rows;
    E.pets = pets.filter(misma).sort((a, b) => corr(b) - corr(a));
    E.ignoradas = pets.filter(v => !misma(v)).map(v => v.desc + ' (' + v.n + ' cortes)').concat(cortas);
    E.trabajo = 0;
    const zA = Math.min(...principal.zs), zB = Math.max(...principal.zs);
    const solape = v => Math.max(0, Math.min(zB, Math.max(...v.zs)) - Math.max(zA, Math.min(...v.zs)));
    cts.sort((a, b) => (solape(b) - solape(a)) || (b.n - a.n));
    E.ct = cts.length && solape(cts[0]) > 0 ? cts[0] : null;
    E.otrosCt = cts.filter(v => v !== E.ct);
    if (E.ct) E.ct.dePet = principal.zs.map(z => { let m = 0; E.ct.zs.forEach((zz, i) => { if (Math.abs(zz - z) < Math.abs(E.ct.zs[m] - z)) m = i; }); return Math.abs(E.ct.zs[m] - z) <= E.ct.dz ? m : -1; });

    Object.assign(E, estimarCamas(principal));
    E.topo = topograma(E.ct || principal, !!E.ct);
    const c = principal.cab;
    E.nivelBase = principal.topeMediano > 0 ? principal.topeMediano : percentil(principal.vol, 0.999);
    E.nivel = 1; $('nivel').value = 100; E.giro = 0; $('giro').value = 0;
    E.corte = Math.floor(principal.n / 2); $('corte').max = principal.n - 1; $('corte').value = E.corte;
    E.mip = { ang: -1, filas: new Float32Array(principal.n * principal.cols), hechas: new Uint8Array(principal.n) };
    E.reloj = 0; E.fase = 'listo'; E.paso = 'pet'; E.pestana = 'routine'; E.modo = 'pet';
    $('btnStart').disabled = false; $('btnSkip').disabled = false;
    const partes = [E.pets.length + ' serie(s) PET de ' + principal.n + ' cortes', E.ct ? 'CT de ' + E.ct.n + ' cortes' : 'sin CT', E.continuo ? 'camilla en movimiento continuo' : E.camas.length + ' cama(s) de ' + num(E.dur / 60, 1) + ' min'];
    decir('Estudio cargado: ' + partes.join(', ') + '. Pulsa «Start» para reproducir la adquisición.' + (E.ignoradas.length ? ' Series no usadas: ' + E.ignoradas.join(', ') + '.' : ''));
    refrescarTodo();
  }

  function percentil(v, q) {
    const m = []; for (let i = 0; i < v.length; i += 37) if (v[i] > 0) m.push(v[i]);
    m.sort((a, b) => a - b); return m[Math.floor(m.length * q)] || 1;
  }

  // ---------- reproduccion ----------
  let marca = 0, cuadro = 0;
  function pararReloj() { if (cuadro) cancelAnimationFrame(cuadro); cuadro = 0; }
  function latido(ahora) {
    if (E.fase !== 'adquiriendo') { cuadro = 0; return; }
    const dt = Math.min(0.25, (ahora - marca) / 1000); marca = ahora;
    E.reloj += dt * E.vel;
    if (E.reloj >= E.total) { terminar(); return; }
    pintar(); pintarCronica(); pintarGrafico();
    const k = camaActual();
    decir(E.continuo ? 'Adquiriendo con la camilla en movimiento continuo…' : (k >= 0 ? 'Adquiriendo la cama ' + (k + 1) + ' de ' + E.camas.length + '…' : 'Moviendo la camilla a la cama siguiente…'));
    cuadro = requestAnimationFrame(latido);
  }
  function iniciar() {
    if (E.fase === 'vacio') return;
    if (E.fase === 'terminado') { E.reloj = 0; E.mip.hechas.fill(0); E.mip.ang = -1; }
    E.fase = 'adquiriendo'; E.paso = 'pet'; if (E.modo === 'ct') E.modo = 'pet';
    marca = performance.now(); pararReloj(); cuadro = requestAnimationFrame(latido);
    refrescarTodo();
  }
  function pausar() { if (E.fase !== 'adquiriendo') return; E.fase = 'pausa'; pararReloj(); decir('Adquisición suspendida. Pulsa «Resume» para continuar.', true); refrescarTodo(); }
  function terminar() {
    if (E.fase === 'vacio') return;
    pararReloj(); E.reloj = E.total; E.fase = 'terminado';
    decir('Examen terminado: ' + E.pets.map(p => p.desc).join(' y ') + ' reconstruidas. Revisa las pestañas Routine, Scan y Recon.');
    refrescarTodo();
  }
  const camaActual = () => E.camas.findIndex(c => E.reloj >= c.t && E.reloj < c.t + E.dur);
  const revelado = i => E.fase === 'terminado' || (E.fase !== 'listo' && E.fase !== 'vacio' && E.reloj >= E.completa[i]);

  // ---------- dibujo ----------
  const pet = () => E.pets[E.trabajo];
  function ajustar(cv) {
    const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(60, Math.round(r.width * d)), h = Math.max(60, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    return { g, w, h, d };
  }
  function encajar(W, H, af, hf, m) {
    const e = Math.min((W - 2 * m) / af, (H - 2 * m) / hf);
    return { x: (W - af * e) / 2, y: (H - hf * e) / 2, w: af * e, h: hf * e, e };
  }
  const lienzo = document.createElement('canvas');
  function volcar(g, datos, w, h, caja, suave) {
    lienzo.width = w; lienzo.height = h;
    lienzo.getContext('2d').putImageData(new ImageData(datos, w, h), 0, 0);
    g.imageSmoothingEnabled = suave !== false; g.imageSmoothingQuality = 'high';
    g.drawImage(lienzo, caja.x, caja.y, caja.w, caja.h);
  }
  function texto(g, d, lineas, x, y, color, alinear) {
    g.font = (11 * d) + 'px Consolas, monospace'; g.fillStyle = color || '#fff'; g.textAlign = alinear || 'left'; g.textBaseline = 'top';
    g.lineJoin = 'round'; g.lineWidth = 3 * d; g.strokeStyle = 'rgba(0,0,0,.85)';
    lineas.forEach((t, i) => { g.strokeText(t, x, y + i * 13 * d); g.fillText(t, x, y + i * 13 * d); });
  }
  const CALOR = (() => { const l = new Uint8ClampedArray(256 * 3); for (let i = 0; i < 256; i++) { const t = i / 255; l[i * 3] = 255 * Math.min(1, t * 2.6); l[i * 3 + 1] = 255 * Math.min(1, Math.max(0, t * 2.6 - 0.9)); l[i * 3 + 2] = 255 * Math.min(1, Math.max(0, t * 3.2 - 2.2)); } return l; })();

  function pintarTopo() {
    const cv = $('cvTopo'), { g, w, h, d } = ajustar(cv);
    if (E.fase === 'vacio') { texto(g, d, ['Sin estudio'], 10 * d, 10 * d, '#667'); return; }
    const T = E.topo, p = pet();
    const alto = p.n * p.dz, caja = encajar(w, h, T.ancho, alto, 26 * d);
    const px = new Uint8ClampedArray(T.cols * T.n * 4);
    for (let i = 0; i < T.cols * T.n; i++) {
      let v = (T.p[i] - T.min) / (T.max - T.min); v = Math.max(0, Math.min(1, v));
      const c = 255 * Math.pow(v, T.esCt ? 0.8 : 0.5);
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = T.esCt ? c : 255 - c; px[i * 4 + 3] = 255;
    }
    // El topograma del CT puede tener otra cantidad de cortes que el PET: se dibuja en su propia extension.
    const v = E.ct || p, zTop = p.zs[0] + p.dz / 2, e = caja.h / alto;
    const yDe = z => caja.y + (zTop - z) * e;
    const cajaT = { x: caja.x, w: caja.w, y: yDe(v.zs[0] + v.dz / 2), h: v.n * v.dz * e };
    volcar(g, px, T.cols, T.n, cajaT);
    E.cajaTopo = { caja, yDe, zDe: y => zTop - (y - caja.y) / e };
    // Rango del PET y camas
    const x0 = caja.x + caja.w * 0.06, x1 = caja.x + caja.w * 0.94;
    g.lineWidth = d;
    if (E.continuo) {
      g.strokeStyle = '#fff'; g.strokeRect(x0, caja.y, x1 - x0, caja.h);
      if (E.fase === 'adquiriendo' || E.fase === 'pausa') { const y = caja.y + caja.h * Math.min(1, E.reloj / E.total); g.strokeStyle = '#38e05a'; g.lineWidth = 2 * d; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    } else {
      const act = (E.fase === 'adquiriendo' || E.fase === 'pausa') ? camaActual() : -1;
      E.camas.forEach((c, k) => {
        const ya = yDe(p.zs[c.c0] + p.dz / 2), yb = yDe(p.zs[c.c1] - p.dz / 2), des = (k % 2) * 7 * d;
        const hecha = E.fase === 'terminado' || ((E.fase === 'adquiriendo' || E.fase === 'pausa') && E.reloj >= c.t + E.dur);
        g.strokeStyle = k === act ? '#38e05a' : (hecha ? '#5f86ff' : '#ffffff');
        g.lineWidth = (k === act ? 2.2 : 1) * d;
        if (k === act) { g.fillStyle = 'rgba(56,224,90,.16)'; g.fillRect(x0 - des, ya, x1 - x0 + 2 * des, yb - ya); }
        g.strokeRect(x0 - des, ya, x1 - x0 + 2 * des, yb - ya);
        texto(g, d, [String(k + 1)], x1 + des + 4 * d, (ya + yb) / 2 - 6 * d, g.strokeStyle);
      });
    }
    // Corte mostrado en el panel axial
    const yc = yDe(p.zs[E.corte]);
    g.strokeStyle = '#ffd24a'; g.lineWidth = d; g.setLineDash([5 * d, 4 * d]); g.beginPath(); g.moveTo(caja.x, yc); g.lineTo(caja.x + caja.w, yc); g.stroke(); g.setLineDash([]);
    const c = (E.ct || p).cab;
    texto(g, d, ['R'], 8 * d, h / 2 - 6 * d, '#fff');
    texto(g, d, E.ct ? ['kV ' + num(c.kv, 0), 'mA ' + num(E.ct.maMedio, 0) + ' (medio)', 'SL ' + num(c.grosor, 1)] : ['Proyección del PET'], 8 * d, h - (E.ct ? 60 : 32) * d, '#fff');
    texto(g, d, [fechaDe(c.fechaSerie || c.fechaEstudio), horaDe(c.horaSerie), p.cab.posicion || ''], 8 * d, 8 * d, '#fff');
    texto(g, d, ['LEN ' + num(alto, 0) + ' mm', 'SP1 ' + num(p.zs[0], 1), 'SP2 ' + num(p.zs[p.n - 1], 1)], w - 8 * d, 22 * d, '#fff', 'right');
    $('rotTopo').textContent = E.ct ? 'Topograma (proyección del CT)' : 'Topograma (proyección del PET)';
  }

  function pintarAxial() {
    const cv = $('cvAxial'), { g, w, h, d } = ajustar(cv);
    document.querySelectorAll('button.modo').forEach(b => { b.classList.toggle('activa', b.dataset.modo === E.modo); b.disabled = E.fase === 'vacio' || (b.dataset.modo !== 'pet' && !E.ct); });
    if (E.fase === 'vacio') { texto(g, d, ['Sin estudio'], 10 * d, 10 * d, '#667'); return; }
    const p = pet(), i = E.corte, hay = revelado(i), ct = E.ct, j = ct ? ct.dePet[i] : -1;
    const tope = E.nivelBase * E.nivel;
    let caja, leyenda = [];
    if (E.modo === 'pet') {
      caja = encajar(w, h, p.cols * p.dx, p.rows * p.dy, 8 * d);
      if (hay) {
        const px = new Uint8ClampedArray(p.rows * p.cols * 4), b = i * p.rows * p.cols;
        for (let q = 0; q < p.rows * p.cols; q++) { const c = 255 - 255 * Math.min(1, Math.max(0, p.vol[b + q] / tope)); px[q * 4] = px[q * 4 + 1] = px[q * 4 + 2] = c; px[q * 4 + 3] = 255; }
        volcar(g, px, p.cols, p.rows, caja);
      }
      E.cajaAxial = { caja, x0: p.x0 - p.dx / 2, y0: p.y0 - p.dy / 2, ancho: p.cols * p.dx, alto: p.rows * p.dy };
      leyenda = [p.desc, p.cab.metodo, p.cab.nucleo];
    } else {
      const S = 320, ancho = ct.cols * ct.dx, alto = ct.rows * ct.dy, X0 = ct.x0 - ct.dx / 2, Y0 = ct.y0 - ct.dy / 2;
      caja = encajar(w, h, ancho, alto, 8 * d);
      const px = new Uint8ClampedArray(S * S * 4), wc = 40, ww = 400, fus = E.modo === 'fusion' && hay;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const fx = X0 + (x + 0.5) * ancho / S, fy = Y0 + (y + 0.5) * alto / S, o = (y * S + x) * 4;
        let gris = 0;
        if (j >= 0) { const cx = Math.min(ct.cols - 1, Math.floor((fx - X0) / ct.dx)), cy = Math.min(ct.rows - 1, Math.floor((fy - Y0) / ct.dy)); gris = 255 * Math.min(1, Math.max(0, (ct.vol[(j * ct.rows + cy) * ct.cols + cx] - (wc - ww / 2)) / ww)); }
        let r = gris, v = gris, a = gris;
        if (fus) {
          const ux = (fx - p.x0) / p.dx, uy = (fy - p.y0) / p.dy;
          if (ux >= 0 && uy >= 0 && ux < p.cols - 1 && uy < p.rows - 1) {
            const xa = Math.floor(ux), ya = Math.floor(uy), tx = ux - xa, ty = uy - ya, b = (i * p.rows + ya) * p.cols + xa;
            const val = (p.vol[b] * (1 - tx) + p.vol[b + 1] * tx) * (1 - ty) + (p.vol[b + p.cols] * (1 - tx) + p.vol[b + p.cols + 1] * tx) * ty;
            const t = Math.min(1, Math.max(0, val / tope)), k = Math.round(t * 255) * 3, al = Math.min(0.85, 0.25 + t);
            r = gris * (1 - al) + CALOR[k] * al; v = gris * (1 - al) + CALOR[k + 1] * al; a = gris * (1 - al) + CALOR[k + 2] * al;
          }
        }
        px[o] = r; px[o + 1] = v; px[o + 2] = a; px[o + 3] = 255;
      }
      volcar(g, px, S, S, caja);
      E.cajaAxial = { caja, x0: X0, y0: Y0, ancho, alto };
      leyenda = E.modo === 'ct' ? [ct.desc, 'W ' + ww + '  C ' + wc] : [ct.desc + ' + ' + p.desc, 'W ' + ww + '  C ' + wc];
    }
    if (!hay && E.modo !== 'ct') {
      const k = E.camas.findIndex(c => i >= c.c0 && i <= c.c1);
      texto(g, d, [E.fase === 'listo' ? 'PET sin adquirir: pulsa Start' : 'Corte aún no adquirido' + (k >= 0 ? ' (cama ' + (k + 1) + ')' : '')], w / 2, h / 2 - 6 * d, '#ffd24a', 'center');
    }
    texto(g, d, ['IMA ' + (i + 1) + ' / ' + p.n, 'SP ' + num(p.zs[i], 1), E.lectura || ''], 8 * d, 8 * d, '#fff');
    texto(g, d, leyenda.filter(Boolean), 8 * d, h - (22 + 13 * leyenda.filter(Boolean).length) * d, '#fff');
    if (E.modo !== 'ct') texto(g, d, ['T ' + num(tope, 0) + ' ' + (p.cab.unidades || ''), 'B 0'], w - 8 * d, h - 50 * d, '#fff', 'right');
    texto(g, d, ['R'], 8 * d, h / 2 - 6 * d, '#fff');
    $('rotAxial').textContent = 'Axial · ' + (E.modo === 'pet' ? 'PET' : E.modo === 'ct' ? 'CT' : 'Fusión');
    $('corte').value = i;
  }

  function filaMip(p, i, ang, salida, base) {
    const R = p.rows, C = p.cols, b = i * R * C;
    if (ang === 0) { for (let x = 0; x < C; x++) { let m = 0; for (let y = 0; y < R; y++) { const v = p.vol[b + y * C + x]; if (v > m) m = v; } salida[base + x] = m; } return; }
    const a = ang * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), cx = (C - 1) / 2, cy = (R - 1) / 2;
    for (let u = 0; u < C; u++) {
      let m = 0;
      for (let s = 0; s < R; s++) {
        const x = Math.round(cx + (u - cx) * co - (s - cy) * si), y = Math.round(cy + (u - cx) * si + (s - cy) * co);
        if (x >= 0 && y >= 0 && x < C && y < R) { const v = p.vol[b + y * C + x]; if (v > m) m = v; }
      }
      salida[base + u] = m;
    }
  }

  function pintarMip() {
    const cv = $('cvMip'), { g, w, h, d } = ajustar(cv);
    if (E.fase === 'vacio') { texto(g, d, ['Sin estudio'], 10 * d, 10 * d, '#667'); return; }
    const p = pet(), M = E.mip, clave = E.trabajo * 1000 + E.giro;
    if (M.ang !== clave) { M.ang = clave; M.hechas.fill(0); }
    for (let i = 0; i < p.n; i++) if (!M.hechas[i] && revelado(i)) { filaMip(p, i, E.giro, M.filas, i * p.cols); M.hechas[i] = 1; }
    const caja = encajar(w, h, p.cols * p.dx, p.n * p.dz, 22 * d), tope = E.nivelBase * E.nivel;
    const px = new Uint8ClampedArray(p.cols * p.n * 4);
    for (let i = 0; i < p.n; i++) for (let x = 0; x < p.cols; x++) {
      const o = (i * p.cols + x) * 4;
      const c = revelado(i) ? 255 - 255 * Math.min(1, M.filas[i * p.cols + x] / tope) : 22;
      px[o] = px[o + 1] = px[o + 2] = c; if (!revelado(i)) px[o + 2] = 34; px[o + 3] = 255;
    }
    volcar(g, px, p.cols, p.n, caja);
    E.cajaMip = { caja };
    const yc = caja.y + (E.corte + 0.5) * caja.h / p.n;
    g.strokeStyle = '#d33'; g.lineWidth = d; g.beginPath(); g.moveTo(caja.x, yc); g.lineTo(caja.x + caja.w, yc); g.stroke();
    const hechos = M.hechas.reduce((a, b) => a + b, 0);
    texto(g, d, [p.desc, 'MIP ' + E.giro + '°', hechos + ' / ' + p.n + ' cortes'], 8 * d, 8 * d, '#9fb0ff');
    $('rotMip').textContent = 'MIP';
  }

  function pintar() { pintarTopo(); pintarAxial(); pintarMip(); }

  // ---------- franja y cronica ----------
  function pintarFranja() {
    if (E.fase === 'vacio') { $('protocolo').textContent = 'PETCT (sin estudio)'; $('identidad').textContent = ''; $('resumen').textContent = ''; return; }
    const p = pet(), c = p.cab;
    $('protocolo').textContent = c.estudio || c.protocolo || 'PETCT';
    const oculto = $('ocultarId').checked;
    $('identidad').textContent = oculto ? 'Paciente oculto' : [c.nombre, c.id].filter(Boolean).join(' · ');
    const mci = c.dosis ? c.dosis / 3.7e7 : NaN;
    $('resumen').textContent = num(p.n * p.dz, 1) + ' mm   ' + num(E.total / 60, 0) + ' min   ' + (E.unidadDosis === 'mCi' ? num(mci, 1) + ' mCi' : num(c.dosis / 1e6, 0) + ' MBq');
  }

  function pasos() {
    const l = [];
    if (E.ct) { l.push({ id: 'topo', nombre: 'Topogram', cajas: [{ t: 'Topograma (proyección del CT)', hecha: true }] }); l.push({ id: 'ct', nombre: 'CT', cajas: [E.ct].concat(E.otrosCt).map(v => ({ t: v.desc, hecha: true })), num: 1 }); l.push({ pausa: true }); }
    const corriendo = E.fase === 'adquiriendo' || E.fase === 'pausa';
    l.push({ id: 'pet', nombre: corriendo ? 'PET ' + hms((E.total - E.reloj)) : 'PET', num: 2, cajas: E.pets.map((v, k) => ({ t: v.desc, hecha: E.fase === 'terminado', encurso: corriendo, actual: k === E.trabajo, trabajo: k })) });
    return l;
  }
  function pintarCronica() {
    const el = $('cronica');
    if (E.fase === 'vacio') { el.innerHTML = '<div class="paso pausa"><span class="nombre">Sin protocolo cargado</span></div>'; return; }
    el.innerHTML = pasos().map(p => p.pausa ? '<div class="paso pausa"><span class="nombre">Pause</span></div>' :
      '<div class="paso' + (p.id === E.paso ? ' sel' : '') + '" data-paso="' + p.id + '"><span class="nombre">' + esc(p.nombre) + '</span><span class="cajas">' +
      p.cajas.map(c => '<span class="cajita' + (c.hecha ? ' hecha' : '') + (c.encurso ? ' encurso' : '') + (c.actual && p.id === E.paso ? ' actual' : '') + '" title="' + esc(c.t) + '"' + (c.trabajo !== undefined ? ' data-trabajo="' + c.trabajo + '"' : '') + '></span>').join('') +
      '</span><span class="num">' + (p.num || '') + '</span></div>').join('');
    const b = $('btnStart');
    b.textContent = E.fase === 'adquiriendo' ? 'Suspend' : E.fase === 'pausa' ? 'Resume' : E.fase === 'terminado' ? 'Repeat' : 'Start';
    b.classList.toggle('rojo', E.fase === 'adquiriendo');
  }

  // ---------- tarjeta de parametros ----------
  const unir = (real, ops) => { const l = ops.map(String); const r = String(real); if (!l.includes(r)) l.push(r); return l; };
  function campo(et, valor, o = {}) {
    const v = (valor === undefined || valor === null || valor === '') ? '—' : String(valor);
    const ops = o.ops ? unir(v, o.ops) : null;
    return '<div class="campo"><label>' + esc(et) + '</label><span class="caja' + (o.larga ? ' larga' : '') + (ops || o.giro ? '' : ' fija') + '" data-et="' + esc(et) + '" data-valor="' + esc(v) + '"' +
      (ops ? ' data-ops="' + esc(JSON.stringify(ops)) + '"' : '') + (o.giro ? ' data-giro="1"' : '') + (o.accion ? ' data-accion="' + o.accion + '"' : '') + '><b>' + esc(v) + '</b>' + (ops ? '<i>▼</i>' : o.giro ? '<i>▲▼</i>' : '') + '</span>' +
      (o.un ? '<span class="un">' + esc(o.un) + '</span>' : '') + '</div>';
  }
  const marca2 = (et, si) => '<div class="campo"><label></label><span class="marca2"><span class="cuadro" data-et="' + esc(et) + '" data-valor="' + (si ? 'activado' : 'desactivado') + '" data-giro="1">' + (si ? '✓' : '') + '</span>' + esc(et) + '</span></div>';
  const bloque = (titulo, cuerpo) => '<div class="bloque">' + (titulo ? '<h4>' + esc(titulo) + '</h4>' : '') + cuerpo + '</div>';

  function partirMetodo(m) {
    const r = /^(.*?)[\s_]*(\d+)\s*i\s*(\d+)\s*s\s*$/i.exec(m || '');
    return r ? { metodo: r[1].trim(), it: +r[2], sub: +r[3] } : { metodo: m || '—', it: null, sub: null };
  }
  function partirFiltro(n) {
    const r = /(gauss|hann|hamm|butter|all)[a-z\- ]*\s*([\d.]+)?/i.exec(n || '');
    if (!r) return { filtro: n || '—', fwhm: null };
    const nombres = { gauss: 'Gaussian', hann: 'Hann', hamm: 'Hamming', butter: 'Butterworth', all: 'All-pass' };
    return { filtro: nombres[r[1].toLowerCase()], fwhm: r[2] ? parseFloat(r[2]) : null };
  }
  const ISOTOPOS = { fluor: 'F-18', carbon: 'C-11', nitrogen: 'N-13', oxygen: 'O-15', gallium: 'Ga-68', germanium: 'Ge-68', rubidium: 'Rb-82', copper: 'Cu-64', zirconium: 'Zr-89' };
  function isotopo(c) {
    const t = (c.nucleido || '').toLowerCase();
    const k = Object.keys(ISOTOPOS).find(q => t.includes(q));
    if (k) return ISOTOPOS[k];
    if (c.vidaMedia && Math.abs(c.vidaMedia - 6586) < 60) return 'F-18';
    return c.nucleido || '—';
  }

  function tarjetaPet(pest) {
    const p = pet(), c = p.cab, m = partirMetodo(c.metodo), fl = partirFiltro(c.nucleo);
    const mci = c.dosis ? c.dosis / 3.7e7 : NaN;
    const tIny = tmASeg(c.horaIny), tSer = tmASeg(c.horaSerie);
    const espera = (Number.isNaN(tIny) || Number.isNaN(tSer)) ? NaN : ((tSer - tIny + 86400) % 86400) / 60;
    const iguales = E.ct && Math.abs(E.ct.zs[0] - p.zs[0]) < p.dz && Math.abs(E.ct.zs[E.ct.n - 1] - p.zs[p.n - 1]) < p.dz;
    if (pest === 'routine') return '<div class="rejilla">' +
      bloque('', campo('Isotope', isotopo(c), { ops: Object.values(ISOTOPOS) }) +
        campo('Pharm.', c.farmaco, { ops: ['Fluorodeoxyglucose', 'PSMA', 'DOTATATE', 'Fluoride', 'Choline', 'Germanium'], larga: true }) +
        campo('Dose', E.unidadDosis === 'mCi' ? num(mci, 2) : num(c.dosis / 1e6, 1), { ops: null, un: E.unidadDosis, accion: 'unidad', giro: true }) +
        campo('Date', fechaDe((c.fechaHoraIny || '').slice(0, 8) || c.fechaSerie), { giro: true }) +
        campo('Time', horaDe(c.horaIny), { giro: true }) +
        campo('Uptake time', Number.isNaN(espera) ? '—' : num(espera, 0), { un: 'min (inyección → inicio del PET)' })) +
      bloque('', marca2('Scan range: Match CT Range', !!iguales) +
        campo('No. of beds', E.continuo ? 'continuo' : E.camas.length, { giro: true }) +
        campo('Scan duration/bed', num(E.dur / 60, 1), { ops: ['1.0', '1.5', '2.0', '2.5', '3.0', '4.0'], un: 'min' }) +
        campo('Range: Begin', num(p.zs[0], 1), { un: 'mm' }) + campo('End', num(p.zs[p.n - 1], 1), { un: 'mm' }) +
        campo('Scan direction', E.sentido, { ops: ['Craniocaudal', 'Caudocranial'] }) +
        campo('Patient position', c.posicion, { ops: ['HFS', 'FFS', 'HFP', 'FFP'] })) + '</div>';
    if (pest === 'scan') return '<div class="rejilla">' +
      bloque('', marca2('Auto Load', true) + marca2('Auto Move', false) + marca2('Auto Start', false) +
        campo('Scanner', [c.fabricante, c.modelo].filter(Boolean).join(' '), { larga: true }) + campo('Software', c.software) +
        campo('Axial FoV / bed', E.camas.length ? num(Math.max(...E.camas.map(q => q.c1 - q.c0 + 1)) * p.dz, 0) : '—', { un: 'mm (estimado)' }) +
        campo('Randoms', c.aleatorios) + campo('Axial acceptance', num(c.aceptacion, 0))) +
      bloque('Tasa relativa por cama (estimada desde la imagen)', '<canvas id="grafico"></canvas><div class="leyenda"><span style="--c:#1a9a3c">Actividad en el campo, relativa</span><span style="--c:#d33">Instante actual</span></div>') + '</div>';
    if (pest === 'recon') {
      const trabajos = [1, 2, 3, 4, 5, 6, 7, 8].map(k => '<span class="t' + (k <= E.pets.length ? ' hay' : '') + (k - 1 === E.trabajo ? ' sel' : '') + '" data-trabajo="' + (k - 1) + '">' + k + '<span class="p"></span></span>').join('');
      const tipo = c.corregida.includes('ATTN') ? 'Corrected' : 'Uncorrected';
      const listaCt = [E.ct].concat(E.otrosCt).filter(Boolean).map(v => v.desc);
      const acCt = (c.atenuacion || '').replace(/^measured,\s*/i, '').trim();
      const disp = /relative/i.test(c.dispersion) ? 'Relative' : /absolute/i.test(c.dispersion) ? 'Absolute' : (c.dispersion || 'None');
      return '<div class="trabajos"><span style="margin-right:8px">Recon job</span>' + trabajos + '<span style="flex:1"></span>' + campo('Series description', p.desc, { larga: true }) + '</div><div class="rejilla">' +
        bloque('', campo('Recon range: Begin', E.camas.length ? 1 : '—', { giro: true }) + campo('End', E.camas.length || '—', { giro: true }) +
          campo('Output image type', tipo, { ops: ['Corrected', 'Uncorrected'] }) +
          campo('Recon method', m.metodo, { ops: ['FBP', 'OSEM3D', 'OSEM3D+TOF', 'PSF', 'PSF+TOF'], larga: true }) +
          campo('Iterations', m.it, { ops: [1, 2, 3, 4, 5, 6, 8] }) + campo('Subsets', m.sub, { ops: [8, 10, 12, 20, 21, 24] })) +
        bloque('', campo('Image size', p.colsOrig, { ops: [128, 168, 180, 200, 256, 360, 400] }) +
          campo('Pixel', num(p.psOrig, 2), { un: 'mm' }) + campo('FoV', num(p.colsOrig * p.psOrig, 0), { un: 'mm' }) +
          campo('Slice', num(p.dz, 1), { un: 'mm' }) +
          campo('Filter', fl.filtro, { ops: ['All-pass', 'Gaussian', 'Hann', 'Hamming', 'Butterworth'] }) +
          campo('FWHM (mm)', fl.fwhm === null ? '—' : num(fl.fwhm, 1), { ops: ['2.0', '3.0', '4.0', '5.0', '6.0', '8.0'] })) +
        bloque('', campo('Attenuation correction CT', tipo === 'Corrected' ? (acCt || '—') : 'None', { ops: tipo === 'Corrected' ? listaCt : ['None'].concat(listaCt), larga: true }) +
          campo('Scatter correction', tipo === 'Corrected' ? disp : 'None', { ops: ['Relative', 'Absolute', 'None'] }) +
          campo('Decay correction', c.decaimiento, { ops: ['START', 'ADMIN', 'NONE'] }) +
          campo('Units', c.unidades) +
          campo('Corrections', c.corregida.join(' ') || '—', { larga: true })) + '</div>' +
        '<p class="ayudita">Abre una lista para ver qué otras opciones ofrece una consola. El valor marcado es el de la cabecera DICOM; las alternativas son ilustrativas y no cambian la imagen.</p>';
    }
    return tarjetaAuto(c);
  }

  function tarjetaCt(pest) {
    const v = E.ct, c = v.cab;
    const ventanas = c.ventanaC.map((x, i) => 'C ' + x + ' / W ' + c.ventanaA[i]).join('   ');
    if (pest === 'routine') return '<div class="rejilla">' +
      bloque('', campo('Eff. mAs', num(v.masMedio, 0), { giro: true, un: 'medio de los cortes' }) + campo('kV', num(c.kv, 0), { ops: [80, 100, 110, 120, 130, 140] }) +
        campo('Tube current', num(v.maMedio, 0), { un: 'mA, medio' }) + campo('CTDIvol', num(v.ctdiMedio, 2), { un: 'mGy, medio' }) +
        campo('Patient position', c.posicion, { ops: ['HFS', 'FFS', 'HFP', 'FFP'] })) +
      bloque('', campo('Slice', num(c.grosor, 1), { ops: ['1.0', '1.5', '2.0', '3.0', '4.0', '5.0'], un: 'mm' }) +
        campo('Pitch', num(c.paso, 2), { giro: true }) + campo('No. of images', v.n, { giro: true }) +
        campo('Range: Begin', num(v.zs[0], 1), { un: 'mm' }) + campo('End', num(v.zs[v.n - 1], 1), { un: 'mm' })) + '</div>';
    if (pest === 'scan') return '<div class="rejilla">' +
      bloque('', campo('Exposure time', num(c.tExp, 0), { un: 'ms' }) + campo('Tube current', num(v.maMedio, 0), { un: 'mA, medio' }) +
        campo('Filter type', c.filtro) + campo('Scanner', [c.fabricante, c.modelo].filter(Boolean).join(' '), { larga: true })) +
      bloque('', campo('Scan start', 'Start button', { ops: ['Start button', 'Delay'] }) + campo('Direction', E.sentido === '—' ? 'Craniocaudal' : E.sentido, { ops: ['Craniocaudal', 'Caudocranial'] })) + '</div>';
    if (pest === 'recon') return '<div class="rejilla">' +
      bloque('', campo('Series description', v.desc, { larga: true }) + campo('Slice', num(c.grosor, 1), { ops: ['1.0', '1.5', '2.0', '3.0', '4.0', '5.0'], un: 'mm' }) +
        campo('Kernel', c.nucleo, { ops: ['B20s', 'B31s', 'B41s', 'B60s', 'B70s'] }) + campo('Window', ventanas || '—', { larga: true })) +
      bloque('', campo('FoV', num(c.fov, 0), { ops: [300, 400, 500, 700, 780], un: 'mm' }) +
        campo('Image size', v.colsOrig, { ops: [512] }) + campo('Pixel', num(v.psOrig, 2), { un: 'mm' }) +
        campo('Increment', num(v.dz, 1), { un: 'mm' }) + campo('Uso', 'Corrección de atenuación y localización', { larga: true })) + '</div>' +
      '<p class="ayudita">El CT se muestra reducido a ' + v.cols + ' × ' + v.rows + ' para aligerar la página; los valores de la tarjeta son los de la cabecera.</p>';
    return tarjetaAuto(c);
  }

  function tarjetaTopo() {
    const c = E.ct.cab;
    return '<div class="rejilla">' + bloque('', campo('kV', num(c.kv, 0)) + campo('Topogram length', num(E.ct.n * E.ct.dz, 0), { un: 'mm' }) +
      campo('Tube position', 'Top', { ops: ['Top', 'Bottom', 'Lateral'] })) +
      bloque('', '<p class="ayudita" style="font-size:13px">El estudio no trae la serie del topograma. La imagen de arriba a la izquierda es una proyección anteroposterior calculada con el CT, y sobre ella se dibujan el rango y las camas del PET.</p>') + '</div>';
  }

  const tarjetaAuto = c => '<div class="rejilla">' +
    bloque('', marca2('Auto recon', true) + marca2('Auto viewing', false) + campo('Auto transfer', 'None', { ops: ['None', 'PACS'] })) +
    bloque('', campo('Requested procedure', c.estudio, { larga: true }) + campo('Body part examined', c.parte || '—')) + '</div>';

  function pintarTarjeta() {
    document.querySelectorAll('.pestana').forEach(b => b.classList.toggle('activa', b.dataset.pestana === E.pestana));
    const el = $('contenido');
    if (E.fase === 'vacio') { el.innerHTML = '<p style="margin:30px;color:#4a4c55">Pulsa «Load» y elige la carpeta o los ZIP del estudio: la serie PET corregida por atenuación y, si la tienes, su CT. Puedes agregar también el PET sin corregir.</p>'; return; }
    el.innerHTML = E.paso === 'ct' ? tarjetaCt(E.pestana) : E.paso === 'topo' ? tarjetaTopo() : tarjetaPet(E.pestana);
    pintarGrafico();
  }

  function pintarGrafico() {
    const cv = $('grafico'); if (!cv || E.fase === 'vacio') return;
    const r = cv.getBoundingClientRect(); cv.width = Math.max(100, r.width); cv.height = Math.max(60, r.height);
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, mi = 34, ms = 8, mb = 20;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#999'; g.lineWidth = 1; g.strokeRect(mi, ms, W - mi - 8, H - ms - mb);
    g.fillStyle = '#555'; g.font = '10px Arial'; g.textAlign = 'right'; g.textBaseline = 'middle';
    [0, 50, 100].forEach(v => g.fillText(v, mi - 4, ms + (H - ms - mb) * (1 - v / 110)));
    const xDe = t => mi + (W - mi - 8) * t / E.total, yDe = v => ms + (H - ms - mb) * (1 - v / 110);
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = 0; t <= E.total; t += Math.max(60, Math.round(E.total / 8 / 60) * 60)) g.fillText(Math.round(t / 60) + ' min', xDe(t), H - mb + 4);
    if (!E.camas.length) return;
    const hasta = (E.fase === 'listo') ? 0 : E.reloj;
    g.strokeStyle = '#1a9a3c'; g.lineWidth = 2; g.beginPath(); let abierto = false;
    E.camas.forEach(c => {
      if (c.t > hasta) return;
      const fin = Math.min(c.t + E.dur, hasta);
      if (!abierto) { g.moveTo(xDe(c.t), yDe(c.tasa)); abierto = true; } else g.lineTo(xDe(c.t), yDe(c.tasa));
      g.lineTo(xDe(fin), yDe(c.tasa));
    });
    g.stroke();
    if (E.fase !== 'listo') { g.strokeStyle = '#d33'; g.lineWidth = 1; g.beginPath(); g.moveTo(xDe(hasta), ms); g.lineTo(xDe(hasta), H - mb); g.stroke(); }
  }

  function refrescarTodo() { pintarFranja(); pintarCronica(); pintarTarjeta(); pintar(); }

  // ---------- listas que ya no se pueden cambiar ----------
  function abrirLista(caja) {
    const ops = JSON.parse(caja.dataset.ops), real = caja.dataset.valor, l = $('lista');
    l.innerHTML = ops.map(o => '<div class="' + (o === real ? 'real' : '') + '" data-op="' + esc(o) + '">' + esc(o) + '</div>').join('') + '<div class="pie">Marcado: valor usado en este estudio.</div>';
    l.hidden = false;
    const r = caja.getBoundingClientRect(), alto = l.offsetHeight;
    l.style.left = Math.min(r.left, window.innerWidth - l.offsetWidth - 6) + 'px';
    l.style.top = (r.bottom + alto > window.innerHeight ? Math.max(4, r.top - alto) : r.bottom) + 'px';
    l.style.minWidth = r.width + 'px';
    l.dataset.et = caja.dataset.et; l.dataset.valor = real; E.cajaAbierta = caja;
  }
  function fijo(et, valor, caja, pedido) {
    const donde = E.fase === 'terminado' ? 'la serie ya fue reconstruida' : 'el examen ya quedó programado con ese valor';
    decir('«' + et + '» se mantiene en ' + valor + (pedido ? ' (no en ' + pedido + ')' : '') + ': ' + donde + ' y los datos crudos no vienen en el DICOM.', true);
    if (caja) { caja.classList.remove('parpadeo'); void caja.offsetWidth; caja.classList.add('parpadeo'); }
  }

  // ---------- eventos ----------
  function moverCorte(i) { if (E.fase === 'vacio') return; E.corte = Math.max(0, Math.min(pet().n - 1, i)); pintar(); }
  function lecturaAxial(ev) {
    if (E.fase === 'vacio' || !E.cajaAxial) return;
    const cv = $('cvAxial'), r = cv.getBoundingClientRect(), k = cv.width / r.width, A = E.cajaAxial, p = pet();
    const fx = A.x0 + ((ev.clientX - r.left) * k - A.caja.x) / A.caja.w * A.ancho, fy = A.y0 + ((ev.clientY - r.top) * k - A.caja.y) / A.caja.h * A.alto;
    const x = Math.round((fx - p.x0) / p.dx), y = Math.round((fy - p.y0) / p.dy);
    let t = '';
    if (E.modo !== 'ct' && revelado(E.corte) && x >= 0 && y >= 0 && x < p.cols && y < p.rows) {
      const v = p.vol[(E.corte * p.rows + y) * p.cols + x];
      t = num(v, 0) + ' ' + (p.cab.unidades || '');
      const c = p.cab;
      if (c.unidades === 'BQML' && c.peso > 0 && c.dosis > 0) {
        const tI = tmASeg(c.horaIny), tS = tmASeg(c.horaSerie);
        const dec = (c.vidaMedia && !Number.isNaN(tI) && !Number.isNaN(tS)) ? Math.exp(-LN2 * ((tS - tI + 86400) % 86400) / c.vidaMedia) : 1;
        t += '   SUVbw ' + num(v / (c.dosis * dec / (c.peso * 1000)), 2);
      }
    } else if (E.modo === 'ct' && E.ct && E.ct.dePet[E.corte] >= 0) {
      const ct = E.ct, cx = Math.floor((fx - (ct.x0 - ct.dx / 2)) / ct.dx), cy = Math.floor((fy - (ct.y0 - ct.dy / 2)) / ct.dy);
      if (cx >= 0 && cy >= 0 && cx < ct.cols && cy < ct.rows) t = ct.vol[(ct.dePet[E.corte] * ct.rows + cy) * ct.cols + cx] + ' HU';
    }
    if (t !== E.lectura) { E.lectura = t; pintarAxial(); }
  }
  function clicVertical(cv, cajaInfo, ev) {
    if (E.fase === 'vacio' || !cajaInfo) return;
    const r = cv.getBoundingClientRect(), y = (ev.clientY - r.top) * cv.height / r.height, c = cajaInfo.caja;
    moverCorte(Math.floor((y - c.y) / c.h * pet().n));
  }

  function enlazar() {
    $('btnLoad').onclick = () => { $('menuCarga').hidden = false; };
    $('cerrarCarga').onclick = () => { $('menuCarga').hidden = true; };
    $('elegirCarpeta').onclick = () => $('entradaCarpeta').click();
    $('elegirArchivos').onclick = () => $('entradaArchivos').click();
    ['entradaCarpeta', 'entradaArchivos'].forEach(id => { $(id).onchange = ev => { $('menuCarga').hidden = true; const f = Array.from(ev.target.files); ev.target.value = ''; cargar(f); }; });
    $('btnAcerca').onclick = () => { $('acerca').hidden = false; };
    $('cerrarAcerca').onclick = () => { $('acerca').hidden = true; };
    $('btnStart').onclick = () => { if (E.fase === 'adquiriendo') pausar(); else iniciar(); };
    $('btnSkip').onclick = terminar;
    $('vel').onchange = ev => { E.vel = +ev.target.value; };
    $('ocultarId').onchange = pintarFranja;
    $('corte').oninput = ev => moverCorte(+ev.target.value);
    $('giro').oninput = ev => { E.giro = +ev.target.value; pintarMip(); };
    $('nivel').oninput = ev => { E.nivel = +ev.target.value / 100; pintar(); };
    document.querySelectorAll('button.modo').forEach(b => { b.onclick = () => { E.modo = b.dataset.modo; pintar(); }; });
    document.querySelectorAll('.pestana').forEach(b => { b.onclick = () => { E.pestana = b.dataset.pestana; pintarTarjeta(); }; });
    $('cvAxial').addEventListener('wheel', ev => { ev.preventDefault(); moverCorte(E.corte + (ev.deltaY > 0 ? 1 : -1)); }, { passive: false });
    $('cvAxial').addEventListener('mousemove', lecturaAxial);
    $('cvTopo').addEventListener('click', ev => clicVertical($('cvTopo'), E.cajaTopo, ev));
    $('cvMip').addEventListener('click', ev => clicVertical($('cvMip'), E.cajaMip, ev));
    $('cronica').addEventListener('click', ev => {
      const c = ev.target.closest('.cajita'), p = ev.target.closest('.paso');
      if (!p || !p.dataset.paso) return;
      E.paso = p.dataset.paso;
      if (c && c.dataset.trabajo !== undefined) { E.trabajo = +c.dataset.trabajo; E.pestana = 'recon'; }
      if (E.paso === 'ct' || E.paso === 'topo') { if (E.modo === 'pet') E.modo = 'ct'; } else if (E.modo === 'ct') E.modo = 'pet';
      refrescarTodo();
    });
    $('contenido').addEventListener('click', ev => {
      const t = ev.target.closest('.t');
      if (t) { const k = +t.dataset.trabajo; if (k < E.pets.length) { E.trabajo = k; refrescarTodo(); decir('Trabajo de reconstrucción ' + (k + 1) + ': ' + pet().desc + '.'); } else decir('El trabajo de reconstrucción ' + (k + 1) + ' está vacío: este estudio trae ' + E.pets.length + ' serie(s) PET.', true); return; }
      const caja = ev.target.closest('[data-et]');
      if (!caja) return;
      if (caja.dataset.accion === 'unidad') { E.unidadDosis = E.unidadDosis === 'mCi' ? 'MBq' : 'mCi'; pintarFranja(); pintarTarjeta(); decir('La actividad se muestra en ' + E.unidadDosis + '. Es el mismo valor de la cabecera, en otra unidad.'); return; }
      if (caja.dataset.ops) { ev.stopPropagation(); abrirLista(caja); return; }
      if (caja.dataset.giro) fijo(caja.dataset.et, caja.dataset.valor, caja.classList.contains('caja') ? caja : null);
    });
    $('lista').addEventListener('click', ev => {
      const o = ev.target.closest('[data-op]'), l = $('lista');
      if (!o) return;
      l.hidden = true;
      if (o.dataset.op === l.dataset.valor) decir('«' + l.dataset.et + '»: ' + l.dataset.valor + ' es el valor con que se hizo este estudio.');
      else fijo(l.dataset.et, l.dataset.valor, E.cajaAbierta, o.dataset.op);
    });
    document.addEventListener('click', ev => { if (!$('lista').hidden && !ev.target.closest('#lista')) $('lista').hidden = true; });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { $('lista').hidden = true; $('menuCarga').hidden = true; $('acerca').hidden = true; }
      if (ev.key === 'ArrowDown') moverCorte(E.corte + 1);
      if (ev.key === 'ArrowUp') moverCorte(E.corte - 1);
    });
    window.addEventListener('resize', () => { pintar(); pintarGrafico(); });
    setInterval(() => { const a = new Date(); $('reloj').textContent = fechaDe(a.getFullYear() + String(a.getMonth() + 1).padStart(2, '0') + String(a.getDate()).padStart(2, '0')) + ' ' + a.toTimeString().slice(0, 8); }, 1000);
  }

  window.addEventListener('error', ev => { (window.__errores = window.__errores || []).push(String(ev.message)); });
  enlazar(); refrescarTodo();
  window.ConsolaPet = { estado: E, cargar, iniciar, pausar, terminar, revelado, camaActual };
})();
