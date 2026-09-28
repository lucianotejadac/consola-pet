/* Tutorial guiado de la consola PET, con la interfaz del tutorial de la consola TC: un panel
   flotante con una pregunta a la vez, una linea de puntos hacia lo que hay que mover, un
   recuadro donde aparece el resultado, un cuadro para la respuesta y un informe al final.
   Cubre todo el proceso: planificacion, CT, PET, calidad de imagen y Volumina.
   Los selectores que empiezan con «v:» apuntan a elementos dentro de Volumina. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = () => window.ConsolaPet, E = () => window.ConsolaPet.estado;
  const marco = () => $('marcoVolumina');
  const enVolumina = () => !$('capaVolumina').hidden;
  const puente = () => { const w = marco().contentWindow; return w && w.ConsolaPuente ? w.ConsolaPuente : null; };
  const terminado = () => E().fase === 'terminado';
  const ctHecho = () => ['entre', 'adquiriendo', 'pausa', 'terminado'].includes(E().fase);
  const cargado = () => E().fase !== 'vacio';
  const generado = plano => { const p = puente(); return !!(p && p.generados && p.generados()[plano]); };
  const campo = et => '#contenido [data-et="' + et + '"]';
  const vivo = k => '#contenido [data-sim="' + k + '"]';

  const ETAPAS = { 1: 'Planificación', 2: 'Adquisición del CT', 3: 'Adquisición del PET', 4: 'Calidad de imagen', 5: 'Volumina y cortes' };
  const PASOS = [
    { id: '1.1', t: 'El protocolo y el orden de los pasos', ir: { paso: 'topo' }, move: ['#cronica'], look: ['#panelTopo'], falta: () => cargado() ? '' : 'Primero carguen el estudio con Load.',
      q: 'A la izquierda está la lista de pasos del protocolo. Pulsen cada uno y revisen qué muestra su pestaña Routine. Expliquen para qué sirve el topograma, por qué el CT se adquiere antes que el PET y qué ocurre en el paso Pause.' },
    { id: '1.2', t: 'Radiofármaco, actividad y captación', ir: { paso: 'pet', pestana: 'routine' }, move: [campo('Dose unit')], look: [campo('Dose'), campo('Uptake time')], falta: () => cargado() ? '' : 'Primero carguen el estudio con Load.',
      q: 'En el paso PET, pestaña Routine, lean el isótopo, el radiofármaco, la actividad inyectada y la hora de inyección. Pulsen la unidad para ver la actividad en mCi y en MBq. Anoten la actividad en ambas unidades y el tiempo de captación, y digan si ese tiempo está dentro de lo habitual para este radiofármaco.' },
    { id: '1.3', t: 'El rango respeta las camas', ir: { paso: 'pet', pestana: 'routine' }, move: ['#panelTopo'], look: [campo('No. of beds'), campo('Scan time'), '#resumen'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : E().fase !== 'rango' ? 'El rango se define antes de adquirir. Para repetirlo, terminen el examen y pulsen New.' : '',
      hecho: () => cargado() && (E().fase !== 'rango' || E().b0 !== 0 || E().b1 !== Math.max(0, Math.ceil(E().espacial.length / 2) - 1)),
      q: 'Arrastren los bordes magenta del rango sobre el topograma. Dejen primero solo el tórax y anoten número de camas, largo y duración del PET. Después cubran la anatomía que corresponda a la indicación del estudio y anoten lo mismo. Expliquen por qué el borde salta de cama en cama, por qué las camas se traslapan y qué relación hay entre largo del rango y tiempo de examen.' },
    { id: '2.1', t: 'Adquirir el CT', ir: { paso: 'ct', pestana: 'routine' }, move: ['#btnStart'], look: ['#panelTopo', '#panelAxial'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !E().ct ? 'Este estudio se cargó sin CT: la etapa del CT no existe. Pasen a la etapa 3.' : '', hecho: () => cargado() && !!E().ct && ctHecho(),
      q: 'Con el rango definido, pulsen Start y observen el barrido del CT sobre el topograma: en qué sentido avanza, cuánto dura y cómo van apareciendo los cortes. Anoten la duración del CT y compárenla con la duración del PET que planificaron. Digan qué consecuencia tiene esa diferencia para el registro entre las dos imágenes cuando el paciente respira.' },
    { id: '2.2', t: 'La modulación de dosis', ir: { paso: 'ct', pestana: 'scan' }, move: ['#pestanas'], look: ['#grafico', '#panelTopo'], falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !E().ct ? 'Este estudio se cargó sin CT.' : '',
      q: 'En el paso CT, la pestaña Scan muestra la corriente del tubo a lo largo del rango; la misma curva aparece en naranja al costado del topograma. Identifiquen en qué regiones anatómicas sube y en cuáles baja, y expliquen por qué. En la pestaña Routine, lean si la modulación está activa, de qué tipo es y cuánta dosis ahorra.' },
    { id: '2.3', t: 'La dosis del CT y para qué se usa', ir: { paso: 'ct', pestana: 'routine' }, move: [], look: [campo('CTDIvol'), campo('DLP'), campo('Eff. mAs')], falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !E().ct ? 'Este estudio se cargó sin CT.' : '',
      q: 'Anoten el kV, el mAs efectivo medio, el CTDIvol y el DLP del rango que adquirieron. Con esos valores, digan si este CT es de baja dosis o de calidad diagnóstica, y expliquen las dos funciones que cumple en un PET/CT.' },
    { id: '3.1', t: 'Adquirir el PET', ir: { paso: 'pet', pestana: 'scan' }, move: ['#btnStart'], look: ['#panelTopo', '#grafico', '#panelMip'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : (E().ct && !ctHecho()) ? 'Primero adquieran el CT.' : '', hecho: () => cargado() && terminado(),
      q: 'Pulsen Start para adquirir el PET. Sigan la cama activa en el topograma, la cuenta regresiva en el paso PET y la curva de la pestaña Scan. Pueden cambiar la velocidad o saltar con Skip. Anoten en qué sentido avanzan las camas y qué cama muestra más actividad, y digan a qué órganos corresponde. Expliquen por qué un corte solo aparece cuando termina la última cama que lo cubre.' },
    { id: '3.2', t: 'Los parámetros de la reconstrucción', ir: { paso: 'pet', pestana: 'recon' }, move: ['#pestanas'], look: ['#contenido'], falta: () => cargado() ? '' : 'Primero carguen el estudio con Load.',
      q: 'En la pestaña Recon del PET, anoten el método de reconstrucción, las iteraciones, los subconjuntos, el filtro con su ancho, la matriz y el tamaño de píxel. Lean la lista de correcciones aplicadas y expliquen qué corrige cada una. Abran una lista en gris y una en azul, y digan en qué se diferencian.' },
    { id: '4.1', t: 'Con y sin corrección de atenuación', ir: { paso: 'pet', pestana: 'recon', modo: 'pet', derecha: 'axnac' }, move: ['button.der[data-der="axnac"]', '#corte'], look: ['#panelAxial', '#panelMip'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Primero terminen la adquisición del PET.' : !E().nac ? 'Este estudio se cargó sin la serie PET sin corregir: no se puede comparar.' : '',
      q: 'En la ventana derecha elijan Axial NAC: muestra el mismo corte que la ventana central, sin corrección de atenuación. Recorran el tórax y el abdomen con el deslizador de corte. Describan cómo se ven la piel, los pulmones y el centro del cuerpo en cada serie, en qué unidades está cada una, y digan para qué sirve revisar la serie sin corregir.' },
    { id: '4.2', t: 'Menos tiempo por cama', ir: { paso: 'pet', pestana: 'routine', modo: 'pet', derecha: 'orig' }, move: [vivo('tCama')], look: [campo('Counts'), '#panelAxial', '#panelMip'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Los parámetros se cambian después de adquirir: terminen el PET.' : '', hecho: () => cargado() && E().sim && E().base && E().sim.tCama < E().base.tCama,
      q: 'Bajen el tiempo por cama al mínimo de la lista. La ventana central muestra la imagen simulada y la derecha, en Original, la adquirida. Anoten el porcentaje de cuentas que queda, cuánto sube el ruido y cuánto dura ahora el examen. Busquen una captación pequeña y digan si sigue siendo identificable. ¿En qué paciente aceptarían acortar el tiempo?' },
    { id: '4.3', t: 'Iteraciones y filtro', ir: { paso: 'pet', pestana: 'recon', modo: 'pet', derecha: 'orig' }, move: [vivo('iter'), vivo('fwhm')], look: ['#panelAxial', campo('Image noise')],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Los parámetros se cambian después de adquirir: terminen el PET.' : '', hecho: () => cargado() && E().sim && E().base && (E().sim.iter < E().base.iter || E().sim.fwhm > E().base.fwhm),
      q: 'Restauren lo adquirido. Bajen las iteraciones a 1 y observen el contraste de las captaciones contra el fondo. Devuélvanlas a su valor y suban el filtro al máximo de la lista. Pasen el cursor sobre una captación pequeña y anoten su valor máximo en cada caso. Expliquen qué se gana y qué se pierde con el filtro, y por qué importa para comparar estudios de distintos centros.' },
    { id: '4.4', t: 'El CT con menos dosis', ir: { paso: 'ct', pestana: 'routine', modo: 'ct', derecha: 'orig' }, move: [vivo('ref'), vivo('mod')], look: [campo('Image noise'), campo('DLP'), '#panelAxial'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !E().ct ? 'Este estudio se cargó sin CT.' : !ctHecho() ? 'Los parámetros se cambian después de adquirir: adquieran el CT.' : '', hecho: () => cargado() && E().sim && E().base && E().sim.ref < E().base.ref,
      q: 'En el paso CT, bajen el mAs de referencia al mínimo y anoten el ruido de la imagen y el DLP. Después, en la pestaña Recon del PET, lean cuánto de ese ruido pasa al PET corregido. Expliquen por qué el efecto es tan pequeño. Vuelvan al mAs adquirido y apaguen la modulación de dosis: ¿qué pasa con la dosis y qué pasa con la imagen?' },
    { id: '4.5', t: 'Cierre: qué protocolo propondrían', ir: { paso: 'pet', pestana: 'routine', modo: 'pet', derecha: 'orig' }, move: ['#restaurar'], look: ['#panelAxial', '#resumen'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Primero terminen la adquisición del PET.' : '',
      q: 'Les piden acortar el examen sin perder la respuesta a la pregunta clínica. Dejen la consola con la configuración que propondrían, justifíquenla comparando con la imagen adquirida, y digan qué parámetro no tocarían. Recuerden que el efecto es simulado y que los mínimos de las listas son pisos del simulador. Al terminar, pulsen Restaurar lo adquirido para pasar a Volumina con las imágenes originales.' },
    { id: '5.1', t: 'Pasar a Volumina y comprobar el registro', volumina: true, move: ['v:#fusionOpacity'], look: ['v:.pane.coronal'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Volumina se abre cuando termina el examen.' : '', hecho: () => enVolumina() && !!puente() && !!puente().estudio(),
      q: 'Volumina recibe el CT y el PET del rango que adquirieron, sin volver a cargar archivos. Hagan clic dentro de cada plano para mover las líneas de referencia y usen la rueda para cambiar de corte. Muevan la opacidad del PET para ver el CT por debajo. Revisen las bases pulmonares, la cúpula hepática y la vejiga, y digan si la captación cae donde corresponde en la anatomía o si ven desregistro.' },
    { id: '5.2', t: 'La escala del PET y el MIP', volumina: true, move: ['v:#spectHigh', 'v:#volumeHigh'], look: ['v:.pane.volume', 'v:#spectScale'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Volumina se abre cuando termina el examen.' : '',
      q: 'La saturación superior es un porcentaje del máximo del volumen. Súbanla a 100 % en la fusión y en el 3D y observen qué queda visible; después devuélvanla al valor inicial. Anoten qué estructura fija ese máximo y por qué revisar el PET sin ajustar la escala equivale a no revisarlo. Giren el MIP arrastrando y enumeren las captaciones fisiológicas que reconocen.' },
    { id: '5.3', t: 'Generar cortes coronales', volumina: true, move: ['v:#sliceSource', 'v:#slicePlane', 'v:#sliceDistance', 'v:#sliceGenerate'], look: ['v:#slicePlan', 'v:.pane.volume'],
      prepara: v => { v.elegir('sliceSource', 'axial'); v.elegir('slicePlane', 'coronal'); },
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Volumina se abre cuando termina el examen.' : '', hecho: () => generado('coronal'),
      q: 'En «Generar cortes», con la ventana de trabajo Axial y el plano de salida Coronal, elijan distancia y grosor. Sobre el plano axial aparecen dos líneas: arrástrenlas para fijar desde dónde hasta dónde se corta. Pulsen Generar y recorran los cortes con la rueda en el cuarto panel. Anoten cuántos cortes salieron, con qué distancia y grosor, y justifiquen esos valores mirando el tamaño de vóxel del PET.' },
    { id: '5.4', t: 'Generar cortes sagitales', volumina: true, move: ['v:#slicePlane', 'v:#sliceThickness', 'v:#sliceGenerate'], look: ['v:#slicePlan', 'v:.pane.volume'],
      prepara: v => { v.elegir('sliceSource', 'axial'); v.elegir('slicePlane', 'sagittal'); },
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Volumina se abre cuando termina el examen.' : '', hecho: () => generado('sagittal'),
      q: 'Cambien el plano de salida a Sagital y generen la serie. Prueben un grosor mayor que la distancia y después uno menor, y lean el aviso que aparece en el plan. Expliquen qué significa que los cortes queden solapados o con huecos, y cuál de las dos situaciones puede ocultar una lesión.' },
    { id: '5.5', t: 'Generar cortes axiales', volumina: true, move: ['v:#sliceSource', 'v:#slicePlane', 'v:#sliceCombine', 'v:#sliceGenerate'], look: ['v:#slicePlan', 'v:.pane.volume'],
      prepara: v => { v.elegir('sliceSource', 'coronal'); v.elegir('slicePlane', 'axial'); },
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Volumina se abre cuando termina el examen.' : '', hecho: () => generado('axial'),
      q: 'El plano de salida siempre es perpendicular a la ventana de trabajo: para cortes axiales, la ventana de trabajo debe ser Coronal o Sagital. Fijen el rango sobre el plano coronal y generen la serie axial. Cambien la combinación del grosor de Promedio a MIP del slab y comparen. Digan en qué se diferencian estos cortes axiales de los que entregó el equipo.' },
    { id: '5.6', t: 'Cierre: qué entregarían', volumina: true, move: ['v:#sliceExport', 'v:#exportPng', 'v:#sliceName'], look: ['v:.pane.volume'],
      falta: () => !cargado() ? 'Primero carguen el estudio con Load.' : !terminado() ? 'Volumina se abre cuando termina el examen.' : '',
      q: 'Pongan nombre a la serie y revisen las dos salidas: Exportar DICOM y PNG. Lean la nota bajo los botones sobre qué tipo de imagen se exporta. Digan qué series enviarían al PACS para este estudio, en qué planos y con qué contenido, y qué no se puede medir sobre una serie fusionada exportada en color.' },
  ];

  let abierto = false, paso = 0, movido = false, notas = {}, trazos = [], firma = '';
  try { const s = localStorage.getItem('consola-pet-tutorial'); if (s) notas = JSON.parse(s) || {}; } catch (e) { }
  const panel = $('guia'), marcas = $('guiaMarcas'), it = () => PASOS[paso];

  // Un selector «v:» se busca dentro de Volumina; el marco ocupa toda la ventana, asi que sus
  // coordenadas son las mismas de la pagina.
  function elementos(lista) {
    return (lista || []).map(s => {
      const dentro = s.startsWith('v:');
      if (dentro && !enVolumina()) return null;
      const doc = dentro ? marco().contentDocument : document;
      const el = doc ? doc.querySelector(dentro ? s.slice(2) : s) : null;
      if (!el || (el.offsetParent === null && getComputedStyle(el).position !== 'fixed')) return null;
      return el.closest('.campo') || (dentro && el.closest('label')) || el;
    }).filter(Boolean);
  }
  function limpiarObjetivos() {
    [document, marco().contentDocument].forEach(d => { if (d) d.querySelectorAll('.guia-objetivo').forEach(el => el.classList.remove('guia-objetivo')); });
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  function marcar() {
    marcas.innerHTML = ''; trazos = []; limpiarObjetivos();
    if (!abierto) return;
    const mv = elementos(it().move);
    if (mv.length) {
      const svg = document.createElementNS(SVGNS, 'svg'); svg.id = 'guiaSvg';
      svg.innerHTML = '<defs><marker id="guiaPunta" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path class="guia-punta" d="M1,1 L11,6 L1,11 z"/></marker></defs>';
      mv.forEach(el => {
        el.classList.add('guia-objetivo');
        const halo = document.createElementNS(SVGNS, 'path'); halo.setAttribute('class', 'guia-halo');
        const linea = document.createElementNS(SVGNS, 'path'); linea.setAttribute('class', 'guia-linea'); linea.setAttribute('marker-end', 'url(#guiaPunta)');
        const origen = document.createElementNS(SVGNS, 'circle'); origen.setAttribute('class', 'guia-origen'); origen.setAttribute('r', '5');
        svg.appendChild(halo); svg.appendChild(linea); svg.appendChild(origen);
        trazos.push({ el, halo, linea, origen });
      });
      marcas.appendChild(svg);
    }
    elementos(it().look).forEach(el => {
      const r = el.getBoundingClientRect(), b = document.createElement('div');
      b.className = 'guia-mira';
      b.style.left = Math.round(r.left - 4) + 'px'; b.style.top = Math.round(r.top - 4) + 'px';
      b.style.width = Math.round(r.width + 8) + 'px'; b.style.height = Math.round(r.height + 8) + 'px';
      marcas.appendChild(b);
    });
    lineas();
  }
  // Cada linea sale del panel por el lado que mira a su control y lo sigue mientras se arrastra.
  function lineas() {
    if (!trazos.length) return;
    const p = panel.getBoundingClientRect(), G = 10, pcx = (p.left + p.right) / 2, pcy = (p.top + p.bottom) / 2, n = trazos.length;
    trazos.forEach(({ el, halo, linea, origen }, i) => {
      const t = el.getBoundingClientRect(), des = (i - (n - 1) / 2) * 18, tcx = (t.left + t.right) / 2 + des, tcy = (t.top + t.bottom) / 2;
      let x0, y0, x1, y1, d;
      if (t.right < p.left || t.left > p.right) {
        const izq = tcx < pcx;
        x0 = izq ? p.left : p.right; y0 = Math.max(p.top + 24, Math.min(p.bottom - 24, tcy + des));
        x1 = izq ? t.right + G : t.left - G; y1 = tcy;
        const k = Math.max(30, Math.abs(x1 - x0) * 0.45);
        d = 'M' + x0 + ',' + y0 + ' C' + (izq ? x0 - k : x0 + k) + ',' + y0 + ' ' + (izq ? x1 + k : x1 - k) + ',' + y1 + ' ' + x1 + ',' + y1;
      } else {
        const arriba = tcy < pcy;
        y0 = arriba ? p.top : p.bottom; x0 = Math.max(p.left + 24, Math.min(p.right - 24, tcx));
        y1 = arriba ? t.bottom + G : t.top - G; x1 = tcx;
        const k = Math.max(30, Math.abs(y1 - y0) * 0.45);
        d = 'M' + x0 + ',' + y0 + ' C' + x0 + ',' + (arriba ? y0 - k : y0 + k) + ' ' + x1 + ',' + (arriba ? y1 + k : y1 - k) + ' ' + x1 + ',' + y1;
      }
      halo.setAttribute('d', d); linea.setAttribute('d', d); origen.setAttribute('cx', x0); origen.setAttribute('cy', y0);
    });
  }
  // El panel no debe tapar el control, ni el recuadro del resultado, ni la imagen.
  function ubicar() {
    if (!abierto || movido) return;
    const p = panel.getBoundingClientRect(), W = innerWidth, H = innerHeight, M = 14;
    if (!p.width) return;
    const evita = [], DURO = 1000, BLANDO = 110;
    const suma = (el, w) => { if (el) evita.push({ r: el.getBoundingClientRect(), w }); };
    elementos(it().move).forEach(el => suma(el, DURO));
    const ancla = evita.length ? evita[0].r : null;
    elementos(it().look).forEach(el => suma(el, DURO));
    if (!enVolumina()) { suma($('cronica'), BLANDO); suma($('botones'), BLANDO); suma($('tarjeta'), BLANDO); }
    const solape = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const maxX = Math.max(M, W - p.width - M), maxY = Math.max(M, H - p.height - M);
    let mejor = null;
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 12; j++) {
      const x = M + (maxX - M) * i / 16, y = M + (maxY - M) * j / 12, r = { left: x, top: y, right: x + p.width, bottom: y + p.height };
      let s = 0; for (const a of evita) s += solape(r, a.r) * a.w;
      if (ancla) { const dx = (r.left + r.right) / 2 - (ancla.left + ancla.right) / 2, dy = (r.top + r.bottom) / 2 - (ancla.top + ancla.bottom) / 2; s += Math.sqrt(dx * dx + dy * dy) * 400; }
      if (!mejor || s < mejor.s) mejor = { s, x, y };
    }
    panel.style.left = Math.round(mejor.x) + 'px'; panel.style.top = Math.round(mejor.y) + 'px';
    lineas();
  }

  const estadoDe = p => { const f = p.falta ? p.falta() : ''; return f ? { clase: 'falta', texto: f } : (p.hecho && p.hecho()) ? { clase: 'hecho', texto: 'Hecho en la consola.' } : null; };
  function puntos() {
    $('guiaPuntos').innerHTML = PASOS.map((p, i) => '<i class="' + (i === paso ? 'aqui' : ((notas[p.id] || '').trim() ? 'listo' : '')) + '" title="' + p.id + ' · ' + p.t + '" data-paso="' + i + '"></i>').join('');
  }
  function pintarEstado() {
    const e = estadoDe(it()), el = $('guiaEstado');
    el.hidden = !e; if (e) { el.className = 'guia-estado ' + e.clase; el.textContent = e.texto; }
  }
  function pintar() {
    const p = it();
    $('guiaQuien').textContent = 'Etapa ' + p.id[0] + ' · ' + ETAPAS[p.id[0]];
    $('guiaCuenta').textContent = (paso + 1) + ' / ' + PASOS.length;
    $('guiaTitulo').textContent = p.id + '. ' + p.t;
    $('guiaPregunta').textContent = p.q;
    $('guiaMueve').innerHTML = (p.move && p.move.length ? 'La <b>línea de puntos</b> sale de este panel hasta lo que hay que mover. ' : '') + 'El <b>recuadro</b> marca dónde aparece el resultado.';
    $('guiaNota').value = notas[p.id] || '';
    $('guiaAntes').disabled = paso === 0; $('guiaDespues').disabled = paso === PASOS.length - 1;
    pintarEstado(); puntos();
    document.querySelector('.guia-cuerpo').scrollTop = 0;
  }

  // Lleva la consola, o Volumina, a la pantalla de la que habla el paso.
  function navegar() {
    const p = it();
    if (!cargado()) return;
    if (p.volumina) {
      if (terminado() && !enVolumina()) C().abrirVolumina();
      const prepara = () => {
        const w = marco().contentWindow, pu = puente();
        if (!pu || !pu.estudio()) return false;
        if (p.prepara) p.prepara({ elegir: (id, valor) => { const el = w.document.getElementById(id); if (el && el.value !== valor && Array.from(el.options).some(o => o.value === valor)) { el.value = valor; el.dispatchEvent(new w.Event('change')); } } });
        const primero = elementos(p.move)[0] || elementos(p.look)[0];
        if (primero && primero.ownerDocument !== document && primero.closest('aside')) primero.scrollIntoView({ block: 'center' });
        return true;
      };
      if (terminado() && !prepara()) { let n = 0; const t = setInterval(() => { if (prepara() || ++n > 40) { clearInterval(t); marcar(); ubicar(); } }, 150); }
    } else {
      if (enVolumina()) C().cerrarVolumina();
      if (p.ir) C().ir(p.ir);
    }
  }
  function ir(i) {
    paso = Math.max(0, Math.min(PASOS.length - 1, i)); movido = false;
    navegar(); pintar();
    requestAnimationFrame(() => { marcar(); requestAnimationFrame(ubicar); });
    setTimeout(() => { marcar(); ubicar(); }, 200);
  }
  function abrir() {
    if (abierto) { cerrar(); return; }
    abierto = true; panel.hidden = false; panel.style.left = ''; panel.style.top = '';
    $('btnTutorial').setAttribute('aria-pressed', 'true');
    ir(paso);
  }
  function cerrar() {
    abierto = false; panel.hidden = true; marcas.innerHTML = ''; limpiarObjetivos();
    $('btnTutorial').setAttribute('aria-pressed', 'false');
  }

  // ---------- informe ----------
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n1 = (v, d) => (v === undefined || v === null || Number.isNaN(v)) ? '—' : (+v).toFixed(d);
  function resumenConsola() {
    if (!cargado()) return '<p>No se cargó ningún estudio.</p>';
    const e = E(), p = e.pets[0], c = p.cab, f = [], oculto = $('ocultarId').checked;
    f.push(['Estudio', (c.estudio || '—') + ' · ' + [c.fabricante, c.modelo].filter(Boolean).join(' ')]);
    f.push(['Paciente', oculto ? 'Identidad oculta en la consola' : [c.nombre, c.id].filter(Boolean).join(' · ') || '—']);
    f.push(['Series cargadas', e.pets.map(v => v.desc).join(', ') + (e.ct ? ', ' + e.ct.desc : ' (sin CT)')]);
    f.push(['Etapa alcanzada', { rango: 'Planificación del rango', ct: 'Adquiriendo el CT', entre: 'CT adquirido, PET pendiente', adquiriendo: 'Adquiriendo el PET', pausa: 'PET suspendido', terminado: 'Examen terminado' }[e.fase] || e.fase]);
    f.push(['Rango', (e.continuo ? 'Camilla continua' : 'Camas ' + (e.b0 + 1) + ' a ' + (e.b1 + 1) + ' de ' + e.espacial.length) + ' · ' + n1(e.largo, 0) + ' mm · de ' + n1(p.zs[e.r0], 1) + ' a ' + n1(p.zs[e.r1], 1) + ' mm']);
    f.push(['PET', n1(e.dur / 60, 1) + ' min por cama · ' + n1(e.total / 60, 1) + ' min en total · ' + (c.farmaco || '—') + ' ' + n1(c.dosis / 1e6, 0) + ' MBq (' + n1(c.dosis / 3.7e7, 2) + ' mCi)']);
    f.push(['Reconstrucción', [c.metodo, c.nucleo, p.colsOrig + ' × ' + p.rowsOrig, n1(p.psOrig, 2) + ' mm'].filter(Boolean).join(' · ')]);
    if (e.ct) { const D = C().dosisCt(); f.push(['CT', n1(e.ct.cab.kv, 0) + ' kV · modulación ' + (D.activa ? 'On' : 'Off') + ' · Ref. mAs ' + n1(D.ref, 0) + ' · CTDIvol medio ' + n1(D.ctdi ? D.ctdi.med : NaN, 2) + ' mGy · DLP ' + n1(D.dlp, 0) + ' mGy·cm (estimado)']); }
    if (e.sim && e.base) {
      const n = { tCama: 'tiempo por cama', actF: 'actividad', capt: 'captación', iter: 'iteraciones', fwhm: 'filtro', ref: 'Ref. mAs', mod: 'modulación', kv: 'kV', thk: 'grosor de corte', ker: 'núcleo' };
      const l = Object.keys(n).filter(k => e.sim[k] !== e.base[k] && e.base[k] !== undefined).map(k => n[k] + ': ' + (k === 'actF' ? Math.round(e.sim[k] * 100) + ' % de la inyectada' : k === 'mod' ? (e.sim[k] ? 'On' : 'Off') : e.sim[k]) + ' (adquirido: ' + (k === 'actF' ? '100 %' : k === 'mod' ? (e.base[k] ? 'On' : 'Off') : e.base[k]) + ')');
      f.push(['Parámetros simulados', l.length ? l.join('; ') : 'Ninguno: las imágenes son las adquiridas']);
    }
    const g = puente() && puente().generados ? puente().generados() : {}, nombres = { axial: 'axiales', coronal: 'coronales', sagittal: 'sagitales' };
    f.push(['Cortes generados en Volumina', Object.keys(nombres).filter(k => g[k]).map(k => g[k].cortes + ' ' + nombres[k] + ' cada ' + g[k].distancia + ' mm, grosor ' + g[k].grosor + ' mm, ' + g[k].contenido).join('; ') || 'Ninguno']);
    return '<table>' + f.map(x => '<tr><th>' + esc(x[0]) + '</th><td>' + esc(x[1]) + '</td></tr>').join('') + '</table>';
  }
  function informe() {
    const d = new Date().toLocaleString('es');
    $('informe').innerHTML = '<h1>Consola PET · informe del tutorial</h1>' +
      '<p class="sub">Generado el ' + esc(d) + '. Herramienta docente: no apta para uso clínico ni dosimétrico.</p>' +
      '<h2 class="sec">Estado de la consola al finalizar</h2>' + resumenConsola() +
      PASOS.map((p, i) => (i === 0 || PASOS[i - 1].id[0] !== p.id[0] ? '<h2 class="sec">Etapa ' + p.id[0] + ' · ' + esc(ETAPAS[p.id[0]]) + '</h2>' : '') +
        '<section><h3>' + p.id + ' · ' + esc(p.t) + (p.hecho ? '<span class="chip">' + (p.hecho() ? 'hecho en la consola' : 'no se hizo en la consola') + '</span>' : '') + '</h3>' +
        '<p class="q">' + esc(p.q) + '</p><p class="lbl">Respuesta</p><div class="resp">' + (esc((notas[p.id] || '').trim()) || '—') + '</div></section>').join('') +
      '<p class="pie">Los valores del estado salen de la cabecera DICOM del estudio cargado o se deducen de sus datos. El Ref. mAs y el DLP son estimaciones. El efecto de los parámetros simulados se calcula sobre la imagen ya reconstruida, y los mínimos de las listas son pisos del simulador que pueden no corresponder a los de un equipo real.</p>';
  }

  // ---------- eventos ----------
  $('btnTutorial').addEventListener('click', abrir);
  $('guiaCerrar').addEventListener('click', cerrar);
  $('guiaAntes').addEventListener('click', () => ir(paso - 1));
  $('guiaDespues').addEventListener('click', () => ir(paso + 1));
  $('guiaRecolocar').addEventListener('click', () => { movido = false; navegar(); marcar(); ubicar(); });
  $('guiaPuntos').addEventListener('click', ev => { const i = ev.target.closest('[data-paso]'); if (i) ir(+i.dataset.paso); });
  $('guiaNota').addEventListener('input', ev => { notas[it().id] = ev.target.value; try { localStorage.setItem('consola-pet-tutorial', JSON.stringify(notas)); } catch (e) { } puntos(); });
  $('guiaFin').addEventListener('click', () => { informe(); window.print(); });
  $('guiaBorrar').addEventListener('click', () => { if (!window.confirm('¿Borrar todas las respuestas escritas en este tutorial?')) return; notas = {}; try { localStorage.removeItem('consola-pet-tutorial'); } catch (e) { } pintar(); });
  (() => {
    const cab = $('guiaCab'); let dx = 0, dy = 0;
    const mover = ev => { panel.style.left = Math.max(4, Math.min(innerWidth - panel.offsetWidth - 4, ev.clientX - dx)) + 'px'; panel.style.top = Math.max(4, Math.min(innerHeight - panel.offsetHeight - 4, ev.clientY - dy)) + 'px'; lineas(); };
    cab.addEventListener('pointerdown', ev => {
      if (ev.target.closest('button')) return;
      const r = panel.getBoundingClientRect(); dx = ev.clientX - r.left; dy = ev.clientY - r.top; movido = true;
      try { cab.setPointerCapture(ev.pointerId); } catch (e) { }
      const fin = () => { cab.removeEventListener('pointermove', mover); cab.removeEventListener('pointerup', fin); };
      cab.addEventListener('pointermove', mover); cab.addEventListener('pointerup', fin);
    });
  })();
  let espera = null;
  addEventListener('resize', () => { if (!abierto) return; marcar(); clearTimeout(espera); espera = setTimeout(() => { marcar(); ubicar(); }, 90); });
  addEventListener('scroll', () => { if (abierto) marcar(); }, true);
  // La pagina se mueve debajo de las marcas (la tarjeta se vuelve a dibujar, Volumina carga):
  // en vez de perseguir cada causa, se vuelve a medir mientras el tutorial esta abierto.
  setInterval(() => {
    if (!abierto) return;
    pintarEstado();
    const t = elementos(it().move).concat(elementos(it().look));
    const f = t.map(el => { const r = el.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + ',' + Math.round(r.height) + (el.classList.contains('guia-objetivo') ? 'o' : ''); }).join('|') + '|' + panel.offsetWidth + ',' + panel.offsetHeight + '|' + enVolumina();
    if (f !== firma) { firma = f; marcar(); ubicar(); const g = elementos(it().move).concat(elementos(it().look)); firma = g.map(el => { const r = el.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + ',' + Math.round(r.height) + (el.classList.contains('guia-objetivo') ? 'o' : ''); }).join('|') + '|' + panel.offsetWidth + ',' + panel.offsetHeight + '|' + enVolumina(); }
  }, 350);

  window.TutorialPet = { abrir, cerrar, ir, pasos: PASOS, notas: () => notas, paso: () => paso, abierto: () => abierto, informe, estadoDe };
})();
