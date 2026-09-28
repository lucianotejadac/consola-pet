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
    camas: [], espacial: [], sel: [], completa: null, total: 0, continuo: false,
    b0: 0, b1: 0, r0: 0, r1: 0, largo: 0, ctDur: 0, relojCt: 0, ac: null, nac: null, derecha: 'mipac',
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
    const BINARIOS = ['x00189311', 'x00189345', 'x00189309', 'x00189324', 'x00189306', 'x00189307', 'x00189310'];
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
      ma: f('x00181151'), mas: f('x00181152'), ctdi: f('x00189345'), tExp: f('x00181150'), paso: f('x00189311'),
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
      // El CT se conserva a su resolucion original, como en Volumina.
      const v = new Int16Array(n);
      for (let i = 0; i < n; i++) v[i] = Math.round(crudo[i] * im.slope + im.inter);
      im.pix = v;
    }
    im.cab = cabecera(ds, s, f, lista);
    return im;
  }

  function cabecera(ds, s, f, lista) {
    const c = {
      fabricante: s('x00080070'), modelo: s('x00081090'), software: s('x00181020'),
      estudio: s('x00081030'), serie: s('x0008103e'), protocolo: s('x00181030'),
      derivacion: s('x00082111'), marco: s('x00200052'), estudioUid: s('x0020000d'), estudioId: s('x00200010'), sopClass: s('x00080016'), horaEstudio: s('x00080030'),
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
      paso: f('x00189311'), ctdi: f('x00189345'), velMesa: f('x00189309'), factorSuv: f('x70531000'),
      modTipo: s('x00189323'), ahorro: f('x00189324'), colUna: f('x00189306'), colTotal: f('x00189307'), avance: f('x00189310'), fov: f('x00181100'), fovDatos: f('x00180090'),
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

  // Serie sin correccion de atenuacion. Algunos equipos marcan ATTN tambien en la serie sin
  // corregir, asi que la descripcion de la serie manda sobre la lista de correcciones.
  const DESC_NAC = new RegExp('(^|[^a-z])nac([^a-z]|$)|uncorr|non.?ac([^a-z]|$)|(^|[^a-z])no.?ac([^a-z]|$)|sin corr', 'i');
  const esNac = v => DESC_NAC.test(v.desc || '') || !v.cab.corregida.includes('ATTN');

  // ---------- armado de volumenes ----------
  function armarSerie(ims) {
    ims.sort((a, b) => b.z - a.z);                         // indice 0 = corte mas craneal (HFS)
    const limpio = ims.filter((im, i) => i === 0 || Math.abs(im.z - ims[i - 1].z) > 1e-3);
    const p = limpio[0], n = limpio.length;
    // Tope de Volumina: 128 millones de voxeles. Solo si el CT lo supera se reduce a la mitad.
    const k = (p.mod === 'CT' && n * p.rows * p.cols > 128 * 1024 * 1024) ? 2 : 1;
    const rows = Math.floor(p.rows / k), cols = Math.floor(p.cols / k);
    const vol = p.mod === 'CT' ? new Int16Array(n * rows * cols) : new Float32Array(n * rows * cols);
    limpio.forEach((im, i) => {
      if (im.pix.length === p.rows * p.cols) {
        if (k === 1) vol.set(im.pix, i * rows * cols);
        else for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { let a = 0; for (let j = 0; j < k; j++) for (let q = 0; q < k; q++) a += im.pix[(y * k + j) * p.cols + x * k + q]; vol[i * rows * cols + y * cols + x] = Math.round(a / (k * k)); }
      }
      im.pix = null;
    });
    const media = c => { const l = limpio.map(im => im[c]).filter(v => !Number.isNaN(v)); return l.length ? l.reduce((a, b) => a + b, 0) / l.length : NaN; };
    const topes = limpio.map(im => im.tope).filter(v => !Number.isNaN(v)).sort((a, b) => a - b);
    return {
      maMedio: media('ma'), masMedio: media('mas'), ctdiMedio: media('ctdi'), topeMediano: topes.length ? topes[Math.floor(topes.length / 2)] : NaN,
      mod: p.mod, uid: p.serie, desc: p.desc, cab: p.cab, n, rows, cols, vol, reducido: k,
      // Un CT recortado lo declara en su cabecera, con la matriz con que se adquirio.
      recorte: (() => { const m = /recortado.*?Matriz original (\d+) x (\d+)/i.exec(p.cab.derivacion || ''); return m ? { cols: +m[1], rows: +m[2] } : null; })(),
      dx: p.ps[1] * k, dy: p.ps[0] * k,
      x0: p.ipp[0] + (k - 1) * p.ps[1] / 2, y0: p.ipp[1] + (k - 1) * p.ps[0] / 2,
      zs: limpio.map(im => im.z), dz: n > 1 ? Math.abs(limpio[0].z - limpio[n - 1].z) / (n - 1) : (p.cab.grosor || 1),
      maZ: limpio.map(im => im.ma), ctdiZ: limpio.map(im => im.ctdi),
      // mAs efectivo por corte: el de la cabecera o, si falta, corriente x tiempo de rotacion / pitch.
      masZ: limpio.map(im => !Number.isNaN(im.mas) ? im.mas : (im.ma * im.tExp / 1000 / (im.paso > 0 ? im.paso : 1))),
      tiempos: (() => {
        // Algunos equipos escriben la misma hora de adquisicion en todos los cortes y dejan la cama
        // en el tiempo de referencia del cuadro, que es la mitad de la cama: inicio = referencia - duracion / 2.
        const t = limpio.map(im => im.tAdq), ref = limpio.map(im => im.tRef), dur = p.cab.duracion || 0;
        const distintos = l => new Set(l.filter(x => !Number.isNaN(x)).map(x => Math.round(x))).size;
        return (distintos(t) <= 1 && distintos(ref.map(x => x / 1000)) > 1) ? ref.map(x => (x - dur / 2) / 1000) : t;
      })(),
      colsOrig: p.cols, rowsOrig: p.rows, psOrig: p.ps[1],
    };
  }

  function estimarCamas(pet) {
    const t = pet.tiempos, n = pet.n;
    const dur = (pet.cab.duracion || 0) / 1000;
    const validos = t.filter(v => !Number.isNaN(v));
    if (!validos.length) return { camas: [{ t: 0, i0: 0, i1: n - 1, c0: 0, c1: n - 1 }], completa: new Float32Array(n).fill(dur || 60), total: dur || 60, dur: dur || 60, continuo: false, sentido: '—' };
    // Mesetas: tramos de al menos 5 cortes con la misma hora. Cada una es el centro de una cama.
    let mes = [], i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && Math.abs(t[j + 1] - t[i]) <= 1.01) j++;
      if (j - i + 1 >= 5) mes.push({ t: t[Math.floor((i + j) / 2)], i0: i, i1: j });
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
    const corr = v => !esNac(v);
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
    { const m = /^PET-0?(\d+)$/i.exec(principal.cab.id || ''); E.caso = (m && window.PET_CASOS && window.PET_CASOS[+m[1]]) ? +m[1] : 0; }
    E.espacial = E.camas.slice().sort((a, b) => a.c0 - b.c0);
    E.pets.forEach(v => { v.nivelBase = v.topeMediano > 0 ? v.topeMediano : percentil(v.vol, 0.999); });
    E.ac = E.pets.find(corr) || null; E.nac = E.pets.find(v => !corr(v)) || null;
    E.derecha = E.ac ? 'mipac' : 'mipnac';
    if (E.ct) { const t = E.ct.tiempos; E.ctSentido = (Number.isNaN(t[0]) || Number.isNaN(t[E.ct.n - 1]) || t[0] === t[E.ct.n - 1]) ? 'Craniocaudal' : (t[0] < t[E.ct.n - 1] ? 'Craniocaudal' : 'Caudocranial'); }
    E.topo = topograma(E.ct || principal, !!E.ct);
    E.nivel = 1; $('nivel').value = 100; E.giro = 0; $('giro').value = 0;
    E.mip = { clave: '', filas: new Float32Array(principal.n * principal.cols), hechas: new Uint8Array(principal.n) };
    planificar(); baseSim();
    const partes = [E.pets.length + ' serie(s) PET de ' + principal.n + ' cortes', E.ct ? 'CT de ' + E.ct.n + ' cortes a ' + E.ct.cols + ' × ' + E.ct.rows + (E.ct.recorte ? ', recortado desde ' + E.ct.recorte.cols + ' × ' + E.ct.recorte.rows : '') + ' (' + Math.round(E.ct.vol.length * 2 / 1048576) + ' MB)' : 'sin CT', E.continuo ? 'camilla en movimiento continuo' : E.camas.length + ' cama(s) disponibles de ' + num(E.dur / 60, 1) + ' min'];
    decir((E.caso ? 'Caso ' + E.caso + ' cargado: ' : 'Estudio cargado: ') + partes.join(', ') + '. ' + AYUDA_RANGO + (E.ignoradas.length ? ' Series no usadas: ' + E.ignoradas.join(', ') + '.' : ''));
    refrescarTodo();
  }

  function percentil(v, q) {
    const m = []; for (let i = 0; i < v.length; i += 37) if (v[i] > 0) m.push(v[i]);
    m.sort((a, b) => a - b); return m[Math.floor(m.length * q)] || 1;
  }

  // ---------- plan, rango y reproduccion ----------
  const AYUDA_RANGO = 'Arrastra los bordes del rango sobre el topograma y pulsa «Start». El rango se ajusta a camas completas.';
  const FASES_PET = ['adquiriendo', 'pausa', 'terminado'];
  const CT_HECHO = ['entre', 'adquiriendo', 'pausa', 'terminado'];

  function planificar() {
    pararReloj();
    E.fase = 'rango'; E.reloj = 0; E.relojCt = 0;
    E.paso = E.ct ? 'ct' : 'pet'; E.pestana = 'routine'; E.modo = E.ct ? 'ct' : 'pet'; E.trabajo = 0;
    if (E.continuo) fijarCortes(0, Math.floor(E.pets[0].n / 2));
    else fijarRango(0, Math.max(0, Math.ceil(E.espacial.length / 2) - 1));
    $('btnStart').disabled = false; $('btnSkip').disabled = false;
  }
  // Rango por camas completas: de la cama b0 a la b1, contadas de craneal a caudal.
  function fijarRango(b0, b1) {
    const p = E.pets[0], n = E.espacial.length;
    b0 = Math.max(0, Math.min(n - 1, b0)); b1 = Math.max(b0, Math.min(n - 1, b1));
    E.b0 = b0; E.b1 = b1;
    const sel = E.espacial.slice(b0, b1 + 1), t0 = Math.min(...sel.map(c => c.t));
    sel.forEach(c => { c.ts = c.t - t0; });
    E.sel = sel.slice().sort((a, b) => a.ts - b.ts);
    E.r0 = Math.min(...sel.map(c => c.c0)); E.r1 = Math.max(...sel.map(c => c.c1));
    E.total = Math.max(...sel.map(c => c.ts)) + E.dur;
    E.completa = new Float32Array(p.n).fill(Infinity);
    for (let i = E.r0; i <= E.r1; i++) { let fin = 0; sel.forEach(c => { if (i >= c.c0 && i <= c.c1) fin = Math.max(fin, c.ts + E.dur); }); if (fin) E.completa[i] = fin; }
    alFijar();
  }
  // Camilla en movimiento continuo: no hay camas, el rango se fija por cortes.
  function fijarCortes(r0, r1) {
    const p = E.pets[0];
    r0 = Math.max(0, Math.min(p.n - 1, r0)); r1 = Math.max(r0, Math.min(p.n - 1, r1));
    E.r0 = r0; E.r1 = r1; E.sel = [];
    const t = p.tiempos.slice(r0, r1 + 1).filter(v => !Number.isNaN(v)), t0 = t.length ? Math.min(...t) : 0;
    E.completa = new Float32Array(p.n).fill(Infinity); E.total = E.dur;
    for (let i = r0; i <= r1; i++) { E.completa[i] = (Number.isNaN(p.tiempos[i]) ? 0 : p.tiempos[i] - t0) + E.dur; E.total = Math.max(E.total, E.completa[i]); }
    alFijar();
  }
  function alFijar() {
    const p = E.pets[0];
    E.largo = (E.r1 - E.r0 + 1) * p.dz;
    const vm = E.ct ? E.ct.cab.velMesa : NaN;
    E.ctDur = E.ct ? (vm > 0 ? E.largo / vm : 10) : 0;
    E.ctDurReal = vm > 0;
    E.corte = Math.round((E.r0 + E.r1) / 2);
    $('corte').min = E.r0; $('corte').max = E.r1; $('corte').value = E.corte;
    if (E.mip) { E.mip.hechas.fill(0); E.mip.clave = ''; }
  }

  let marca = 0, cuadro = 0;
  function pararReloj() { if (cuadro) cancelAnimationFrame(cuadro); cuadro = 0; }
  function arrancar() { marca = performance.now(); pararReloj(); cuadro = requestAnimationFrame(latido); }
  function latido(ahora) {
    const dt = Math.min(0.25, (ahora - marca) / 1000); marca = ahora;
    if (E.fase === 'ct') {
      // El CT dura segundos: salvo en tiempo real, se reproduce en al menos 4 s para que se alcance a ver.
      E.relojCt += dt * (E.vel === 1 ? 1 : Math.min(E.vel, Math.max(1, E.ctDur / 4)));
      if (E.relojCt >= E.ctDur) { finCt(); return; }
      pintar(); pintarCronica(); pintarGrafico();
      decir('Adquiriendo el CT: ' + num(E.relojCt, 1) + ' de ' + num(E.ctDur, 1) + ' s…');
    } else if (E.fase === 'adquiriendo') {
      E.reloj += dt * E.vel;
      if (E.reloj >= E.total) { finPet(); return; }
      pintar(); pintarCronica(); pintarGrafico();
      const k = camaActual();
      decir(E.continuo ? 'Adquiriendo el PET con la camilla en movimiento continuo…' : (k >= 0 ? 'Adquiriendo el PET: cama ' + (k + 1) + ' de ' + E.sel.length + '…' : 'Moviendo la camilla a la cama siguiente…'));
    } else { cuadro = 0; return; }
    cuadro = requestAnimationFrame(latido);
  }
  function iniciarPet() { if (E.fase !== 'pausa') E.reloj = 0; E.fase = 'adquiriendo'; E.paso = 'pet'; E.pestana = 'routine'; if (E.modo === 'ct') E.modo = 'pet'; }
  function iniciar() {
    if (E.fase === 'vacio' || E.fase === 'ct') return;
    if (E.fase === 'terminado') { planificar(); baseSim(); decir('Examen nuevo. ' + AYUDA_RANGO); refrescarTodo(); return; }
    if (E.fase === 'rango' && E.ct) { E.fase = 'ct'; E.relojCt = 0; E.paso = 'ct'; E.modo = 'ct'; E.pestana = 'routine'; }
    else iniciarPet();
    arrancar(); refrescarTodo();
  }
  function pausar() { if (E.fase !== 'adquiriendo') return; E.fase = 'pausa'; pararReloj(); decir('Adquisición suspendida. Pulsa «Resume» para continuar.', true); refrescarTodo(); }
  function finCt() {
    pararReloj(); E.relojCt = E.ctDur; E.fase = 'entre'; E.paso = 'pet'; E.pestana = 'routine'; E.modo = 'ct';
    decir('CT adquirido: ' + (E.r1 - E.r0 + 1) + ' cortes en ' + num(E.ctDur, 1) + ' s. Revísalo (ya puedes cambiar sus parámetros en azul) y pulsa «Start» para adquirir el PET sobre el mismo rango.');
    refrescarTodo();
  }
  function finPet() {
    pararReloj(); E.reloj = E.total; E.fase = 'terminado'; if (E.modo === 'ct') E.modo = 'pet';
    simularPet();
    decir('Examen terminado: ' + E.pets.map(v => v.desc).join(' y ') + ' reconstruidas. Ahora puedes cambiar los parámetros en azul y ver su efecto simulado' + (E.nac && E.ac ? ', y comparar la serie sin corregir en la ventana derecha.' : '.'));
    refrescarTodo();
  }
  // Skip salta la etapa en curso: del rango o del CT a la pausa, y de ahi al examen terminado.
  function saltar() {
    if (E.fase === 'vacio' || E.fase === 'terminado') return;
    if ((E.fase === 'rango' || E.fase === 'ct') && E.ct) finCt(); else finPet();
  }
  function terminar() { if (E.fase === 'vacio') return; if (E.ct) E.relojCt = E.ctDur; finPet(); }
  const camaActual = () => E.sel.findIndex(c => E.reloj >= c.ts && E.reloj < c.ts + E.dur);
  const enRango = i => i >= E.r0 && i <= E.r1;
  const revelado = i => enRango(i) && (E.fase === 'terminado' || ((E.fase === 'adquiriendo' || E.fase === 'pausa') && E.reloj >= E.completa[i]));
  // El CT avanza en su sentido real; i es el indice del corte PET que le corresponde.
  function ctVisible(i) {
    if (!E.ct || !enRango(i) || E.ct.dePet[i] < 0) return false;
    if (CT_HECHO.includes(E.fase)) return true;
    if (E.fase !== 'ct') return false;
    const n = E.r1 - E.r0 + 1, f = E.relojCt / E.ctDur;
    return (E.ctSentido === 'Caudocranial' ? (E.r1 - i + 1) : (i - E.r0 + 1)) / n <= f;
  }

  // ---------- simulacion de calidad de imagen ----------
  // Regla: la adquisicion real es el techo de calidad. Cada control ofrece el valor del estudio
  // o valores que degradan la imagen; nunca uno que la mejore. Todo el efecto es simulado sobre
  // la imagen ya reconstruida: no se adquiere ni se reconstruye de nuevo.
  const KV_TABLA = { 70: { dose: 0.33, bone: 1.27, soft: 1.10 }, 80: { dose: 0.484, bone: 1.19, soft: 1.07 }, 100: { dose: 0.813, bone: 1.06, soft: 1.02 }, 110: { dose: 1, bone: 1, soft: 1 }, 120: { dose: 1.209, bone: 0.96, soft: 0.99 }, 130: { dose: 1.429, bone: 0.92, soft: 0.98 }, 140: { dose: 1.659, bone: 0.89, soft: 0.97 } };
  const kvDe = kv => { const k = Object.keys(KV_TABLA).map(Number); let m = k[0]; k.forEach(x => { if (Math.abs(x - kv) < Math.abs(m - kv)) m = x; }); return KV_TABLA[m]; };
  const PISOS = { tCama: 0.5, actBq: 37e6, ref: 20 };
  const CLAVES_CT = ['ref', 'mod', 'kv', 'thk', 'ker'], CLAVES_PET = ['tCama', 'actF', 'capt', 'iter', 'fwhm'];

  function azar(semilla) { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function ruidoUnidad(buf, semilla) { const r = azar(semilla); for (let i = 0; i < buf.length; i++) buf[i] = (r() + r() + r() - 1.5) * 2; }
  function normaDe(buf) { let q = 0, c = 0; for (let i = 0; i < buf.length; i += 7) { q += buf[i] * buf[i]; c++; } return 1 / (Math.sqrt(q / c) || 1); }
  function desenfocar(a, tmp, W, H, sigma) {
    if (sigma <= 0.02) return;
    const rad = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(2 * rad + 1); let q = 0;
    for (let i = -rad; i <= rad; i++) { k[i + rad] = Math.exp(-i * i / (2 * sigma * sigma)); q += k[i + rad]; }
    for (let i = 0; i < k.length; i++) k[i] /= q;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = -rad; i <= rad; i++) { const xx = x + i < 0 ? 0 : x + i >= W ? W - 1 : x + i; v += a[y * W + xx] * k[i + rad]; } tmp[y * W + x] = v; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = -rad; i <= rad; i++) { const yy = y + i < 0 ? 0 : y + i >= H ? H - 1 : y + i; v += tmp[yy * W + x] * k[i + rad]; } a[y * W + x] = v; }
  }

  // Ruido propio de cada serie PET, estimado desde la imagen: sigma = A * valor^p. Se mide en la
  // diferencia entre cortes vecinos, que cancela casi toda la anatomia y deja el ruido, en bloques
  // chicos agrupados por intensidad.
  function estimarRuidoPet(v) {
    const W = v.cols, H = v.rows, N = W * H, piso = v.nivelBase * 0.04, tramos = 10, bolsas = Array.from({ length: tramos }, () => []);
    const lo = Math.log(piso), hi = Math.log(v.nivelBase * 1.5), paso = Math.max(1, Math.floor(v.n / 40));
    for (let i = 0; i < v.n - 1; i += paso) for (let y = 4; y < H - 8; y += 4) for (let x = 4; x < W - 8; x += 4) {
      let m = 0, dm = 0, q = 0;
      for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) { const o = (y + b) * W + x + a, t = v.vol[i * N + o], df = t - v.vol[(i + 1) * N + o]; m += t; dm += df; q += df * df; }
      m /= 16; dm /= 16; if (m <= piso) continue;
      const sd = Math.sqrt(Math.max(0, q / 16 - dm * dm) / 2), k = Math.floor((Math.log(m) - lo) / (hi - lo) * tramos);
      if (k >= 0 && k < tramos && sd > 0) bolsas[k].push(sd);
    }
    const pts = [];
    bolsas.forEach((b, k) => { if (b.length < 25) return; b.sort((x, y) => x - y); pts.push([lo + (k + 0.5) * (hi - lo) / tramos, Math.log(b[Math.floor(b.length * 0.4)])]); });
    const ref = v.nivelBase / 3;
    if (pts.length >= 3) {
      const n = pts.length, sx = pts.reduce((a, b) => a + b[0], 0), sy = pts.reduce((a, b) => a + b[1], 0), sxx = pts.reduce((a, b) => a + b[0] * b[0], 0), sxy = pts.reduce((a, b) => a + b[0] * b[1], 0);
      const pend = Math.max(0.4, Math.min(1, (n * sxy - sx * sy) / (n * sxx - sx * sx)));
      // El filtro de reconstruccion correlaciona cortes y pixeles vecinos, asi que la diferencia
      // subestima el ruido: se corrige por 1,5.
      const A = 1.5 * Math.exp((sy - pend * sx) / n), rel = A * Math.pow(ref, pend) / ref;
      if (rel > 0.01 && rel < 0.6) return { A, p: pend, rel, como: 'medido en la imagen' };
    }
    return { A: 0.08 * Math.pow(ref, 0.25), p: 0.75, rel: 0.08, como: 'valor típico: la imagen no permitió medirlo' };
  }
  // Ruido del CT en tejido blando, en HU, medido en bloques uniformes de la imagen cargada.
  function estimarRuidoCt(v) {
    const W = v.cols, H = v.rows, N = W * H, l = [], paso = Math.max(1, Math.floor(v.n / 30));
    for (let i = 0; i < v.n; i += paso) for (let y = 8; y < H - 14; y += 6) for (let x = 8; x < W - 14; x += 6) {
      let m = 0, q = 0, bien = true;
      for (let b = 0; b < 6 && bien; b++) for (let a = 0; a < 6; a++) { const t = v.vol[i * N + (y + b) * W + x + a]; if (t < -30 || t > 130) { bien = false; break; } m += t; q += t * t; }
      if (!bien) continue;
      m /= 36; l.push(Math.sqrt(Math.max(0, q / 36 - m * m)));
    }
    if (l.length < 30) return { sigma: 10, como: 'valor típico: la imagen no permitió medirlo' };
    l.sort((a, b) => a - b);
    return { sigma: Math.max(1, l[Math.floor(l.length * 0.2)]), como: 'medido en la imagen' };
  }

  // Valor de la imagen que corresponde a SUV 1, o 0 si la cabecera no permite calcularlo.
  function suvDe(v) {
    const c = v.cab;
    if (c.unidades === 'BQML' && c.peso > 0 && c.dosis > 0) { const t = captacionDe(c); return c.dosis * (c.vidaMedia > 0 && !Number.isNaN(t) ? Math.exp(-LN2 * t * 60 / c.vidaMedia) : 1) / (c.peso * 1000); }
    if (c.factorSuv > 0) return 1 / c.factorSuv;
    return 0;
  }
  function captacionDe(c) { const a = tmASeg(c.horaIny), b = tmASeg(c.horaSerie); return (Number.isNaN(a) || Number.isNaN(b)) ? NaN : ((b - a + 86400) % 86400) / 60; }
  function baseSim() {
    const p = E.pets[0], c = p.cab, m = partirMetodo(c.metodo), fl = partirFiltro(c.nucleo);
    E.sim = null;
    const r4 = x => +(+x).toFixed(4);
    const B = { tCama: r4(E.dur / 60), actF: 1, capt: captacionDe(c), iter: m.it, fwhm: fl.fwhm === null ? 0 : fl.fwhm };
    E.pets.forEach(v => { v.ruido = estimarRuidoPet(v); v.sim = null; });
    if (E.ct) { const D = dosisCt(); B.ref = D.ref > 0 ? r4(D.ref) : NaN; B.mod = D.activa; B.kv = E.ct.cab.kv; B.thk = E.ct.dz; B.ker = 0; E.ct.ruido = estimarRuidoCt(E.ct); }
    E.base = B; E.sim = Object.assign({}, B); E.simVer = 0; E.cacheCt = { clave: '', datos: null };
  }
  const cambiada = k => E.sim && E.base && E.sim[k] !== E.base[k];
  const ctCambiado = () => !!E.ct && CLAVES_CT.some(cambiada);
  const petCambiado = () => CLAVES_PET.some(cambiada);

  function opciones() {
    const B = E.base, c = E.pets[0].cab, o = {};
    const escala = (base, piso, dec) => { const l = [1, 0.75, 0.5, 0.25].map(f => base * f).filter(v => v >= Math.min(piso, base) - 1e-9); if (piso < base && !l.some(v => Math.abs(v - piso) < 1e-6)) l.push(piso); return l.sort((a, b) => b - a).map(v => ({ t: num(v, dec), v: +(+v).toFixed(4) })).filter((x, i, a) => i === 0 || x.t !== a[i - 1].t); };
    o.tCama = escala(B.tCama, PISOS.tCama, 1);
    if (c.dosis > 0) { const l = [1, 0.75, 0.5, 0.25]; const fp = PISOS.actBq / c.dosis; if (fp < 0.25) l.push(fp); o.actF = l.map(f => ({ t: E.unidadDosis === 'mCi' ? num(c.dosis * f / 3.7e7, 2) : num(c.dosis * f / 1e6, 1), v: f })); }
    if (!Number.isNaN(B.capt) && c.vidaMedia > 0) o.capt = [B.capt, 60, 75, 90, 120].filter((v, i) => i === 0 || v > B.capt + 2).map(v => ({ t: num(v, 0), v }));
    if (B.iter) o.iter = Array.from({ length: B.iter }, (_, k) => ({ t: String(B.iter - k), v: B.iter - k }));
    o.fwhm = [0, 1, 2, 3, 5].map(a => ({ t: num(B.fwhm + a, 1), v: B.fwhm + a }));
    if (E.ct) {
      if (B.ref > 0) o.ref = escala(B.ref, PISOS.ref, 0);
      o.mod = B.mod ? [{ t: 'On', v: true }, { t: 'Off', v: false }] : [{ t: 'Off', v: false }];
      if (B.kv > 0) o.kv = [B.kv].concat(Object.keys(KV_TABLA).map(Number).filter(k => k < B.kv - 1).sort((a, b) => b - a)).map(v => ({ t: num(v, 0), v }));
      o.thk = [1, 2, 3].map(k => ({ t: num(B.thk * k, 1), v: B.thk * k }));
      o.ker = [{ t: E.ct.cab.nucleo || 'Original', v: 0 }, { t: 'Smooth', v: 1 }, { t: 'Very smooth', v: 2 }];
    }
    return o;
  }
  const textoSim = (k, o) => { const x = (o[k] || []).find(q => q.v === E.sim[k]); return x ? x.t : '—'; };

  function fraccionCuentas() {
    const S = E.sim, B = E.base, c = E.pets[0].cab;
    let f = (S.tCama / B.tCama) * S.actF;
    if (!Number.isNaN(B.capt) && c.vidaMedia > 0) f *= Math.exp(-LN2 * (S.capt - B.capt) * 60 / c.vidaMedia);
    return Math.max(1e-3, Math.min(1, f));
  }
  // Factores del CT simulado en el corte j: mAs, razon de dosis respecto de lo adquirido y ruido.
  function ctFactores(j) {
    const v = E.ct, S = E.sim, B = E.base, mas = v.masZ[j];
    const maximo = resumen(v.masZ), esc = B.ref > 0 ? S.ref / B.ref : 1;
    const masSim = Number.isNaN(mas) ? NaN : (S.mod ? mas * esc : (maximo ? maximo.max : mas) * esc);
    const kvF = kvDe(S.kv).dose / kvDe(B.kv).dose;
    const dosis = Number.isNaN(mas) || mas <= 0 ? kvF * esc : (masSim / mas) * kvF;   // dosis simulada / adquirida
    return { masSim, dosis, R: Math.max(1, 1 / dosis) };
  }
  // Ruido del mapa de atenuacion que pasa al PET corregido, como fraccion. El mapa se suaviza a la
  // resolucion del PET, asi que el ruido del CT llega muy atenuado.
  function epsCt() {
    if (!E.ct || !ctCambiado()) return 0;
    const v = E.ct; let q = 0, n = 0;
    for (let i = E.r0; i <= E.r1; i++) { const j = v.dePet[i]; if (j >= 0) { q += ctFactores(j).R; n++; } }
    const Rm = n ? q / n : 1, sigma = v.ruido.sigma * Math.sqrt(Math.max(0, Rm - 1));
    const r = Math.max(6, E.sim.fwhm), celdas = (r / v.dx) * (r / v.dy) * Math.max(1, r / v.dz), L = 300;
    return 0.0096 * (sigma / Math.sqrt(celdas) / 1000) * r * Math.sqrt(L / r);
  }

  function simularPet() {
    const S = E.sim, B = E.base, f = fraccionCuentas(), eps = epsCt();
    E.pets.forEach((p, idx) => {
      const corr = !esNac(p);
      const hay = E.fase === 'terminado' && (f < 0.999 || (B.iter && S.iter < B.iter) || S.fwhm > B.fwhm + 1e-6 || (corr && eps > 1e-5));
      if (!hay) { p.sim = null; return; }
      const W = p.cols, H = p.rows, N = W * H, a = new Float32Array(N), t = new Float32Array(N), r = new Float32Array(N), b = new Float32Array(N);
      if (!p.sim) p.sim = new Float32Array(p.vol.length);
      const g = f < 0.999 ? Math.sqrt(1 / f - 1) : 0, R = p.ruido;
      for (let i = E.r0; i <= E.r1; i++) {
        a.set(p.vol.subarray(i * N, (i + 1) * N));
        if (B.iter && S.iter < B.iter) { const q = S.iter / B.iter, m = 0.45 + 0.55 * q; b.set(a); desenfocar(b, t, W, H, (1 - q) * 1.6); for (let k = 0; k < N; k++) a[k] = b[k] + (a[k] - b[k]) * m; }
        if (g > 0) { ruidoUnidad(r, 1000003 * (idx + 1) + i * 7919 + 17); desenfocar(r, t, W, H, 0.75); const nr = normaDe(r); for (let k = 0; k < N; k++) { const v = a[k]; if (v > 0) a[k] = Math.max(0, v + r[k] * nr * R.A * Math.pow(v, R.p) * g); } }
        if (corr && eps > 1e-5) { ruidoUnidad(r, 500009 + i * 104729); desenfocar(r, t, W, H, 2.5); const nr = normaDe(r); for (let k = 0; k < N; k++) a[k] *= Math.max(0, 1 + r[k] * nr * eps); }
        if (S.fwhm > B.fwhm + 1e-6) desenfocar(a, t, W, H, Math.sqrt(S.fwhm * S.fwhm - B.fwhm * B.fwhm) / 2.355 / p.dx);
        p.sim.set(a, i * N);
      }
    });
    if (E.mip) { E.mip.hechas.fill(0); E.mip.clave = ''; }
  }

  // Corte j del CT con los parametros simulados, o null si no hay nada que simular.
  function ctCorteSim(j) {
    if (!ctCambiado() || j < 0) return null;
    const clave = j + '/' + E.simVer;
    if (E.cacheCt.clave === clave) return E.cacheCt.datos;
    const v = E.ct, S = E.sim, B = E.base, W = v.cols, H = v.rows, N = W * H, a = new Float32Array(N), t = new Float32Array(N);
    const k = Math.max(1, Math.round(S.thk / B.thk)), j0 = j - ((k - 1) >> 1);
    for (let q = 0; q < k; q++) { const z = Math.max(0, Math.min(v.n - 1, j0 + q)) * N; for (let i = 0; i < N; i++) a[i] += v.vol[z + i] / k; }
    const hueso = kvDe(S.kv).bone / kvDe(B.kv).bone, blando = kvDe(S.kv).soft / kvDe(B.kv).soft;
    if (hueso !== 1 || blando !== 1) for (let i = 0; i < N; i++) { const x = a[i]; if (x > 0) a[i] = x * hueso; else if (x > -1000) a[i] = x * (1 + (blando - 1) * (1 + x / 1000)); }
    const F = ctFactores(j), agrega = v.ruido.sigma / Math.sqrt(k) * Math.sqrt(F.R - 1);
    if (agrega > 0.05) { const r = new Float32Array(N); ruidoUnidad(r, 900001 + j * 15485863); for (let i = 0; i < N; i++) a[i] += r[i] * agrega; }
    for (let q = 0; q < S.ker; q++) desenfocar(a, t, W, H, 0.85);
    E.cacheCt = { clave, datos: a };
    return a;
  }
  const ruidoCtDe = j => { const F = ctFactores(j), k = Math.max(1, Math.round(E.sim.thk / E.base.thk)); return E.ct.ruido.sigma / Math.sqrt(k) * Math.sqrt(F.R) * [1, 0.62, 0.45][E.sim.ker]; };

  function notaPet(p) {
    if (!p.sim) return '';
    const S = E.sim, B = E.base, f = fraccionCuentas(), l = [];
    if (f < 0.999) l.push(Math.round(f * 100) + ' % de cuentas');
    if (B.iter && S.iter < B.iter) l.push(S.iter + ' it.');
    if (S.fwhm > B.fwhm) l.push('filtro ' + num(S.fwhm, 1) + ' mm');
    if (!esNac(p) && epsCt() > 1e-5) l.push('CT simulado');
    return l.join(', ');
  }
  function notaCt(j) {
    if (!ctCambiado() || j < 0) return '';
    const S = E.sim, B = E.base, l = ['ruido ' + num(ruidoCtDe(j), 0) + ' HU'];
    if (S.kv !== B.kv) l.push(S.kv + ' kV');
    if (S.thk !== B.thk) l.push('corte ' + num(S.thk, 1) + ' mm');
    if (S.ker) l.push(['', 'Smooth', 'Very smooth'][S.ker]);
    return l.join(', ');
  }
  const permitido = k => CLAVES_CT.includes(k) ? CT_HECHO.includes(E.fase) : E.fase === 'terminado';

  function aplicarSim(clave, textoOp) {
    const op = (opciones()[clave] || []).find(q => q.t === textoOp);
    if (!op) return;
    E.sim[clave] = op.v; E.simVer++;
    decir('Simulando…'); simularPet(); refrescarTodo();
    const B = E.base, S = E.sim;
    if (CLAVES_PET.includes(clave)) {
      const f = fraccionCuentas();
      decir('Simulado: ' + (f < 0.999 ? 'quedan ' + Math.round(f * 100) + ' % de las cuentas adquiridas y el ruido del PET sube × ' + num(1 / Math.sqrt(f), 2) : 'se conservan todas las cuentas adquiridas') +
        (B.iter && S.iter < B.iter ? '; con ' + S.iter + ' iteraciones la imagen converge menos y pierde contraste' : '') + (S.fwhm > B.fwhm ? '; el filtro de ' + num(S.fwhm, 1) + ' mm suaviza y borra detalle' : '') + '.', f < 0.999 || petCambiado());
    } else {
      const D = dosisCt(), j = E.ct.dePet[E.corte], e = epsCt();
      decir('Simulado: ruido del CT en este corte ' + num(ruidoCtDe(j), 0) + ' HU (adquirido: ' + num(E.ct.ruido.sigma, 0) + '); CTDIvol medio ' + num(D.ctdi ? D.ctdi.med : NaN, 2) + ' mGy, DLP ' + num(D.dlp, 0) + ' mGy·cm' +
        (D.exceso ? '. La dosis supera a la adquirida y la imagen no mejora' : '') + '. Efecto sobre el PET corregido: ± ' + num(e * 100, 2) + ' %.', ctCambiado());
    }
  }
  function restaurar() {
    if (!E.base) return;
    E.sim = Object.assign({}, E.base); E.simVer++;
    simularPet(); refrescarTodo();
    decir('Se restauraron los valores adquiridos: las imágenes son las originales.');
  }

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
    const T = E.topo, p = E.pets[0];
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
    const ySup = i => yDe(p.zs[i] + p.dz / 2), yInf = i => yDe(p.zs[i] - p.dz / 2);
    volcar(g, px, T.cols, T.n, { x: caja.x, w: caja.w, y: yDe(v.zs[0] + v.dz / 2), h: v.n * v.dz * e });
    const x0 = caja.x + caja.w * 0.06, x1 = caja.x + caja.w * 0.94, ya0 = ySup(E.r0), yb0 = yInf(E.r1);
    E.cajaTopo = { caja, ySup, yInf, yA: ya0, yB: yb0 };
    const plan = E.fase === 'rango';
    // Fuera del rango, el topograma queda atenuado.
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(caja.x, caja.y, caja.w, ya0 - caja.y); g.fillRect(caja.x, yb0, caja.w, caja.y + caja.h - yb0);
    if (E.continuo) {
      g.strokeStyle = '#fff'; g.lineWidth = d; g.strokeRect(x0, ya0, x1 - x0, yb0 - ya0);
      if (E.fase === 'adquiriendo' || E.fase === 'pausa') { const y = ya0 + (yb0 - ya0) * Math.min(1, E.reloj / E.total); g.strokeStyle = '#38e05a'; g.lineWidth = 2 * d; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    } else {
      if (plan) {
        // Camas disponibles que quedaron fuera: punteadas, para que se vea donde puede calzar el rango.
        g.setLineDash([3 * d, 4 * d]); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = d;
        E.espacial.forEach((c, k) => { if (k < E.b0 || k > E.b1) g.strokeRect(x0, ySup(c.c0), x1 - x0, yInf(c.c1) - ySup(c.c0)); });
        g.setLineDash([]);
      }
      const act = (E.fase === 'adquiriendo' || E.fase === 'pausa') ? camaActual() : -1;
      E.sel.forEach((c, k) => {
        const ya = ySup(c.c0), yb = yInf(c.c1), des = (k % 2) * 7 * d;
        const hecha = E.fase === 'terminado' || ((E.fase === 'adquiriendo' || E.fase === 'pausa') && E.reloj >= c.ts + E.dur);
        g.strokeStyle = k === act ? '#38e05a' : (hecha ? '#5f86ff' : '#ffffff');
        g.lineWidth = (k === act ? 2.2 : 1) * d;
        if (k === act) { g.fillStyle = 'rgba(56,224,90,.16)'; g.fillRect(x0 - des, ya, x1 - x0 + 2 * des, yb - ya); }
        g.strokeRect(x0 - des, ya, x1 - x0 + 2 * des, yb - ya);
        texto(g, d, [String(k + 1)], x1 + des + 4 * d, (ya + yb) / 2 - 6 * d, g.strokeStyle);
      });
    }
    if (plan) {
      // Bordes del rango: se arrastran y saltan de cama en cama.
      g.strokeStyle = '#ff5ad6'; g.fillStyle = '#ff5ad6'; g.lineWidth = 2.5 * d;
      [[ya0, 1], [yb0, -1]].forEach(([y, s]) => {
        g.beginPath(); g.moveTo(caja.x - 8 * d, y); g.lineTo(caja.x + caja.w + 8 * d, y); g.stroke();
        [caja.x + caja.w * 0.25, caja.x + caja.w * 0.75].forEach(x => { g.beginPath(); g.moveTo(x - 6 * d, y + s * 12 * d); g.lineTo(x + 6 * d, y + s * 12 * d); g.lineTo(x, y + s * 2 * d); g.closePath(); g.fill(); });
      });
    }
    if (E.fase === 'ct') {
      const f = Math.min(1, E.relojCt / E.ctDur), y = E.ctSentido === 'Caudocranial' ? yb0 - (yb0 - ya0) * f : ya0 + (yb0 - ya0) * f;
      g.strokeStyle = '#4fe3ff'; g.lineWidth = 2.5 * d; g.beginPath(); g.moveTo(caja.x, y); g.lineTo(caja.x + caja.w, y); g.stroke();
      g.fillStyle = 'rgba(79,227,255,.13)'; if (E.ctSentido === 'Caudocranial') g.fillRect(caja.x, y, caja.w, yb0 - y); else g.fillRect(caja.x, ya0, caja.w, y - ya0);
    }
    if (E.ct) {
      // Corriente del tubo por corte, al costado derecho: tenue lo planificado, firme lo ya adquirido.
      const maS = dosisCt().maZ, D = resumen(E.ct.maZ.concat(maS));
      if (D && D.max > D.min) {
        const xa = caja.x + caja.w + 5 * d, an = Math.max(8 * d, Math.min(40 * d, w - xa - 6 * d));
        [false, true].forEach(hecho => {
          g.strokeStyle = hecho ? '#ffa726' : 'rgba(255,167,38,.4)'; g.lineWidth = (hecho ? 1.8 : 1) * d; g.beginPath(); let abierto = false;
          for (let i = E.r0; i <= E.r1; i++) {
            const j = E.ct.dePet[i], m = j >= 0 ? maS[j] : NaN;
            if (Number.isNaN(m) || (hecho && !ctVisible(i))) { abierto = false; continue; }
            const x = xa + an * m / D.max, y = yDe(p.zs[i]);
            if (!abierto) { g.moveTo(x, y); abierto = true; } else g.lineTo(x, y);
          }
          g.stroke();
        });
        texto(g, d, ['mA'], xa, ya0 - 15 * d, '#ffa726');
      }
    }
    if (!plan && E.fase !== 'ct') {
      const yc = yDe(p.zs[E.corte]);
      g.strokeStyle = '#ffd24a'; g.lineWidth = d; g.setLineDash([5 * d, 4 * d]); g.beginPath(); g.moveTo(caja.x, yc); g.lineTo(caja.x + caja.w, yc); g.stroke(); g.setLineDash([]);
    }
    const c = (E.ct || p).cab;
    texto(g, d, ['R'], 8 * d, h / 2 - 6 * d, '#fff');
    texto(g, d, E.ct ? ['kV ' + num(c.kv, 0), 'SL ' + num(c.grosor, 1), dosisCt().activa ? 'AEC On' : 'AEC Off'] : ['Proyección del PET'], 8 * d, h - (E.ct ? 60 : 32) * d, '#fff');
    texto(g, d, [fechaDe(c.fechaSerie || c.fechaEstudio), horaDe(c.horaSerie), p.cab.posicion || ''], 8 * d, 8 * d, '#fff');
    texto(g, d, ['LEN ' + num(E.largo, 0) + ' mm', 'SP1 ' + num(p.zs[E.r0], 1), 'SP2 ' + num(p.zs[E.r1], 1), E.continuo ? '' : E.sel.length + ' de ' + E.espacial.length + ' camas'], w - 8 * d, h - 62 * d, plan ? '#ff9ae6' : '#fff', 'right');
    $('rotTopo').textContent = E.ct ? 'Topograma (proyección del CT)' : 'Topograma (proyección del PET)';
  }

  // Dibuja un corte axial de una serie PET en escala invertida y devuelve la caja usada.
  function axialPet(g, w, h, d, p, i, hay, original) {
    const caja = encajar(w, h, p.cols * p.dx, p.rows * p.dy, 8 * d), tope = p.nivelBase * E.nivel, vol = original ? p.vol : (p.sim || p.vol);
    if (hay) {
      const px = new Uint8ClampedArray(p.rows * p.cols * 4), b = i * p.rows * p.cols;
      for (let q = 0; q < p.rows * p.cols; q++) { const c = 255 - 255 * Math.min(1, Math.max(0, vol[b + q] / tope)); px[q * 4] = px[q * 4 + 1] = px[q * 4 + 2] = c; px[q * 4 + 3] = 255; }
      volcar(g, px, p.cols, p.rows, caja);
    }
    return caja;
  }
  // Corte axial del CT, solo o fusionado. datosCt es el corte simulado (o null para el adquirido)
  // y volPet el volumen PET que se superpone (o null para CT solo).
  function axialCt(g, w, h, d, j, datosCt, p, volPet, i, tope) {
    const ct = E.ct, S = 320, ancho = ct.cols * ct.dx, alto = ct.rows * ct.dy, X0 = ct.x0 - ct.dx / 2, Y0 = ct.y0 - ct.dy / 2;
    const caja = encajar(w, h, ancho, alto, 8 * d), px = new Uint8ClampedArray(S * S * 4), wc = 40, ww = 400;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = X0 + (x + 0.5) * ancho / S, fy = Y0 + (y + 0.5) * alto / S, o = (y * S + x) * 4;
      let gris = 0;
      if (j >= 0) { const cx = Math.min(ct.cols - 1, Math.floor((fx - X0) / ct.dx)), cy = Math.min(ct.rows - 1, Math.floor((fy - Y0) / ct.dy)), hu = datosCt ? datosCt[cy * ct.cols + cx] : ct.vol[(j * ct.rows + cy) * ct.cols + cx]; gris = 255 * Math.min(1, Math.max(0, (hu - (wc - ww / 2)) / ww)); }
      let r = gris, v = gris, a = gris;
      if (volPet) {
        const ux = (fx - p.x0) / p.dx, uy = (fy - p.y0) / p.dy;
        if (ux >= 0 && uy >= 0 && ux < p.cols - 1 && uy < p.rows - 1) {
          const xa = Math.floor(ux), ya = Math.floor(uy), tx = ux - xa, ty = uy - ya, b = (i * p.rows + ya) * p.cols + xa;
          const val = (volPet[b] * (1 - tx) + volPet[b + 1] * tx) * (1 - ty) + (volPet[b + p.cols] * (1 - tx) + volPet[b + p.cols + 1] * tx) * ty;
          const t = Math.min(1, Math.max(0, val / tope)), k = Math.round(t * 255) * 3, al = Math.min(0.85, 0.25 + t);
          r = gris * (1 - al) + CALOR[k] * al; v = gris * (1 - al) + CALOR[k + 1] * al; a = gris * (1 - al) + CALOR[k + 2] * al;
        }
      }
      px[o] = r; px[o + 1] = v; px[o + 2] = a; px[o + 3] = 255;
    }
    volcar(g, px, S, S, caja);
    return { caja, x0: X0, y0: Y0, ancho, alto, ventana: 'W ' + ww + '  C ' + wc };
  }
  const avisoSinPet = i => {
    if (E.fase === 'entre') return 'PET sin adquirir: pulsa Start';
    if (E.fase === 'ct') return 'Adquiriendo el CT';
    const k = E.sel.findIndex(c => i >= c.c0 && i <= c.c1);
    return 'Corte aún no adquirido' + (k >= 0 ? ' (cama ' + (k + 1) + ')' : '');
  };

  function pintarAxial() {
    const cv = $('cvAxial'), { g, w, h, d } = ajustar(cv);
    document.querySelectorAll('button.modo.izq').forEach(b => { b.classList.toggle('activa', b.dataset.modo === E.modo); b.disabled = E.fase === 'vacio' || E.fase === 'rango' || (b.dataset.modo === 'ct' ? !E.ct : (!FASES_PET.includes(E.fase) || (b.dataset.modo === 'fusion' && !E.ct))); });
    $('corte').disabled = E.fase === 'vacio' || E.fase === 'rango';
    if (E.fase === 'vacio') { texto(g, d, ['Sin estudio'], 10 * d, 10 * d, '#667'); return; }
    if (E.fase === 'rango') { texto(g, d, ['Aún no hay imágenes axiales.', 'Define el rango en el topograma', 'y pulsa Start.'], w / 2, h / 2 - 20 * d, '#ffd24a', 'center'); $('rotAxial').textContent = 'Axial'; return; }
    const p = pet(), i = E.corte, hay = revelado(i), ct = E.ct, j = ct && ctVisible(i) ? ct.dePet[i] : -1;
    const tope = p.nivelBase * E.nivel;
    let leyenda = [], nota = '';
    if (E.modo === 'pet') {
      const caja = axialPet(g, w, h, d, p, i, hay, false);
      E.cajaAxial = { caja, x0: p.x0 - p.dx / 2, y0: p.y0 - p.dy / 2, ancho: p.cols * p.dx, alto: p.rows * p.dy };
      leyenda = [p.desc, p.cab.metodo, p.cab.nucleo]; nota = hay ? notaPet(p) : '';
    } else {
      const fus = E.modo === 'fusion' && hay;
      E.cajaAxial = axialCt(g, w, h, d, j, ctCorteSim(j), p, fus ? (p.sim || p.vol) : null, i, tope);
      leyenda = E.modo === 'ct' ? [ct.desc, E.cajaAxial.ventana] : [ct.desc + ' + ' + p.desc, E.cajaAxial.ventana];
      nota = [notaCt(j), fus ? notaPet(p) : ''].filter(Boolean).join(' · ');
    }
    if (nota) texto(g, d, ['SIMULADO · ' + nota], w / 2, 8 * d, '#ffd24a', 'center');
    if (!hay && E.modo === 'pet') texto(g, d, [avisoSinPet(i)], w / 2, h / 2 - 6 * d, '#ffd24a', 'center');
    if (E.modo === 'ct' && j < 0) texto(g, d, ['Corte de CT aún no adquirido'], w / 2, h / 2 - 6 * d, '#4fe3ff', 'center');
    texto(g, d, ['IMA ' + (i + 1) + ' / ' + p.n, 'SP ' + num(p.zs[i], 1), E.lectura || ''], 8 * d, 8 * d, '#fff');
    texto(g, d, leyenda.filter(Boolean), 8 * d, h - (22 + 13 * leyenda.filter(Boolean).length) * d, '#fff');
    if (E.modo !== 'ct') texto(g, d, [suvDe(p) > 0 ? 'SUV ' + num(tope / suvDe(p), 1) : '', 'T ' + num(tope, tope < 10 ? 2 : 0) + ' ' + (p.cab.unidades || ''), 'B 0'].filter(Boolean), w - 8 * d, h - 64 * d, '#fff', 'right');
    texto(g, d, ['R'], 8 * d, h / 2 - 6 * d, '#fff');
    $('rotAxial').textContent = 'Axial · ' + (E.modo === 'pet' ? 'PET' : E.modo === 'ct' ? 'CT' : 'Fusión');
    $('corte').value = i;
  }

  function filaMip(p, vol, i, ang, salida, base) {
    const R = p.rows, C = p.cols, b = i * R * C;
    if (ang === 0) { for (let x = 0; x < C; x++) { let m = 0; for (let y = 0; y < R; y++) { const v = vol[b + y * C + x]; if (v > m) m = v; } salida[base + x] = m; } return; }
    const a = ang * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), cx = (C - 1) / 2, cy = (R - 1) / 2;
    for (let u = 0; u < C; u++) {
      let m = 0;
      for (let s = 0; s < R; s++) {
        const x = Math.round(cx + (u - cx) * co - (s - cy) * si), y = Math.round(cy + (u - cx) * si + (s - cy) * co);
        if (x >= 0 && y >= 0 && x < C && y < R) { const v = vol[b + y * C + x]; if (v > m) m = v; }
      }
      salida[base + u] = m;
    }
  }

  function pintarDerecha() {
    const cv = $('cvMip'), { g, w, h, d } = ajustar(cv);
    const falta = { mipac: !E.ac, mipnac: !E.nac, axnac: !E.nac, orig: false };
    document.querySelectorAll('button.der').forEach(b => { b.classList.toggle('activa', b.dataset.der === E.derecha); b.disabled = E.fase === 'vacio' || falta[b.dataset.der]; b.title = falta[b.dataset.der] && E.fase !== 'vacio' ? 'Este estudio se cargó sin esa serie PET' : ''; });
    $('giro').disabled = E.fase === 'vacio' || E.derecha === 'axnac' || E.derecha === 'orig';
    const nombre = { mipac: 'MIP · corregido (AC)', mipnac: 'MIP · sin corregir (NAC)', axnac: 'Axial · sin corregir (NAC)', orig: 'Axial · tal como se adquirió' }[E.derecha];
    $('rotMip').textContent = nombre;
    if (E.fase === 'vacio') { texto(g, d, ['Sin estudio'], 10 * d, 10 * d, '#667'); return; }
    if (E.derecha === 'orig') {
      // La misma vista de la ventana central, sin ninguna simulacion, para ver cuanto se perdio.
      const i = E.corte, q = pet(), j = E.ct && ctVisible(i) ? E.ct.dePet[i] : -1, hay = revelado(i);
      E.cajaMip = null;
      if (E.modo !== 'pet' && E.ct) {
        if (j < 0) { texto(g, d, ['CT sin adquirir'], w / 2, h / 2 - 6 * d, '#667', 'center'); return; }
        axialCt(g, w, h, d, j, null, q, E.modo === 'fusion' && hay ? q.vol : null, i, q.nivelBase * E.nivel);
        texto(g, d, [E.modo === 'fusion' ? E.ct.desc + ' + ' + q.desc : E.ct.desc, 'Adquirido, sin simular', 'ruido ' + num(E.ct.ruido.sigma, 0) + ' HU'], 8 * d, 8 * d, '#9fb0ff');
      } else {
        if (!hay) { texto(g, d, [FASES_PET.includes(E.fase) ? avisoSinPet(i) : 'PET sin adquirir'], w / 2, h / 2 - 6 * d, '#667', 'center'); return; }
        axialPet(g, w, h, d, q, i, true, true);
        texto(g, d, [q.desc, 'Adquirido, sin simular', 'IMA ' + (i + 1) + ' / ' + q.n], 8 * d, 8 * d, '#9fb0ff');
      }
      return;
    }
    const p = E.derecha === 'mipac' ? E.ac : E.nac;
    if (!p) { texto(g, d, ['Esta vista necesita la serie PET', E.derecha === 'mipac' ? 'corregida (AC).' : 'sin corregir (NAC).'], w / 2, h / 2 - 12 * d, '#ffd24a', 'center'); return; }
    if (!FASES_PET.includes(E.fase)) { texto(g, d, ['PET sin adquirir'], w / 2, h / 2 - 6 * d, '#667', 'center'); E.cajaMip = null; return; }
    if (E.derecha === 'axnac') {
      const i = E.corte, hay = revelado(i);
      axialPet(g, w, h, d, p, i, hay, false); E.cajaMip = null;
      if (hay && notaPet(p)) texto(g, d, ['SIMULADO · ' + notaPet(p)], w / 2, h - 66 * d, '#ffd24a', 'center');
      if (!hay) texto(g, d, [avisoSinPet(i)], w / 2, h / 2 - 6 * d, '#ffd24a', 'center');
      texto(g, d, [p.desc, 'IMA ' + (i + 1) + ' / ' + p.n, 'SP ' + num(p.zs[i], 1)], 8 * d, 8 * d, '#fff');
      texto(g, d, ['T ' + num(p.nivelBase * E.nivel, 0) + ' ' + (p.cab.unidades || ''), 'B 0'], w - 8 * d, h - 50 * d, '#fff', 'right');
      return;
    }
    const M = E.mip, clave = E.derecha + '/' + E.giro + '/' + E.r0 + '/' + E.r1 + '/' + E.simVer;
    if (M.clave !== clave) { M.clave = clave; M.hechas.fill(0); }
    for (let i = E.r0; i <= E.r1; i++) if (!M.hechas[i] && revelado(i)) { filaMip(p, p.sim || p.vol, i, E.giro, M.filas, i * p.cols); M.hechas[i] = 1; }
    const nr = E.r1 - E.r0 + 1, caja = encajar(w, h, p.cols * p.dx, nr * p.dz, 22 * d), tope = p.nivelBase * E.nivel;
    const px = new Uint8ClampedArray(p.cols * nr * 4);
    for (let q = 0; q < nr; q++) for (let x = 0; x < p.cols; x++) {
      const i = E.r0 + q, o = (q * p.cols + x) * 4, hay = revelado(i);
      const c = hay ? 255 - 255 * Math.min(1, M.filas[i * p.cols + x] / tope) : 22;
      px[o] = px[o + 1] = px[o + 2] = c; if (!hay) px[o + 2] = 34; px[o + 3] = 255;
    }
    volcar(g, px, p.cols, nr, caja);
    E.cajaMip = { caja };
    const yc = caja.y + (E.corte - E.r0 + 0.5) * caja.h / nr;
    g.strokeStyle = '#d33'; g.lineWidth = d; g.beginPath(); g.moveTo(caja.x, yc); g.lineTo(caja.x + caja.w, yc); g.stroke();
    let hechos = 0; for (let i = E.r0; i <= E.r1; i++) hechos += M.hechas[i];
    texto(g, d, [p.desc, 'MIP ' + E.giro + '°', hechos + ' / ' + nr + ' cortes', notaPet(p) ? 'SIMULADO · ' + notaPet(p) : ''], 8 * d, 8 * d, '#9fb0ff');
  }

  function pintar() { pintarTopo(); pintarAxial(); pintarDerecha(); }

  // ---------- franja y cronica ----------
  function pintarFranja() {
    if (E.fase === 'vacio') { $('protocolo').textContent = 'PETCT (sin estudio)'; $('identidad').textContent = ''; $('resumen').textContent = ''; return; }
    const p = pet(), c = p.cab;
    $('protocolo').textContent = c.estudio || c.protocolo || 'PETCT';
    const oculto = $('ocultarId').checked;
    $('identidad').textContent = E.caso ? 'Caso ' + E.caso : oculto ? 'Paciente oculto' : [c.nombre, c.id].filter(Boolean).join(' · ');
    const mci = c.dosis ? c.dosis / 3.7e7 : NaN;
    $('resumen').textContent = num(E.largo, 1) + ' mm   ' + num(E.total / 60, 0) + ' min   ' + (E.unidadDosis === 'mCi' ? num(mci, 1) + ' mCi' : num(c.dosis / 1e6, 0) + ' MBq');
  }

  function pasos() {
    const l = [];
    if (E.ct) {
      const hecho = CT_HECHO.includes(E.fase);
      l.push({ id: 'topo', nombre: 'Topogram', cajas: [{ t: 'Topograma (proyección del CT)', hecha: true }] });
      l.push({ id: 'ct', nombre: E.fase === 'ct' ? 'CT ' + hms(E.ctDur - E.relojCt) : 'CT', cajas: [E.ct].concat(E.otrosCt).map(v => ({ t: v.desc, hecha: hecho, encurso: E.fase === 'ct' })), num: 1 });
      l.push({ pausa: true });
    }
    const corriendo = E.fase === 'adquiriendo' || E.fase === 'pausa';
    l.push({ id: 'pet', nombre: corriendo ? 'PET ' + hms((E.total - E.reloj)) : 'PET', num: 2, cajas: E.pets.map((v, k) => ({ t: v.desc, hecha: E.fase === 'terminado', encurso: corriendo, actual: k === E.trabajo, trabajo: k })) });
    return l;
  }
  function pintarCronica() {
    const el = $('cronica');
    if (E.fase === 'vacio') { el.innerHTML = '<div class="paso pausa"><span class="nombre">Sin protocolo cargado</span></div>'; $('btnVolumina').disabled = true; return; }
    el.innerHTML = pasos().map(p => p.pausa ? '<div class="paso pausa' + (E.fase === 'entre' ? ' espera' : '') + '"><span class="nombre">Pause</span></div>' :
      '<div class="paso' + (p.id === E.paso ? ' sel' : '') + '" data-paso="' + p.id + '"><span class="nombre">' + esc(p.nombre) + '</span><span class="cajas">' +
      p.cajas.map(c => '<span class="cajita' + (c.hecha ? ' hecha' : '') + (c.encurso ? ' encurso' : '') + (c.actual && p.id === E.paso ? ' actual' : '') + '" title="' + esc(c.t) + '"' + (c.trabajo !== undefined ? ' data-trabajo="' + c.trabajo + '"' : '') + '></span>').join('') +
      '</span><span class="num">' + (p.num || '') + '</span></div>').join('');
    const b = $('btnStart');
    b.textContent = { rango: 'Start', ct: 'Scan…', entre: 'Start', adquiriendo: 'Suspend', pausa: 'Resume', terminado: 'New' }[E.fase] || 'Start';
    b.disabled = E.fase === 'ct';
    b.classList.toggle('rojo', E.fase === 'adquiriendo');
    $('btnSkip').disabled = E.fase === 'terminado';
    $('btnVolumina').disabled = E.fase !== 'terminado';
  }

  // ---------- tarjeta de parametros ----------
  const unir = (real, ops) => { const l = ops.map(String); const r = String(real); if (!l.includes(r)) l.push(r); return l; };
  function campo(et, valor, o = {}) {
    const v = (valor === undefined || valor === null || valor === '') ? '—' : String(valor);
    const ops = o.ops ? unir(v, o.ops) : null;
    return '<div class="campo"><label>' + esc(et) + '</label><span class="caja' + (o.larga ? ' larga' : '') + (ops || o.giro ? '' : ' fija') + (o.sim ? ' viva' + (cambiada(o.sim) ? ' cambiada' : '') : '') + '" data-et="' + esc(et) + '" data-valor="' + esc(v) + '"' + (o.sim ? ' data-sim="' + o.sim + '"' : '') +
      (ops ? ' data-ops="' + esc(JSON.stringify(ops)) + '"' : '') + (o.giro ? ' data-giro="1"' : '') + (o.accion ? ' data-accion="' + o.accion + '"' : '') + '><b>' + esc(v) + '</b>' + (ops ? '<i>▼</i>' : o.giro ? '<i>▲▼</i>' : '') + '</span>' +
      (o.un ? '<span class="un">' + esc(o.un) + '</span>' : '') + '</div>';
  }
  const marca2 = (et, si) => '<div class="campo"><label></label><span class="marca2"><span class="cuadro" data-et="' + esc(et) + '" data-valor="' + (si ? 'activado' : 'desactivado') + '" data-giro="1">' + (si ? '✓' : '') + '</span>' + esc(et) + '</span></div>';
  // Campo que si cambia la imagen (simulado). Si el estudio no trae el dato, queda como campo fijo.
  function vivo(et, clave, O, extra) {
    if (!O[clave] || !O[clave].length) return campo(et, '—', extra || {});
    return campo(et, textoSim(clave, O), Object.assign({ sim: clave, ops: O[clave].map(q => q.t) }, extra || {}));
  }
  const PIE_SIM = '<p class="ayudita"><b class="azul">En azul</b>: parámetros que puedes cambiar después de la adquisición. El efecto sobre la imagen es <b>simulado</b>: parte de lo adquirido y solo puede empeorarlo. Los valores mínimos que se ofrecen son pisos del simulador y pueden no corresponder a los del equipo real. <button id="restaurar" class="plano2">Restaurar lo adquirido</button></p>';
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
    const p = pet(), c = p.cab, m = partirMetodo(c.metodo), fl = partirFiltro(c.nucleo), O = opciones(), f = fraccionCuentas();
    const totalSim = E.total - E.sel.length * (E.base.tCama - E.sim.tCama) * 60;
    if (pest === 'routine') return '<div class="rejilla">' +
      bloque('', campo('Isotope', isotopo(c), { ops: Object.values(ISOTOPOS) }) +
        campo('Pharm.', c.farmaco, { ops: ['Fluorodeoxyglucose', 'PSMA', 'DOTATATE', 'Fluoride', 'Choline', 'Germanium'], larga: true }) +
        vivo('Dose', 'actF', O, { un: E.unidadDosis }) + campo('Dose unit', E.unidadDosis, { accion: 'unidad', giro: true }) +
        campo('Date', fechaDe((c.fechaHoraIny || '').slice(0, 8) || c.fechaSerie), { giro: true }) +
        campo('Time', horaDe(c.horaIny), { giro: true }) +
        (O.capt ? vivo('Uptake time', 'capt', O, { un: 'min (inyección → inicio del PET)' }) : campo('Uptake time', Number.isNaN(E.base.capt) ? '—' : num(E.base.capt, 0), { un: 'min (inyección → inicio del PET)' })) +
        campo('Counts', num(f * 100, 0), { un: '% de las cuentas adquiridas (simulado)' })) +
      bloque('', marca2('Scan range: Match CT Range', !!E.ct) +
        campo('No. of beds', E.continuo ? 'continuo' : E.sel.length, { accion: 'rango', giro: true }) +
        vivo('Scan duration/bed', 'tCama', O, { un: 'min' }) +
        campo('Range: Begin', num(p.zs[E.r0], 1), { un: 'mm', accion: 'rango', giro: true }) + campo('End', num(p.zs[E.r1], 1), { un: 'mm', accion: 'rango', giro: true }) +
        campo('Length', num(E.largo, 0), { un: 'mm' }) + campo('Scan time', hms(totalSim), { un: totalSim < E.total - 1 ? 'h:min:s (adquirido en ' + hms(E.total) + ')' : 'h:min:s' }) +
        campo('Scan direction', E.sentido, { ops: ['Craniocaudal', 'Caudocranial'] }) +
        campo('Patient position', c.posicion, { ops: ['HFS', 'FFS', 'HFP', 'FFP'] })) + '</div>' + PIE_SIM;
    if (pest === 'scan') return '<div class="rejilla">' +
      bloque('', marca2('Auto Load', true) + marca2('Auto Move', false) + marca2('Auto Start', false) +
        campo('Scanner', [c.fabricante, c.modelo].filter(Boolean).join(' '), { larga: true }) + campo('Software', c.software) +
        campo('Axial FoV / bed', E.camas.length ? num(Math.max(...E.camas.map(q => q.c1 - q.c0 + 1)) * p.dz, 0) : '—', { un: 'mm (estimado)' }) +
        campo('Randoms', c.aleatorios) + campo('Axial acceptance', num(c.aceptacion, 0))) +
      bloque('Tasa relativa por cama (estimada desde la imagen)', '<canvas id="grafico"></canvas><div class="leyenda"><span style="--c:#1a9a3c">Actividad en el campo, relativa</span><span style="--c:#d33">Instante actual</span></div>') + '</div>';
    if (pest === 'recon') {
      const trabajos = [1, 2, 3, 4, 5, 6, 7, 8].map(k => '<span class="t' + (k <= E.pets.length ? ' hay' : '') + (k - 1 === E.trabajo ? ' sel' : '') + '" data-trabajo="' + (k - 1) + '">' + k + '<span class="p"></span></span>').join('');
      const tipo = esNac(p) ? 'Uncorrected' : 'Corrected';
      const listaCt = [E.ct].concat(E.otrosCt).filter(Boolean).map(v => v.desc);
      const acCt = (c.atenuacion || '').replace(/^measured,\s*/i, '').trim();
      const disp = /relative/i.test(c.dispersion) ? 'Relative' : /absolute/i.test(c.dispersion) ? 'Absolute' : (c.dispersion || 'None');
      return '<div class="trabajos"><span style="margin-right:8px">Recon job</span>' + trabajos + '<span style="flex:1"></span>' + campo('Series description', p.desc, { larga: true }) + '</div><div class="rejilla">' +
        bloque('', campo('Recon range: Begin', E.sel.length ? 1 : '—', { giro: true }) + campo('End', E.sel.length || '—', { giro: true }) +
          campo('Output image type', tipo, { ops: ['Corrected', 'Uncorrected'] }) +
          campo('Recon method', m.metodo, { ops: ['FBP', 'OSEM3D', 'OSEM3D+TOF', 'PSF', 'PSF+TOF'], larga: true }) +
          vivo('Iterations', 'iter', O) + campo('Subsets', m.sub, { ops: [8, 10, 12, 20, 21, 24] })) +
        bloque('', campo('Image size', p.colsOrig, { ops: [128, 168, 180, 200, 256, 360, 400] }) +
          campo('Pixel', num(p.psOrig, 2), { un: 'mm' }) + campo('FoV', num(p.colsOrig * p.psOrig, 0), { un: 'mm' }) +
          campo('Slice', num(p.dz, 1), { un: 'mm' }) +
          campo('Filter', fl.filtro, { ops: ['All-pass', 'Gaussian', 'Hann', 'Hamming', 'Butterworth'] }) +
          vivo('FWHM (mm)', 'fwhm', O) +
          campo('Image noise', num(p.ruido.rel * 100 / Math.sqrt(f), 0), { un: '% a nivel de tejido; adquirido ' + num(p.ruido.rel * 100, 0) + ' % (' + p.ruido.como + ')' })) +
        bloque('', campo('Attenuation correction CT', tipo === 'Corrected' ? (acCt || '—') : 'None', { ops: tipo === 'Corrected' ? listaCt : ['None'].concat(listaCt), larga: true }) +
          campo('Scatter correction', tipo === 'Corrected' ? disp : 'None', { ops: ['Relative', 'Absolute', 'None'] }) +
          campo('Decay correction', c.decaimiento, { ops: ['START', 'ADMIN', 'NONE'] }) +
          campo('Units', c.unidades) +
          campo('AC noise from CT', tipo === 'Corrected' ? '± ' + num(epsCt() * 100, 2) : '—', { un: '% (simulado)' }) +
          campo('Corrections', c.corregida.join(' ') || '—', { larga: true })) + '</div>' + PIE_SIM +
        '<p class="ayudita">Las listas en gris son ilustrativas: muestran qué otras opciones ofrece una consola, pero no cambian la imagen.</p>';
    }
    return tarjetaAuto(c);
  }

  // Modulacion de dosis del CT. Sirve para cualquier fabricante: usa la cabecera si trae el tipo
  // de modulacion y, si no, la deduce de cuanto cambia la corriente entre cortes.
  const NOMBRE_MODULACION = [[/siemens/i, 'CARE Dose4D'], [/ge med|general electric/i, 'AutomA / SmartmA'], [/philips/i, 'DoseRight'], [/canon|toshiba/i, 'SUREExposure'], [/united imaging/i, 'uDose']];
  const resumen = l => { const v = l.filter(x => !Number.isNaN(x) && x > 0); return v.length ? { med: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v), n: v.length } : null; };
  function dosisCt() {
    const v = E.ct, c = v.cab, idx = [];
    for (let i = E.r0; i <= E.r1; i++) { const j = v.dePet[i]; if (j >= 0 && !idx.includes(j)) idx.push(j); }
    const de = a => idx.map(j => a[j]);
    const sim = E.sim && ctCambiado(), fac = sim ? v.masZ.map((m, j) => ctFactores(j)) : null;
    const masS = sim ? fac.map(f => f.masSim) : v.masZ, maS = sim ? v.maZ.map((m, j) => m * (v.masZ[j] > 0 ? fac[j].masSim / v.masZ[j] : 1)) : v.maZ, ctdiS = sim ? v.ctdiZ.map((c, j) => c * fac[j].dosis) : v.ctdiZ;
    const D = { ma: resumen(de(maS)), mas: resumen(de(masS)), ctdi: resumen(de(ctdiS)), maTodo: resumen(v.maZ), masTodo: resumen(v.masZ), maZ: maS };
    D.exceso = sim && idx.some(j => fac[j].dosis > 1.02);
    const tipo = (c.modTipo || '').toUpperCase().trim();
    const varia = !!D.maTodo && D.maTodo.n > 2 && (D.maTodo.max - D.maTodo.min) > 0.1 * D.maTodo.med;
    D.activa = tipo ? tipo !== 'NONE' : varia;
    D.tipo = tipo || (varia ? 'No informado' : 'NONE');
    D.origen = tipo ? 'cabecera' : (varia ? 'deducido: la corriente cambia entre cortes' : 'deducido: corriente constante');
    const marca = NOMBRE_MODULACION.find(m => m[0].test(c.fabricante || ''));
    D.nombre = marca ? marca[1] : '';
    D.ahorro = (c.ahorro > 0 && c.ahorro < 100) ? c.ahorro : NaN;
    // mAs de referencia: no viene en el DICOM. Se estima como el mAs que habria sin modulacion.
    if (!D.masTodo) { D.ref = NaN; D.refComo = 'sin datos de mAs'; }
    else if (!D.activa) { D.ref = D.masTodo.med; D.refComo = 'sin modulación: es el mAs usado'; }
    else if (!Number.isNaN(D.ahorro)) { D.ref = D.masTodo.med / (1 - D.ahorro / 100); D.refComo = 'estimado: mAs medio ÷ (1 − ahorro)'; }
    else { D.ref = D.masTodo.max; D.refComo = 'estimado: mAs máximo de los cortes'; }
    D.refBase = D.ref; D.ahorroBase = D.ahorro;
    if (sim) { D.activa = E.sim.mod; D.ref = E.sim.ref; if (!E.sim.mod) { D.ahorro = 0; D.tipo = 'NONE'; D.origen = 'simulado'; } }
    D.dlp = D.ctdi ? D.ctdi.med * E.largo / 10 : NaN;
    return D;
  }
  const entre = (r, d) => r ? num(r.min, d) + ' a ' + num(r.max, d) : '';

  function tarjetaCt(pest) {
    const v = E.ct, c = v.cab, D = dosisCt(), O = opciones(), jj = v.dePet[E.corte];
    const ventanas = c.ventanaC.map((x, i) => 'C ' + x + ' / W ' + c.ventanaA[i]).join('   ');
    if (pest === 'routine') return '<div class="rejilla">' +
      bloque('Dosis', vivo('Dose modulation', 'mod', O, { un: D.nombre ? 'en este fabricante: ' + D.nombre : '' }) +
        campo('Modulation type', D.tipo, { un: D.origen }) +
        vivo('Ref. mAs', 'ref', O, { un: cambiada('ref') ? 'simulado; adquirido ' + num(D.refBase, 0) : D.refComo }) +
        campo('Eff. mAs', D.mas ? num(D.mas.med, 0) : '—', { un: D.mas ? 'medio del rango; de ' + entre(D.mas, 0) : '' }) +
        campo('Tube current', D.ma ? num(D.ma.med, 0) : '—', { un: D.ma ? 'mA medio; de ' + entre(D.ma, 0) : 'mA' }) +
        vivo('kV', 'kv', O) +
        campo('CTDIvol', D.ctdi ? num(D.ctdi.med, 2) : '—', { un: D.ctdi ? 'mGy medio; de ' + entre(D.ctdi, 2) : 'mGy' }) +
        campo('DLP', num(D.dlp, 0), { un: 'mGy·cm, estimado: CTDIvol medio × largo' }) +
        campo('Dose saving', num(D.ahorro, 1), { un: ctCambiado() && !E.sim.mod ? '% (simulado: sin modulación)' : '% (cabecera)' }) +
        campo('Image noise', jj >= 0 ? num(ruidoCtDe(jj), 0) : '—', { un: 'HU en tejido blando, en este corte; adquirido ' + num(v.ruido.sigma, 0) + ' (' + v.ruido.como + ')' })) +
      bloque('', campo('Patient position', c.posicion, { ops: ['HFS', 'FFS', 'HFP', 'FFP'] }) +
        vivo('Slice', 'thk', O, { un: 'mm' }) +
        campo('Pitch', num(c.paso, 2), { giro: true }) + campo('No. of images', E.r1 - E.r0 + 1, { accion: 'rango', giro: true }) +
        campo('Range: Begin', num(E.pets[0].zs[E.r0], 1), { un: 'mm', accion: 'rango', giro: true }) + campo('End', num(E.pets[0].zs[E.r1], 1), { un: 'mm', accion: 'rango', giro: true }) +
        campo('Length', num(E.largo, 0), { un: 'mm' }) + campo('Scan time', num(E.ctDur, 1), { un: E.ctDurReal ? 's' : 's (sin dato de velocidad de mesa)' })) + '</div>' + PIE_SIM;
    if (pest === 'scan') return '<div class="rejilla">' +
      bloque('', campo('Rotation time', num(c.tExp / 1000, 2), { un: 's' }) +
        campo('Collimation', (c.colTotal > 0 && c.colUna > 0) ? Math.round(c.colTotal / c.colUna) + ' × ' + num(c.colUna, 1) : '—', { un: 'mm' }) +
        campo('Feed / rotation', num(c.avance, 1), { un: 'mm' }) +
        campo('Filter type', c.filtro) + campo('Scanner', [c.fabricante, c.modelo].filter(Boolean).join(' '), { larga: true })) +
      bloque('', campo('Scan start', 'Start button', { ops: ['Start button', 'Delay'] }) + campo('Direction', E.ctSentido, { ops: ['Craniocaudal', 'Caudocranial'] }) +
        campo('Table speed', num(c.velMesa, 1), { un: 'mm/s' })) +
      bloque('Corriente del tubo a lo largo del rango', '<canvas id="grafico" data-tipo="ma"></canvas><div class="leyenda"><span style="--c:#e08a00">mA por corte (cabecera)</span><span style="--c:#999">Ref. mAs estimado, en mA</span></div>') + '</div>';
    if (pest === 'recon') return '<div class="rejilla">' +
      bloque('', campo('Series description', v.desc, { larga: true }) + vivo('Slice', 'thk', O, { un: 'mm' }) +
        vivo('Kernel', 'ker', O) + campo('Window', ventanas || '—', { larga: true })) +
      bloque('', campo('FoV', num(c.fov, 0), { ops: [300, 400, 500, 700, 780], un: 'mm' }) +
        campo('Image size', v.recorte ? v.recorte.cols : v.colsOrig, { ops: [512], un: v.recorte ? 'adquirida; cargada recortada a ' + v.cols + ' × ' + v.rows : '' }) + campo('Pixel', num(v.psOrig, 2), { un: 'mm' }) +
        campo('Increment', num(v.dz, 1), { un: 'mm' }) + campo('Uso', 'Corrección de atenuación y localización', { larga: true })) + '</div>' + PIE_SIM +
      '<p class="ayudita">' + (v.reducido > 1 ? 'Este CT supera los 128 millones de vóxeles y se muestra reducido a ' + v.cols + ' × ' + v.rows + '; los valores de la tarjeta son los de la cabecera.' : (v.recorte ? 'Este CT viene recortado: se le quitó el aire de arriba y de abajo para que ocupe menos memoria. Conserva el tamaño de píxel, toda la anatomía y la camilla; la matriz adquirida era de ' + v.recorte.cols + ' × ' + v.recorte.rows + '. ' : '') + 'El CT se usa a su resolución original, ' + v.cols + ' × ' + v.rows + ' × ' + v.n + ': ocupa unos ' + Math.round(v.vol.length * 2 / 1048576) + ' MB de memoria en la consola y el doble al pasar a Volumina. Si el computador tiene poca memoria, la página puede ponerse lenta o cerrarse.') + '</p>';
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
    if (cv.dataset.tipo === 'ma') { pintarCurvaMa(cv); return; }
    const r = cv.getBoundingClientRect(); cv.width = Math.max(100, r.width); cv.height = Math.max(60, r.height);
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, mi = 34, ms = 8, mb = 20;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#999'; g.lineWidth = 1; g.strokeRect(mi, ms, W - mi - 8, H - ms - mb);
    g.fillStyle = '#555'; g.font = '10px Arial'; g.textAlign = 'right'; g.textBaseline = 'middle';
    [0, 50, 100].forEach(v => g.fillText(v, mi - 4, ms + (H - ms - mb) * (1 - v / 110)));
    const xDe = t => mi + (W - mi - 8) * t / E.total, yDe = v => ms + (H - ms - mb) * (1 - v / 110);
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = 0; t <= E.total; t += Math.max(60, Math.round(E.total / 8 / 60) * 60)) g.fillText(Math.round(t / 60) + ' min', xDe(t), H - mb + 4);
    if (!E.sel.length) return;
    const enPet = FASES_PET.includes(E.fase), hasta = enPet ? E.reloj : 0;
    g.strokeStyle = '#1a9a3c'; g.lineWidth = 2; g.beginPath(); let abierto = false;
    E.sel.forEach(c => {
      if (c.ts > hasta || !enPet) return;
      const fin = Math.min(c.ts + E.dur, hasta);
      if (!abierto) { g.moveTo(xDe(c.ts), yDe(c.tasa)); abierto = true; } else g.lineTo(xDe(c.ts), yDe(c.tasa));
      g.lineTo(xDe(fin), yDe(c.tasa));
    });
    g.stroke();
    if (enPet) { g.strokeStyle = '#d33'; g.lineWidth = 1; g.beginPath(); g.moveTo(xDe(hasta), ms); g.lineTo(xDe(hasta), H - mb); g.stroke(); }
  }

  function pintarCurvaMa(cv) {
    const r = cv.getBoundingClientRect(); cv.width = Math.max(100, r.width); cv.height = Math.max(60, r.height);
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, mi = 34, ms = 8, mb = 20, v = E.ct, D = dosisCt();
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#999'; g.lineWidth = 1; g.strokeRect(mi, ms, W - mi - 8, H - ms - mb);
    if (!D.maTodo) { g.fillStyle = '#555'; g.font = '11px Arial'; g.fillText('La cabecera no trae la corriente por corte', mi + 8, H / 2); return; }
    // El Ref. mAs se pasa a mA con la misma razon mAs/mA de los cortes, para dibujarlo en el mismo eje.
    const razon = D.masTodo ? D.masTodo.med / D.maTodo.med : NaN, refMa = (D.ref && razon) ? D.ref / razon : NaN, simMax = resumen(D.maZ);
    const tope = Math.max(D.maTodo.max, simMax ? simMax.max : 0, refMa || 0, (D.refBase && razon) ? D.refBase / razon : 0) * 1.1, n = E.r1 - E.r0 + 1;
    const xDe = q => mi + (W - mi - 8) * (q + 0.5) / n, yDe = m => ms + (H - ms - mb) * (1 - m / tope);
    g.fillStyle = '#555'; g.font = '10px Arial'; g.textAlign = 'right'; g.textBaseline = 'middle';
    [0, 0.5, 1].forEach(f => g.fillText(Math.round(tope * f / 1.1), mi - 4, yDe(tope * f / 1.1)));
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('craneal', xDe(0) + 14, H - mb + 4); g.fillText('caudal', xDe(n - 1) - 12, H - mb + 4);
    if (refMa) { g.strokeStyle = '#999'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(mi, yDe(refMa)); g.lineTo(W - 8, yDe(refMa)); g.stroke(); g.setLineDash([]); }
    [false, true].forEach(hecho => {
      g.strokeStyle = hecho ? '#e08a00' : 'rgba(224,138,0,.35)'; g.lineWidth = hecho ? 2 : 1; g.beginPath(); let abierto = false;
      for (let q = 0; q < n; q++) {
        const i = E.r0 + q, j = v.dePet[i], m = j >= 0 ? D.maZ[j] : NaN;
        if (Number.isNaN(m) || (hecho && !ctVisible(i))) { abierto = false; continue; }
        if (!abierto) { g.moveTo(xDe(q), yDe(m)); abierto = true; } else g.lineTo(xDe(q), yDe(m));
      }
      g.stroke();
    });
  }

  // ---------- paso a Volumina ----------
  // Volumina recibe lo que la consola tiene en memoria: el rango adquirido, con los cortes
  // ordenados de caudal a craneal, y las imagenes tal como se ven (simuladas si hay cambios).
  let voluminaCargada = false, voluminaEnviado = '';
  function estudioParaVolumina(F) {
    // F es el constructor de arreglos del visor: asi los datos se escriben una sola vez, ya en su lugar.
    F = F || Float32Array;
    const oculto = $('ocultarId').checked, base = E.pets[0].cab, nz = E.r1 - E.r0 + 1;
    const comun = c => ({ marco: c.marco, pacienteId: oculto ? 'OCULTO' : (base.id || 'CONSOLA-PET'), pacienteNombre: oculto ? '' : base.nombre, estudioUid: c.estudioUid, estudioId: c.estudioId, fecha: c.fechaEstudio, hora: c.horaEstudio, sopClass: c.sopClass });
    const pets = E.pets.map(v => {
      const N = v.rows * v.cols, datos = new F(nz * N), vol = v.sim || v.vol, c = v.cab;
      for (let k = 0; k < nz; k++) { const i = E.r1 - k; datos.set(vol.subarray(i * N, (i + 1) * N), k * N); }
      const suv = suvDe(v);
      return Object.assign(comun(c), { nx: v.cols, ny: v.rows, nz, spacing: [v.dx, v.dy, v.dz], origin: [v.x0, v.y0, v.zs[E.r1]], datos, modalidad: 'PT', unidades: c.unidades,
        descripcion: v.desc + (v.sim ? ' · simulado' : ''), simulado: !!v.sim, tope: v.nivelBase * E.nivel, suv });
    });
    let ct = null;
    if (E.ct) {
      const v = E.ct, N = v.rows * v.cols, js = [];
      for (let i = E.r1; i >= E.r0; i--) { const j = v.dePet[i]; if (j >= 0 && !js.includes(j)) js.push(j); }
      js.sort((a, b) => v.zs[a] - v.zs[b]);
      if (js.length >= 2) {
        const datos = new F(js.length * N);
        js.forEach((j, k) => { const c = ctCorteSim(j); if (c) datos.set(c, k * N); else for (let q = 0; q < N; q++) datos[k * N + q] = v.vol[j * N + q]; });
        ct = Object.assign(comun(v.cab), { nx: v.cols, ny: v.rows, nz: js.length, spacing: [v.dx, v.dy, v.dz], origin: [v.x0, v.y0, v.zs[js[0]]], datos, modalidad: 'CT', unidades: 'HU',
          descripcion: v.desc + (ctCambiado() ? ' · simulado' : ''), simulado: ctCambiado(), ventana: 400, nivelCt: 40, recorte: v.recorte });
      }
    }
    const sim = pets.some(q => q.simulado) || (ct && ct.simulado);
    return { ct, pets, nota: (sim ? 'Las imágenes traen parámetros simulados en la consola: no son las adquiridas.' : 'Imágenes tal como se adquirieron.') + (ct && ct.recorte ? ' El CT viene recortado: sin el aire de arriba y de abajo, con su resolución original (matriz adquirida ' + ct.recorte.cols + ' × ' + ct.recorte.rows + ').' : '') };
  }
  function enviarAVolumina() {
    const w = $('marcoVolumina').contentWindow;
    if (!voluminaCargada || !w || !w.ConsolaPuente) return;
    const clave = E.pets[0].uid + '/' + E.r0 + '/' + E.r1 + '/' + E.simVer + '/' + E.nivel + '/' + $('ocultarId').checked;
    if (clave === voluminaEnviado) return;
    w.ConsolaPuente.recibir(estudioParaVolumina(w.Float32Array)); voluminaEnviado = clave;
  }
  function voluminaLista() { voluminaCargada = true; if (!$('capaVolumina').hidden) enviarAVolumina(); }
  function abrirVolumina() {
    if (E.fase !== 'terminado') { decir('Volumina se abre cuando termina el examen: primero adquiere el CT y el PET.', true); return; }
    $('capaVolumina').hidden = false;
    const m = $('marcoVolumina');
    if (!m.getAttribute('src')) m.setAttribute('src', 'volumina/index.html?v=5'); else enviarAVolumina();
    decir('Estudio enviado a Volumina: ' + (E.ct ? 'CT y ' : '') + E.pets.length + ' serie(s) PET, ' + (E.r1 - E.r0 + 1) + ' cortes.');
  }
  // El tutorial usa esto para llevar la consola a la pantalla de la que habla cada paso.
  function ir(o) {
    if (E.fase === 'vacio') return;
    if (o.paso && (o.paso === 'pet' || E.ct)) E.paso = o.paso;
    if (o.pestana) E.pestana = o.pestana;
    if (o.modo === 'ct' ? (E.ct && E.fase !== 'rango') : (o.modo && FASES_PET.includes(E.fase) && (o.modo === 'pet' || E.ct))) E.modo = o.modo;
    if (o.derecha && (o.derecha === 'orig' || (o.derecha === 'mipac' ? E.ac : E.nac))) E.derecha = o.derecha;
    refrescarTodo();
  }
  function cerrarVolumina() { $('capaVolumina').hidden = true; decir('De vuelta en la consola. El estudio sigue cargado.'); pintar(); }

  function refrescarTodo() { pintarFranja(); pintarCronica(); pintarTarjeta(); pintar(); }

  // ---------- listas que ya no se pueden cambiar ----------
  function abrirLista(caja) {
    const ops = JSON.parse(caja.dataset.ops), real = caja.dataset.valor, l = $('lista'), sim = caja.dataset.sim || '';
    l.innerHTML = ops.map(o => '<div class="' + (o === real ? 'real' : '') + '" data-op="' + esc(o) + '">' + esc(o) + '</div>').join('') +
      '<div class="pie">' + (sim ? 'Simulado. El primer valor es el adquirido; los demás degradan la imagen. El mínimo es un piso del simulador, no del equipo.' : 'Marcado: valor usado en este estudio.') + '</div>';
    l.dataset.sim = sim;
    l.hidden = false;
    const r = caja.getBoundingClientRect(), alto = l.offsetHeight;
    l.style.left = Math.min(r.left, window.innerWidth - l.offsetWidth - 6) + 'px';
    l.style.top = (r.bottom + alto > window.innerHeight ? Math.max(4, r.top - alto) : r.bottom) + 'px';
    l.style.minWidth = r.width + 'px';
    l.dataset.et = caja.dataset.et; l.dataset.valor = real; E.cajaAbierta = caja;
  }
  function fijo(et, valor, caja, pedido) {
    const donde = E.fase === 'terminado' ? 'la serie ya fue reconstruida' : 'el protocolo de este examen ya trae ese valor';
    decir('«' + et + '» se mantiene en ' + valor + (pedido ? ' (no en ' + pedido + ')' : '') + ': ' + donde + ' y los datos crudos no vienen en el DICOM.', true);
    if (caja) { caja.classList.remove('parpadeo'); void caja.offsetWidth; caja.classList.add('parpadeo'); }
  }

  // ---------- eventos ----------
  function moverCorte(i) { if (E.fase === 'vacio' || E.fase === 'rango') return; E.corte = Math.max(E.r0, Math.min(E.r1, i)); pintar(); if (E.paso === 'ct' && ctCambiado()) pintarTarjeta(); }

  // Arrastre del rango sobre el topograma: cada borde salta al borde de cama mas cercano.
  let arrastre = null;
  const yLienzo = (cv, ev) => (ev.clientY - cv.getBoundingClientRect().top) * cv.height / cv.getBoundingClientRect().height;
  function cercaDe(cv, ev) {
    const T = E.cajaTopo; if (!T || E.fase !== 'rango') return null;
    const y = yLienzo(cv, ev), m = 12 * cv.height / cv.getBoundingClientRect().height;
    if (Math.abs(y - T.yA) <= m && Math.abs(y - T.yA) <= Math.abs(y - T.yB)) return 'sup';
    if (Math.abs(y - T.yB) <= m) return 'inf';
    return (y > T.yA && y < T.yB) ? 'mover' : null;
  }
  function arrastrar(cv, ev) {
    const T = E.cajaTopo, y = yLienzo(cv, ev), p = E.pets[0];
    const mejor = (lista, f) => { let m = lista[0]; lista.forEach(k => { if (Math.abs(f(k) - y) < Math.abs(f(m) - y)) m = k; }); return m; };
    const serie = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
    const antes = E.r0 + '/' + E.r1;
    if (E.continuo) {
      const corte = Math.max(0, Math.min(p.n - 1, Math.round((y - T.caja.y) / T.caja.h * p.n)));
      if (arrastre.que === 'sup') fijarCortes(Math.min(corte, E.r1 - 4), E.r1);
      else if (arrastre.que === 'inf') fijarCortes(E.r0, Math.max(corte, E.r0 + 4));
      else { const n = arrastre.r1 - arrastre.r0, r0 = Math.max(0, Math.min(p.n - 1 - n, arrastre.r0 + corte - arrastre.corte)); fijarCortes(r0, r0 + n); }
    } else {
      const n = E.espacial.length;
      if (arrastre.que === 'sup') fijarRango(mejor(serie(0, E.b1), k => T.ySup(E.espacial[k].c0)), E.b1);
      else if (arrastre.que === 'inf') fijarRango(E.b0, mejor(serie(E.b0, n - 1), k => T.yInf(E.espacial[k].c1)));
      else {
        const centro = k => (T.ySup(E.espacial[k].c0) + T.yInf(E.espacial[k].c1)) / 2, ancho = arrastre.b1 - arrastre.b0;
        const b0 = Math.max(0, Math.min(n - 1 - ancho, arrastre.b0 + mejor(serie(0, n - 1), centro) - arrastre.cama));
        fijarRango(b0, b0 + ancho);
      }
    }
    if (antes !== E.r0 + '/' + E.r1) {
      decir(E.continuo ? 'Rango: ' + num(E.largo, 0) + ' mm.' : 'Rango: camas ' + (E.b0 + 1) + ' a ' + (E.b1 + 1) + ' (' + E.sel.length + ' de ' + E.espacial.length + '), ' + num(E.largo, 0) + ' mm, PET de ' + num(E.total / 60, 1) + ' min.');
      pintarFranja(); pintarTarjeta(); pintar();
    }
  }
  function lecturaAxial(ev) {
    if (E.fase === 'vacio' || !E.cajaAxial) return;
    const cv = $('cvAxial'), r = cv.getBoundingClientRect(), k = cv.width / r.width, A = E.cajaAxial, p = pet();
    const fx = A.x0 + ((ev.clientX - r.left) * k - A.caja.x) / A.caja.w * A.ancho, fy = A.y0 + ((ev.clientY - r.top) * k - A.caja.y) / A.caja.h * A.alto;
    const x = Math.round((fx - p.x0) / p.dx), y = Math.round((fy - p.y0) / p.dy);
    let t = '';
    if (E.modo !== 'ct' && revelado(E.corte) && x >= 0 && y >= 0 && x < p.cols && y < p.rows) {
      const v = (p.sim || p.vol)[(E.corte * p.rows + y) * p.cols + x];
      t = num(v, 0) + ' ' + (p.cab.unidades || '');
      const su = suvDe(p);
      if (su > 0) t += '   SUVbw ' + num(v / su, 2);
    } else if (E.modo === 'ct' && ctVisible(E.corte)) {
      const ct = E.ct, cx = Math.floor((fx - (ct.x0 - ct.dx / 2)) / ct.dx), cy = Math.floor((fy - (ct.y0 - ct.dy / 2)) / ct.dy);
      const cs = ctCorteSim(ct.dePet[E.corte]);
      if (cx >= 0 && cy >= 0 && cx < ct.cols && cy < ct.rows) t = Math.round(cs ? cs[cy * ct.cols + cx] : ct.vol[(ct.dePet[E.corte] * ct.rows + cy) * ct.cols + cx]) + ' HU';
    }
    if (t !== E.lectura) { E.lectura = t; pintarAxial(); }
  }
  function clicVertical(cv, cajaInfo, ev) {
    if (E.fase === 'vacio' || !cajaInfo) return;
    const r = cv.getBoundingClientRect(), y = (ev.clientY - r.top) * cv.height / r.height, c = cajaInfo.caja;
    moverCorte(E.r0 + Math.floor((y - c.y) / c.h * (E.r1 - E.r0 + 1)));
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
    $('btnSkip').onclick = saltar;
    $('btnVolumina').onclick = abrirVolumina;
    document.querySelectorAll('button.der').forEach(b => { b.onclick = () => { E.derecha = b.dataset.der; pintarDerecha(); }; });
    const topo = $('cvTopo');
    topo.addEventListener('pointerdown', ev => {
      const que = cercaDe(topo, ev);
      if (que) {
        const T = E.cajaTopo, y = yLienzo(topo, ev), p = E.pets[0];
        let cama = 0; E.espacial.forEach((c, k) => { const m = (T.ySup(c.c0) + T.yInf(c.c1)) / 2, a = (T.ySup(E.espacial[cama].c0) + T.yInf(E.espacial[cama].c1)) / 2; if (Math.abs(m - y) < Math.abs(a - y)) cama = k; });
        arrastre = { que, b0: E.b0, b1: E.b1, r0: E.r0, r1: E.r1, cama, corte: Math.round((y - T.caja.y) / T.caja.h * p.n) };
        try { topo.setPointerCapture(ev.pointerId); } catch (e) { } ev.preventDefault();
      } else if (E.fase !== 'rango' && E.cajaTopo) {
        const T = E.cajaTopo, p = E.pets[0];
        moverCorte(Math.floor((yLienzo(topo, ev) - T.caja.y) / T.caja.h * p.n));
      }
    });
    topo.addEventListener('pointermove', ev => {
      if (arrastre) { arrastrar(topo, ev); return; }
      const que = cercaDe(topo, ev);
      topo.style.cursor = que === 'mover' ? 'grab' : que ? 'ns-resize' : 'default';
    });
    ['pointerup', 'pointercancel'].forEach(n => topo.addEventListener(n, () => { arrastre = null; }));
    $('vel').onchange = ev => { E.vel = +ev.target.value; };
    $('ocultarId').onchange = pintarFranja;
    $('corte').oninput = ev => moverCorte(+ev.target.value);
    $('giro').oninput = ev => { E.giro = +ev.target.value; pintarDerecha(); };
    $('nivel').oninput = ev => { E.nivel = +ev.target.value / 100; pintar(); };
    document.querySelectorAll('button.modo.izq').forEach(b => { b.onclick = () => { E.modo = b.dataset.modo; pintar(); }; });
    document.querySelectorAll('.pestana').forEach(b => { b.onclick = () => { E.pestana = b.dataset.pestana; pintarTarjeta(); }; });
    $('cvAxial').addEventListener('wheel', ev => { ev.preventDefault(); moverCorte(E.corte + (ev.deltaY > 0 ? 1 : -1)); }, { passive: false });
    $('cvAxial').addEventListener('mousemove', lecturaAxial);
    $('cvMip').addEventListener('click', ev => clicVertical($('cvMip'), E.cajaMip, ev));
    $('cronica').addEventListener('click', ev => {
      const c = ev.target.closest('.cajita'), p = ev.target.closest('.paso');
      if (!p || !p.dataset.paso) return;
      E.paso = p.dataset.paso;
      if (c && c.dataset.trabajo !== undefined) { E.trabajo = +c.dataset.trabajo; E.pestana = 'recon'; }
      if (E.paso === 'ct' || E.paso === 'topo') { if (E.modo === 'pet') E.modo = 'ct'; } else if (E.modo === 'ct' && FASES_PET.includes(E.fase)) E.modo = 'pet';
      refrescarTodo();
    });
    $('contenido').addEventListener('click', ev => {
      const t = ev.target.closest('.t');
      if (t) { const k = +t.dataset.trabajo; if (k < E.pets.length) { E.trabajo = k; refrescarTodo(); decir('Trabajo de reconstrucción ' + (k + 1) + ': ' + pet().desc + '.'); } else decir('El trabajo de reconstrucción ' + (k + 1) + ' está vacío: este estudio trae ' + E.pets.length + ' serie(s) PET.', true); return; }
      if (ev.target.id === 'restaurar') { restaurar(); return; }
      const caja = ev.target.closest('[data-et]');
      if (!caja) return;
      if (caja.dataset.accion === 'rango') {
        if (E.fase === 'rango') decir('El rango se ajusta arrastrando sus bordes sobre el topograma. ' + (E.continuo ? '' : 'Salta de cama en cama: no puede quedar a la mitad de una.'), true);
        else fijo(caja.dataset.et, caja.dataset.valor, caja);
        return;
      }
      if (caja.dataset.sim) {
        if (!permitido(caja.dataset.sim)) { decir('«' + caja.dataset.et + '» se puede cambiar después de adquirir ' + (CLAVES_CT.includes(caja.dataset.sim) ? 'el CT' : 'el PET') + ': primero se adquiere con los valores del protocolo.', true); caja.classList.remove('parpadeo'); void caja.offsetWidth; caja.classList.add('parpadeo'); return; }
        ev.stopPropagation(); abrirLista(caja); return;
      }
      if (caja.dataset.accion === 'unidad') { E.unidadDosis = E.unidadDosis === 'mCi' ? 'MBq' : 'mCi'; pintarFranja(); pintarTarjeta(); decir('La actividad se muestra en ' + E.unidadDosis + '. Es el mismo valor de la cabecera, en otra unidad.'); return; }
      if (caja.dataset.ops) { ev.stopPropagation(); abrirLista(caja); return; }
      if (caja.dataset.giro) fijo(caja.dataset.et, caja.dataset.valor, caja.classList.contains('caja') ? caja : null);
    });
    $('lista').addEventListener('click', ev => {
      const o = ev.target.closest('[data-op]'), l = $('lista');
      if (!o) return;
      l.hidden = true;
      if (l.dataset.sim) { aplicarSim(l.dataset.sim, o.dataset.op); return; }
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
  window.ConsolaPet = { estado: E, suvDe, ir, abrirVolumina, cerrarVolumina, voluminaLista, estudioParaVolumina, dosisCt, opciones, aplicarSim, restaurar, fraccionCuentas, epsCt, ctCorteSim, ctFactores, cargar, iniciar, pausar, saltar, terminar, planificar, fijarRango, revelado, ctVisible, camaActual };
})();
