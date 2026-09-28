# Bitácora de decisiones · Consola PET

Registro al estilo ADR: contexto, decisión, alternativas descartadas y validación de cada ronda.

## 2026-09-27 · Primera versión: el examen recién adquirido

Participantes: Luciano Tejada (docente) y Claude (Claude Code).

**Contexto.** El docente pidió un simulador que tome prestada la idea del simulador de cintigrafía ósea (el estudiante carga su propio DICOM) pero que se vea como una consola de adquisición PET/CT: al cargar el PET corregido, el examen aparece como recién adquirido y los detalles de la reconstrucción se muestran como opciones seleccionables que ya no se pueden cambiar. Referencias visuales: una foto de una consola en sala y el video de la Clase 5 del curso de PET-CT, que recorre el protocolo PETCT_FDG con sus pasos (Topogram, CT WB, Pause, PET) y sus pestañas (Routine, Scan, Recon, Auto Tasking). Respuestas del docente a la ronda de confirmación: con CT; con reproducción de la adquisición; listas con alternativas; que acepte cualquier PET; sin tutorial.

**Decisiones.**
- **Repositorio propio** (`consola-pet`), página estática sin compilación. No contiene imágenes ni datos de pacientes; los enlaces locales a los datos de prueba y las páginas de prueba quedan fuera por `.gitignore`.
- **Apariencia inspirada en la consola, sin marcas ni logos de fabricante.** Rótulos de los controles en inglés, como en el equipo que los estudiantes van a encontrar; mensajes y ayudas del simulador en español.
- **Las camas se deducen de la hora de adquisición de cada corte.** En el equipo de prueba cada corte trae la hora media de las camas que lo cubren: los tramos de tres o más cortes con la misma hora son el centro de una cama, y los cortes con horas intermedias son el traslape. De ahí salen el número de camas, su orden, su posición y el tiempo entre camas. Un corte se muestra cuando termina la última cama que lo cubre. Si no hay tramos (camilla en movimiento continuo) la reproducción barre el rango de forma continua. Descartado: inventar un número de camas a partir del largo del rango.
- **El topograma es una proyección anteroposterior del CT**, porque el estudio no trae esa serie; la página lo dice en el rótulo y en el paso Topogram. Sin CT se usa una proyección del PET.
- **Listas con alternativas ilustrativas.** Cada lista se abre, muestra el valor real marcado y otras opciones. Elegir otra no cambia nada y la barra de estado explica por qué. La única que sí responde es la unidad de la actividad (mCi o MBq), porque es el mismo dato. El diálogo «Qué es real y qué no» separa cabecera, deducido e ilustrativo.
- **La curva de la pestaña Scan no es la tasa de cuentas del equipo**, que no viene en el DICOM. Es la actividad de la imagen dentro de cada cama, llevada a la hora de esa cama con el decaimiento, en escala relativa. No se dibujan aleatorios.
- **No se muestra un campo «Zoom»**: la cabecera no lo trae. Se muestran la matriz, el píxel y el campo de visión, que sí se pueden leer o calcular.
- **Corriente, mAs y CTDIvol del CT se informan como media de los cortes**, porque con modulación de dosis cambian de un corte a otro.
- **El nivel inicial del PET** es la mediana de la ventana que trae cada corte; la del primer corte (cerebro) dejaba el cuerpo demasiado claro.
- **Identidad oculta por omisión**, con una casilla para mostrarla, pensando en capturas de pantalla con estudios que no estén anonimizados.
- **El CT se guarda reducido** (256 de lado) para no cargar 100 MB en memoria; la tarjeta informa los valores originales.

**Validación.** Prueba sin interfaz con el estudio MSB-00556 (CMB-LCA, TCIA) en tres formas de carga: carpetas con PET AC, PET NAC y CT (597 archivos, 0,4 s), los dos ZIP de TCIA (0,8 s) y solo el PET. En las tres: 8 camas de 120 s, inicio cada 127,5 s, sentido craneocaudal, 1013 s en total; antes de Start no hay cortes revelados; a mitad de la reproducción hay cortes revelados y otros no; Suspend detiene el reloj; Skip termina; la pestaña Recon muestra OSEM3D+TOF, 4 iteraciones, 10 subconjuntos, Gaussian 5,0 mm, matriz 180; elegir 2 iteraciones no cambia el valor; el segundo trabajo muestra el PET sin corregir; la fusión y el MIP girado se pintan; sin desborde horizontal a 1500 × 1000 y a 1366 × 768; sin errores de script.

**Pendiente.**
- Probar con PET de otros fabricantes, donde el método de reconstrucción no sigue el formato «4i10s» y la hora por corte puede venir de otra manera.
- No lee DICOM comprimido.
- El campo axial por cama es una estimación por lo bajo (160 mm para un equipo de 164 mm).
- Tutorial y preguntas: el docente pidió partir sin ellos.

## 2026-09-27 · Segunda ronda: topograma, rango por camas, CT y después PET

Participantes: Luciano Tejada (docente) y Claude (Claude Code).

**Contexto.** La primera versión mostraba todo el estudio planificado y solo reproducía el PET. El docente pidió que el simulador parta solo con el topograma, que el estudiante establezca el rango de adquisición respetando las camas (el rango no puede quedar a la mitad de una), que se adquiera el CT y después se pase al PET, y que la ventana derecha permita ver la serie sin corrección de atenuación para comparar.

**Decisiones.**
- **Etapas**: rango → CT → pausa → PET → terminado. Start inicia la etapa siguiente; en la pausa la consola espera con el CT a la vista, como en el protocolo real (Topogram, CT, Pause, PET). Skip salta la etapa en curso. Al terminar, el botón pasa a New y vuelve al topograma.
- **El rango se arrastra sobre el topograma y salta de cama en cama.** El borde superior solo puede caer en el inicio de una cama y el inferior en el final de una; arrastrar el centro desplaza el rango completo de a una cama. Las camas que quedan fuera se dibujan punteadas. El largo, el número de camas y la duración del PET se actualizan al soltar.
- **Las camas disponibles son las del estudio.** Las imágenes ya existen, así que el rango puede abarcar cualquier tramo contiguo de esas camas, pero no inventar otras ni moverlas. Los cortes del traslape entre una cama elegida y una vecina que quedó fuera se muestran igual, aunque en el original mezclan cuentas de las dos.
- **Rango inicial: la mitad superior de las camas** (4 de 8 en el caso de prueba), para que el estudiante tenga que decidir. Descartado: partir con el rango completo, porque no habría nada que planificar.
- **El CT se reproduce con su duración real**: largo del rango dividido por la velocidad de mesa de la cabecera (48 mm/s en el caso de prueba), en el sentido en que se adquirió (caudocraneal, según la hora de cada corte). Como dura segundos, salvo en tiempo real se muestra en al menos 4 s. Si la cabecera no trae velocidad de mesa se usan 10 s y la tarjeta lo dice.
- **Ventana derecha con tres vistas**: MIP corregido, MIP sin corregir y axial sin corregir. El axial sin corregir sigue el corte de la ventana central. Cada serie usa su propio nivel, porque el PET sin corregir viene en otras unidades.
- **Antes de Start no se muestra ningún corte** de CT ni de PET, y los modos y el selector de corte quedan bloqueados.
- **Con camilla en movimiento continuo** no hay camas: el rango se fija por cortes.

**Validación.** Prueba sin interfaz con MSB-00556 en tres formas de carga (carpetas con AC, NAC y CT: 32 comprobaciones; dos ZIP: 30; solo PET: 24), todas correctas, a 1366 × 768. Se comprueba que al arrastrar el borde inferior pixel por pixel el rango siempre coincide con el final de una cama; que soltar a la mitad de la cama 6 deja el borde al final de la 5; que el borde superior no cruza al inferior; que durante el CT hay cortes de CT y ninguno de PET; que el CT y el PET no muestran nada fuera del rango; que el MIP sin corregir difiere del corregido y que el axial sin corregir cambia junto con el central.

**Pendiente.**
- La hora de inyección y el tiempo de captación son los del estudio original: no se recalculan si el rango parte en otra cama.
- Probar el arrastre en pantalla táctil.

## 2026-09-28 · Tercera ronda: modulación de dosis del CT

Participantes: Luciano Tejada (docente) y Claude (Claude Code).

**Contexto.** El docente preguntó si el estudio traía información de la modulación de dosis. La cabecera del CT trae el tipo de modulación, el ahorro de dosis estimado y la corriente, el mAs y el CTDIvol de cada corte, pero no el mAs de referencia ni el nivel de intensidad elegidos en la consola, que iban en etiquetas privadas eliminadas al anonimizar. Pidió estimar lo que falta y agregarlo, recordando que se cargarán otros estudios PET.

**Decisiones.**
- **Bloque «Dosis» en la pestaña Routine del CT**: modulación On u Off, tipo, Ref. mAs, mAs efectivo, corriente, kV, CTDIvol, DLP y ahorro de dosis. Los valores medios y los rangos se calculan sobre el rango elegido y cambian al moverlo.
- **Ref. mAs estimado**, porque no viene en el DICOM: mAs medio de la serie dividido por uno menos el ahorro de dosis de la cabecera, que equivale al mAs que se habría usado sin modulación (125 en el caso de prueba). Si no viene el ahorro, el mAs máximo de los cortes. Si no hay modulación, el mAs usado. El campo dice al lado cómo se obtuvo.
- **DLP estimado** como CTDIvol medio del rango por su largo; la cabecera no lo trae.
- **Sirve para otros fabricantes.** Si la cabecera trae el tipo de modulación se usa; si no, la modulación se deduce cuando la corriente cambia más de un 10 % de la media entre cortes. Si falta el mAs por corte se calcula con corriente, tiempo de rotación y pitch. Si no hay datos de corriente, los campos quedan en raya.
- **Nombre genérico en el control** («Dose modulation») y, al lado, el nombre comercial que le da el fabricante del estudio cargado, solo como referencia para el estudiante.
- **Curva de mA** al costado del topograma y en la pestaña Scan del CT: tenue lo planificado y firme lo ya adquirido, con el Ref. mAs como línea de referencia.
- Descartado: mostrar un nivel de intensidad de la modulación, porque no hay forma de estimarlo desde la imagen.

**Validación.** Con MSB-00556: modulación On, tipo XYZ_EC, ahorro 48,6 %, Ref. mAs 125; en un rango de 500 mm, mAs efectivo 70 (54 a 90), 176 mA, CTDIvol 4,95 mGy y DLP 248 mGy·cm; en el rango completo, DLP 359 mGy·cm. Casos simulados sobre el mismo estudio: sin etiquetas de modulación ni de ahorro (se deduce On, Ref. mAs 90), con corriente constante (Off) y sin datos de corriente (campos en raya, sin errores). 40, 38 y 24 comprobaciones correctas según la forma de carga.

**Pendiente.** Las pruebas de otros fabricantes son simuladas: falta cargar un CT real de otro equipo.
