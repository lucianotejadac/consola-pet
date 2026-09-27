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
