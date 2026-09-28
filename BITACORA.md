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

## 2026-09-28 · Cuarta ronda: parámetros que cambian la calidad de imagen

Participantes: Luciano Tejada (docente) y Claude (Claude Code).

**Contexto.** El docente pidió simular otros parámetros que afectan la calidad de imagen del CT y del PET, tomando como tope lo que ya está (por ejemplo, 2 minutos por cama como máximo y de ahí hacia abajo), como en la consola TC. Respuestas a la ronda de confirmación: nada que suba por sobre lo adquirido; todos los cambios son posteriores a la adquisición; sí a comparar con el original; sí a simular el efecto del CT sobre el PET corregido; pisos razonables, pero dicho explícitamente que son simulados y pueden no corresponder a la realidad.

**Decisiones.**
- **Regla, la misma de la consola TC: la adquisición real es el techo de calidad.** Cada control ofrece el valor del estudio y valores que degradan; una prueba automática comprueba que ninguna opción queda del lado que mejora. Los topes se leen de la cabecera de cada estudio.
- **Parámetros vivos.** PET: tiempo por cama, actividad, tiempo de captación (solo más largo), iteraciones, filtro (solo más ancho). CT: mAs de referencia, modulación de dosis, kV (solo menor), grosor de corte (solo mayor), núcleo (solo más suave). Se distinguen en azul; los ilustrativos quedan en gris. El pitch queda ilustrativo.
- **Cuándo se cambian.** Los del CT desde que termina el CT; los del PET desde que termina el examen. Antes, el control avisa que primero se adquiere con los valores del protocolo. La reproducción de la adquisición siempre usa los valores reales.
- **Modelo del PET**: fracción de cuentas = (tiempo ÷ tiempo adquirido) × (actividad ÷ actividad inyectada) × decaimiento por la captación adicional. El ruido agregado es sigma × raíz(1/f − 1), con sigma = A × valor^p propio de cada serie. Menos iteraciones se imitan con suavizado y pérdida de contraste, y más filtro con un suavizado gaussiano de la diferencia en cuadratura. Es el esquema de la consola TC.
- **El ruido de partida se mide en la imagen cargada**, porque con otros estudios no hay constantes calibradas. En el PET se mide en la diferencia entre cortes vecinos, que cancela la anatomía; en el caso de prueba da 10 % a nivel de tejido. Un primer intento con la desviación dentro de cada corte daba 22 %, contaminado por la anatomía, y se descartó. En el CT se mide en bloques uniformes de tejido blando: 9,7 HU sobre la imagen reducida. Si la imagen no permite medirlo se usa un valor típico y la tarjeta lo dice.
- **Modelo del CT**: el ruido agregado es sigma × raíz(R − 1), con R la razón entre la dosis adquirida y la simulada en ese corte. Apagar la modulación deja la corriente fija en el máximo: la dosis sube y la imagen no mejora. El kV cambia dosis y contraste con la tabla aproximada de la consola TC, más una fila extrapolada para 70 kV. CTDIvol y DLP se recalculan.
- **Efecto del CT sobre el PET corregido**: se calcula el ruido que llega al mapa de atenuación después de suavizarlo a la resolución del PET y se propaga a lo largo de 30 cm de paciente. Da décimas de punto porcentual (± 0,18 % con un cuarto del mAs), así que casi no se ve. Se muestra el número en la pestaña Recon y se explica en «Qué es real y qué no». Descartado: exagerar el efecto para que se note.
- **El ruido es estable**: usa una semilla por corte, así que no cambia al redibujar ni al mover el corte y volver.
- **Ventana derecha, botón Original**: la misma vista de la ventana central tal como se adquirió.
- **Pisos**: 0,5 min por cama, 1 mCi y 20 mAs. La lista, el pie de cada tarjeta y el diálogo dicen que son pisos del simulador.
- **Restaurar lo adquirido** devuelve todo al original; New también.

**Validación.** 60, 58 y 37 comprobaciones correctas según la forma de carga. Con MSB-00556: ninguna opción mejora lo adquirido; a 1 min por cama quedan 50 % de las cuentas y a 0,5 min el ruido agregado crece × 1,70 (teórico 1,73); la actividad total del corte cambia menos de 0,5 %; con Ref. mAs 31 el ruido agregado al CT es 16,9 HU (teórico 16,9) y el DLP baja de 248 a 62 mGy·cm; sin modulación el DLP sube a 319 y la imagen queda idéntica; la serie sin corregir no cambia cuando se degrada el CT.

**Pendiente.**
- El factor 1,5 con que se corrige el ruido medido del PET es una estimación; no está contrastado con un maniquí.
- La simulación es plano a plano: no correlaciona el ruido entre cortes ni degrada la resolución en el eje Z.
- Probar con estudios de otros equipos.

## 2026-09-28 · Quinta ronda: paso a Volumina

Participantes: Luciano Tejada (docente) y Claude (Claude Code).

**Contexto.** El docente pidió un botón «Pasar a Volumina» e integrar en este simulador el visor Volumina, basado en el que se usó para paratiroides, sin las opciones de cargar estudio porque ya está cargado, y adaptado para PET.

**Decisiones.**
- **Volumina va dentro de este repositorio**, en `volumina/`, como copia adaptada de `visor_dicom` en su estado del tutorial de paratiroides. Se abre sobre la consola en un marco del mismo origen y la consola le entrega los volúmenes desde la memoria. Descartado: enlazar al visor publicado, que obligaría a cargar los archivos otra vez y no conocería el rango elegido.
- **La copia se arma con un guion** (`armar_volumina.py`, fuera del repositorio) que copia los archivos y aplica las adaptaciones, para poder repetirlo si Volumina cambia. El motor (`core.js`), el reformateo y la escritura DICOM quedan idénticos.
- **Sin carga**: se quitan Abrir CT, Abrir SPECT, la demo, el arrastrar y soltar y el tutorial de paratiroides. En su lugar hay un botón para volver a la consola.
- **Qué recibe**: el rango adquirido, con el CT y todas las series PET, tal como están en la consola. Si hay parámetros simulados llegan esas imágenes y el visor lo avisa. El CT llega reducido a 256 de lado, que es como lo guarda la consola.
- **Adaptaciones para PET**: textos en PET; la escala parte del nivel de la consola y no del máximo del volumen, que suele ser la vejiga; umbrales de medio punto porcentual; paleta en gris invertido con fondo blanco y MIP en vista anterior por omisión; selector de serie PET para pasar de la corregida a la sin corregir; el PET también se puede ver solo como volumen base; SUV si la cabecera trae peso y actividad, y si no, el visor dice por qué no lo muestra.
- **Se habilita con el examen terminado.** En un examen nuevo vuelve a quedar bloqueado.
- **Identidad**: si la consola tiene la identidad oculta, Volumina recibe el estudio sin nombre ni identificador.

**Validación.** 76, 73 y 47 comprobaciones correctas según la forma de carga, con WebGL2 activo. Se comprueba que no queda ningún control de carga visible; que CT y PET llegan con los cortes del rango; que un mismo vóxel vale lo mismo en la consola y en el visor (5694,9 Bq/ml y 48 HU); que la fusión queda activa y alineada; que se puede cambiar a la serie sin corregir y ver el PET solo; que los tres planos tienen imagen; y que con parámetros simulados el visor recibe esas imágenes y lo avisa.

**Pendiente.** Pasar el CT a resolución completa exigiría conservar 100 MB más en memoria.

## 2026-09-28 · Sexta ronda: tutorial y preguntas de todo el proceso

Participantes: Luciano Tejada (docente) y Claude (Claude Code).

**Contexto.** El docente pidió, basándose en la interfaz del tutorial de la consola TC, un tutorial con preguntas para todo el proceso: desde la adquisición hasta Volumina y la generación de cortes axiales, coronales y sagitales.

**Decisiones.**
- **Misma interfaz de la consola TC**: panel flotante que se arrastra, una pregunta a la vez, línea de puntos animada desde el panel hasta lo que hay que mover, recuadro «resultado» donde aparece la respuesta, cuadro de texto, puntos de avance, botón Recolocar y «Finalizar y generar PDF». El panel se ubica solo donde no tapa ni el control ni el resultado.
- **Una sola secuencia de 19 pasos en cinco etapas**, en vez de tres grupos independientes como en la consola TC, porque aquí el proceso es lineal: planificación (3), CT (3), PET (2), calidad de imagen (5), Volumina y cortes (6).
- **Cada paso lleva la pantalla a su lugar**: elige el paso del protocolo, la pestaña, el modo de la ventana central y la vista de la derecha; los de la etapa 5 abren Volumina y dejan puestos la ventana de trabajo y el plano de salida. Los pasos de la consola cierran Volumina.
- **El tutorial alcanza a Volumina desde afuera.** El panel y las marcas viven en la página de la consola, por encima del marco del visor, y miden los elementos de adentro; así el mismo panel sirve para las dos partes y las respuestas quedan en un solo lugar.
- **No adquiere por el estudiante ni corrige respuestas.** Indica qué falta para poder hacer el paso (por ejemplo, terminar el PET) y marca «Hecho en la consola» cuando el estado lo confirma: rango movido, CT adquirido, PET terminado, parámetro cambiado, cortes generados en cada plano. Esto toma lo que tenía el tutorial cardíaco y le faltaba al de la consola TC.
- **Preguntas genéricas**, sin cifras del caso de prueba, porque se cargarán otros estudios. Si el estudio no trae CT o serie sin corregir, el paso lo dice.
- **Cortes axiales**: en Volumina el plano de salida es perpendicular a la ventana de trabajo, así que el paso de cortes axiales usa la ventana coronal y lo explica.
- **Informe**: estado de la consola al finalizar (estudio, rango, PET, reconstrucción, CT con su dosis, parámetros simulados vigentes y cortes generados), y luego cada paso con su pregunta, si se hizo en la consola y la respuesta. Respeta la identidad oculta. Se imprime con el diálogo del navegador, que permite guardar como PDF.
- **Consignas en «ustedes»**, como en la consola TC.
- **Respuestas guardadas en el navegador** (almacenamiento local), con un botón para borrarlas.

**Validación.** Prueba sin interfaz que recorre los 19 pasos con el estudio MSB-00556 haciendo lo que pide cada uno: 52 comprobaciones correctas a 1500 × 1000 y a 1366 × 768. En cada paso se comprueba que todos los objetivos existen y están visibles, que hay una línea por control y un recuadro por resultado, y que el panel queda dentro de la ventana sin tapar objetivos. Se comprueba además que los pasos quedan «hechos» cuando corresponde, que las respuestas se guardan, que el informe trae los 19 pasos y el estado, y que el texto escrito no se interpreta como HTML. Las pruebas de la consola se repitieron: 76, 73 y 47 correctas.

**Defecto encontrado de paso.** Con el PET solo como volumen base, Volumina recortaba el ancho de ventana a 4000, pensado para HU, y la imagen salía casi en blanco y negro. Ahora usa el tope del control.

**Pendiente.**
- El diálogo de impresión no se puede probar sin interfaz: el contenido del informe está comprobado, su aspecto impreso no.
- Las preguntas no citan páginas de la clase, como sí hace la consola TC; falta saber contra qué material se citarían.
- No hay pauta de respuestas.

## 2026-09-28 · Séptima ronda: cinco casos, tutorial personal y CT completo

Participantes: Luciano Tejada (docente) y Claude (Claude Code).

**Contexto.** El docente indicó que el tutorial es personal y sin corregir, que el CT no se reduzca, y pidió cuatro casos más, con preguntas que varíen según las particularidades de cada caso, empaquetados en un ZIP por estudiante como en las entregas anteriores. En la ronda de confirmación respondió: variedad de equipos y patologías solo si se puede; confía en la elección de casos; renombrar la identidad; dejar la marca de paso hecho; CT como en Volumina original, con aviso sobre la memoria.

**Decisiones.**
- **Casos**, todos públicos de TCIA y de equipos distintos: 1) tórax, abdomen y pelvis con tiempo de vuelo, sin peso en la cabecera; 2) cuerpo entero en un equipo de otro fabricante, de caudal a craneal, sin iteraciones ni CTDIvol en la cabecera; 3) paciente con los pies primero, PET en cuentas con factor de SUV propio y CT sin modulación; 4) equipo antiguo con OSEM 2i8s, cabecera sin radiofármaco y marcos de referencia distintos entre CT y PET; 5) extremidades inferiores en melanoma, con camas de 30 segundos. Se descartó un equipo más nuevo de la lista porque su CT, de 551 cortes, supera el tope de 128 millones de vóxeles.
- **No se inventa clínica.** El antecedente de cada caso es el diagnóstico de la colección y lo que trae la cabecera. No hay informes ni hallazgos.
- **Preguntas por caso**: cada pregunta conserva su forma general y nueve de los diecinueve pasos agregan una frase propia del caso (radiofármaco, rango, modulación, dosis del CT, adquisición del PET, reconstrucción, serie sin corregir, registro y escala). La ficha del caso aparece en el primer paso.
- **El caso se reconoce por el identificador de paciente** de la entrega (PET-01 a PET-05). Los estudiantes no aparecen en el simulador.
- **Tutorial personal**: consignas en «tú», respuestas guardadas por caso, informe con una línea para el nombre. No corrige ni trae pauta.
- **CT a resolución original.** Solo se reduce a la mitad si supera los 128 millones de vóxeles, que es el tope de Volumina. La tarjeta del CT, el diálogo «Qué es real y qué no» y el aviso de Volumina dicen cuánta memoria ocupa y qué hacer si el computador no da.
- **Entrega**: `PET <Nombre>.zip` con `Caso n/PET AC`, `PET NAC` y `CT`, y un LEEME con las instrucciones de carga y la cita de las colecciones. Paciente renombrado a «PET CASO n», identificadores regenerados, sin etiquetas del ensayo ni de la colección; se conserva el factor de SUV del fabricante. Las imágenes no se modifican.

**Lo que hubo que generalizar en el simulador.**
- **Camas por tiempo de referencia del cuadro**, cuando el equipo escribe la misma hora de adquisición en todos los cortes.
- **Una cama es un tramo de al menos 5 cortes con la misma hora**; con 3, una pendiente suave producía una cama falsa en el caso 5.
- **SUV** por peso y actividad, o con el factor que guarda el equipo cuando la imagen viene en cuentas.
- **Serie sin corregir**: un equipo marca la corrección de atenuación también en la serie sin corregir, así que la descripción de la serie manda sobre la lista de correcciones.
- **Escala de Volumina**: si el máximo del volumen es muchas veces el nivel de trabajo, el 100 % se limita a 8 veces ese nivel, y el visor lo avisa.
- **Marcos de referencia distintos** (caso 4): Volumina no fusiona solo y pide habilitar el ajuste exploratorio. Se dejó así y la pregunta del paso lo explica.

**Validación.** Verificación de la entrega sobre 3.744 DICOM: ninguno conserva identificadores ni nombres de colección, todos sin comprimir, un caso por ZIP. Cada ZIP se cargó entero en la consola y se recorrió hasta Volumina: 14, 14, 14, 14 y 13 comprobaciones correctas, sin fallas. Pruebas anteriores repetidas: consola 76 y 47, tutorial 52, sin fallas. Memoria usada por la página con el CT completo: entre 520 y 1.000 MB según el caso.

**Error propio que conviene recordar.** Una expresión regular escrita desde un guion de Python perdió sus barras y quedó con caracteres de retroceso invisibles; la sintaxis era válida y la prueba del caso 3 fue la que lo mostró. Ahora el guion comprueba que no queden esos caracteres.

**Pendiente.**
- Las preguntas por caso las redactó Claude a partir de las cabeceras: falta la revisión docente.
- El caso 5 no tiene cuerpo entero, solo extremidades.
- En un computador con poca memoria los casos 2 y 5 pueden no abrir en Volumina con el rango completo.
