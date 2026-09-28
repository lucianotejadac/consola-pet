/* Puente entre la consola PET y Volumina. La consola entrega el CT y las series PET que ya
   tiene en memoria, recortados al rango adquirido; aqui no se lee ningun archivo. */
window.addEventListener('error', ev => { (window.__errores = window.__errores || []).push(String(ev.message)); });
const ConsolaPuente = (() => {
  'use strict';
  let estudio = null, limitada = 0;
  const generados = {};
  const medio = v => Math.round(v * 2) / 2;

  // Los arreglos se copian a este documento para que el visor sea dueño de sus datos.
  function volumenDe(d) {
    const data = new Float32Array(d.datos.length); data.set(d.datos);
    return {
      nx: d.nx, ny: d.ny, nz: d.nz, spacing: d.spacing.slice(), origin: d.origin.slice(), data,
      description: d.descripcion, modality: d.modalidad, sopClass: d.sopClass || '', units: d.unidades || '',
      frame: d.marco || 'consola-pet', patientId: d.pacienteId || 'CONSOLA-PET', issuer: '', tiltDegrees: 0,
      studyUid: d.estudioUid || '', studyId: d.estudioId || '', studyDate: d.fecha || '', studyTime: d.hora || '', accession: '',
      patientName: d.pacienteNombre || '', referring: '', window: d.ventana || 400, level: Number.isFinite(d.nivelCt) ? d.nivelCt : 40,
      suv: d.suv || 0, tope: d.tope || 0, simulado: !!d.simulado,
    };
  }

  function recibir(e) {
    for (const k of Object.keys(generados)) delete generados[k];
    estudio = { ct: e.ct ? volumenDe(e.ct) : null, pets: e.pets.map(volumenDe), nota: e.nota || '' };
    const s = $('series'); s.replaceChildren();
    if (estudio.ct) s.add(new Option('CT · ' + estudio.ct.description, 'ct'));
    estudio.pets.forEach((p, k) => s.add(new Option('PET solo · ' + p.description, 'pet' + k)));
    s.disabled = s.options.length < 2;
    s.value = estudio.ct ? 'ct' : 'pet0';
    elegirBase();
  }

  function elegirBase() {
    if (!estudio) return;
    const k = $('series').value, conCt = k === 'ct';
    // La ventana base sirve para el CT en HU o para el PET solo, en sus propias unidades.
    const v = conCt ? estudio.ct : estudio.pets[+k.slice(3)];
    if (conCt) { $('width').max = 4000; $('level').min = -1200; $('level').max = 2000; }
    else { const t = Math.max(1, Math.ceil(v.tope * 3)); $('width').max = t; $('level').min = 0; $('level').max = t; v.window = Math.round(v.tope); v.level = Math.round(v.tope / 2); }
    $('preset').disabled = !conCt;
    setVolume(v);
    const p = $('spectSeries'); p.replaceChildren();
    if (conCt && estudio.pets.length) {
      estudio.pets.forEach((q, i) => p.add(new Option(q.description, String(i))));
      p.disabled = estudio.pets.length < 2;
      elegirPet();
    } else {
      p.add(new Option(conCt ? 'Sin PET' : 'El PET es el volumen base', '')); p.disabled = true;
      $('spectMetadata').textContent = conCt ? 'Sin serie PET.' : 'El PET se muestra solo, como volumen base: MPR en gris y MIP o VRT en 3D.';
      if (!conCt) { baseMaximum = tope8(v, baseMaximum); escala3D(v, baseMaximum); update3DControls(); }
      avisar(v);
    }
    $('series').disabled = $('series').options.length < 2;
  }

  // Parte con la misma escala de la consola, y no con el maximo del volumen, que suele ser la vejiga.
  // Si el maximo del volumen es muchas veces el nivel de la consola, la escala en porcentaje no
  // alcanza para ajustarla: el 100 % se limita a 8 veces ese nivel.
  const tope8 = (v, maximo) => (v.tope > 0 && maximo > 8 * v.tope) ? 8 * v.tope : maximo;
  function escala3D(v, maximo) {
    const alto = Math.max(1, Math.min(100, medio(100 * v.tope / maximo))) || 100;
    $('volumeHigh').value = alto; $('volumeLow').value = Math.max(0, Math.min(alto - 0.5, medio(alto * 0.04)));
    $('volumePalette').value = 'inverse';
    // Vista anterior y acercada: el cuerpo entero es mucho mas alto que ancho.
    yaw = 0; pitch = 0; zoom = 1.7;
    setMode('mip');
    return alto;
  }

  function elegirPet() {
    if (!estudio || !estudio.ct) return;
    const v = estudio.pets[+$('spectSeries').value || 0];
    try { setSpect(v); } catch (err) { status('No se pudo fusionar: ' + err.message, true); return; }
    const real = spectMaximum; spectMaximum = tope8(v, spectMaximum); limitada = spectMaximum < real ? real : 0;
    const alto = escala3D(v, spectMaximum);
    $('spectHigh').value = alto; $('spectLow').value = Math.max(0, Math.min(alto - 0.5, medio(alto * 0.1)));
    $('spectSeries').disabled = estudio.pets.length < 2;
    updateFusion();
    avisar(v);
  }

  function avisar(v) {
    const partes = [estudio.ct ? 'CT ' + estudio.ct.nx + ' × ' + estudio.ct.ny + ' × ' + estudio.ct.nz : 'sin CT', 'PET ' + v.nx + ' × ' + v.ny + ' × ' + v.nz + ' (' + v.description + ')'];
    status('Estudio recibido de la consola: ' + partes.join(' + ') + '.' + (estudio.nota ? ' ' + estudio.nota : '') + (limitada ? ' El máximo real del PET es ' + limitada.toPrecision(4) + '; la escala se limitó a 8 veces el nivel de la consola para poder ajustarla.' : ''));
  }

  // Lo que se genero en «Generar cortes», para el informe del tutorial.
  document.addEventListener('volumina', ev => {
    if (ev.detail && ev.detail.kind === 'slices' && slicePlan) generados[slicePlan.plane] = { cortes: slicePlan.count, distancia: slicePlan.distance, grosor: slicePlan.thickness, contenido: sliceContentIsFusion() ? 'CT + PET fusionados' : 'solo volumen base' };
  });
  $('volver').addEventListener('click', () => { if (window.parent && window.parent.ConsolaPet) window.parent.ConsolaPet.cerrarVolumina(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !expandedPane && window.parent && window.parent.ConsolaPet && !document.querySelector('.modal:not([hidden])')) window.parent.ConsolaPet.cerrarVolumina(); });
  return { recibir, elegirBase, elegirPet, estudio: () => estudio, generados: () => generados };
})();
window.ConsolaPuente = ConsolaPuente;
if (window.parent && window.parent !== window && window.parent.ConsolaPet && window.parent.ConsolaPet.voluminaLista) window.parent.ConsolaPet.voluminaLista();
