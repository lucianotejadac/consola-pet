# Consola PET

Simulador docente que presenta un PET/CT ya reconstruido como si se acabara de adquirir en la consola del equipo. Se abre en https://lucianotejadac.github.io/consola-pet/ desde un computador.

## Qué hace

1. **Load** carga el estudio: la carpeta con las series, los DICOM sueltos o los ZIP tal como se descargan. Basta la serie PET; con el CT se agregan el topograma, la etapa del CT y la fusión.
2. La consola parte solo con el **topograma**. El estudiante define el rango arrastrando sus bordes: cada borde salta de cama en cama, así que el rango nunca queda a la mitad de una.
3. **Start** adquiere el CT sobre ese rango, con la duración que resulta de su largo y la velocidad de mesa. Al terminar, la consola queda en pausa con el CT a la vista.
4. **Start** de nuevo adquiere el PET: las camas elegidas se recorren en el orden y con los tiempos de la cabecera, y los cortes aparecen a medida que termina la última cama que los cubre. **Suspend** lo detiene y **Skip** salta la etapa en curso.
5. La ventana derecha muestra el MIP corregido, el MIP sin corregir o el corte axial sin corregir, en el mismo corte que la ventana central, para comparar con y sin corrección de atenuación. Necesita que se haya cargado la serie PET sin corregir.
6. Las pestañas **Routine**, **Scan**, **Recon** y **Auto Tasking** muestran los parámetros como controles de consola.
7. Después de adquirir, los parámetros **en azul** se pueden cambiar y la imagen muestra el efecto, simulado: tiempo por cama, actividad, tiempo de captación, iteraciones y filtro en el PET; mAs de referencia, modulación de dosis, kV, grosor de corte y núcleo en el CT. Lo adquirido es el techo de calidad: los controles solo ofrecen ese valor o valores que degradan la imagen. El botón **Original** de la ventana derecha muestra la misma vista tal como se adquirió.
8. Las listas en gris son ilustrativas: se abren y dejan ver otras opciones, pero no cambian nada.
9. **Pasar a Volumina** abre el visor con el CT y el PET adquiridos, sin volver a cargar archivos: cortes en los tres planos, fusión, MIP y VRT, y generación de cortes.
10. **New** vuelve al topograma para planificar otro rango.
11. **Tutorial** abre un panel flotante con 19 pasos en cinco etapas (planificación, CT, PET, calidad de imagen, Volumina y cortes), con una pregunta en cada uno. Es un trabajo personal y no se corrige: no hay pauta ni puntaje, solo una marca cuando el paso se hizo en la consola. Una línea de puntos señala lo que hay que mover y un recuadro, dónde aparece el resultado. Las respuestas se guardan en el navegador, separadas por caso, y «Finalizar y generar PDF» arma el informe.
12. **Casos.** La consola reconoce los cinco casos de la entrega del curso (pacientes PET-01 a PET-05) y adapta nueve de las preguntas a lo que cada estudio tiene de particular. Con cualquier otro estudio, las preguntas quedan en su forma general.

La simulación usa modelos sencillos sobre la imagen ya reconstruida y sirve para ver la dirección y el orden de magnitud de cada cambio, no para predecir lo que entregaría el equipo. Los valores mínimos de las listas son pisos del simulador y pueden no corresponder a los de un equipo real.

El botón «Qué es real y qué no» separa lo que sale de la cabecera DICOM, lo que se deduce de los datos y lo que es ilustrativo.

## Datos

Los archivos se leen en el navegador y no salen del equipo. Este repositorio no contiene imágenes ni datos de pacientes. Lee DICOM sin comprimir de PET y CT axiales.

Los casos son públicos, de The Cancer Imaging Archive, con licencias Creative Commons Attribution: colecciones CMB-LCA (doi 10.7937/3cx3-s132), CMB-MEL (doi 10.7937/GWSP-WH72) y ACRIN-NSCLC-FDG-PET (doi 10.7937/tcia.2019.30ilqfcl). Son de cuatro equipos distintos.

En los casos del curso, al CT se le recortó el aire de arriba y de abajo para que ocupe menos memoria: conserva su tamaño de píxel, toda la anatomía y la camilla, pero su matriz ya no es la de 512 × 512 con que se adquirió. La consola y el visor lo avisan. El PET no se modificó.

El CT se usa a su resolución original, como en Volumina. Un CT de cuerpo entero ocupa entre 100 y 200 MB de memoria en la consola y el doble al pasar al visor.

## Archivos

- `index.html`, `consola.css`, `consola.js`: la página completa, sin compilación.
- `tutorial.js`, `tutorial.css`: el tutorial guiado y su informe.
- `casos.js`: ficha de cada caso y la frase que adapta cada pregunta. No nombra estudiantes ni identifica a los pacientes.
- `vendor/dicomParser.min.js`: dicom-parser 1.8.12, licencia MIT.
- `volumina/`: copia adaptada del visor Volumina (repositorio `visor_dicom`), sin opciones de carga y con textos y escalas para PET. `consola-puente.js` recibe el estudio desde la consola.
- `BITACORA.md`: decisiones de cada ronda de trabajo.

Uso docente. No es una consola real ni un visor validado para diagnóstico, y no está afiliado a ningún fabricante.

## Licencia

© 2026 Luciano Tejada Castro. Distribuido bajo licencia [MIT](LICENSE).
Los componentes y datos de terceros conservan sus propias licencias, indicadas en este documento o junto a ellos.
