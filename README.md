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
11. **Tutorial** abre un panel flotante con 19 pasos en cinco etapas (planificación, CT, PET, calidad de imagen, Volumina y cortes), con una pregunta en cada uno. Una línea de puntos señala lo que hay que mover y un recuadro, dónde aparece el resultado. Las respuestas se guardan en el navegador y «Finalizar y generar PDF» arma el informe.

La simulación usa modelos sencillos sobre la imagen ya reconstruida y sirve para ver la dirección y el orden de magnitud de cada cambio, no para predecir lo que entregaría el equipo. Los valores mínimos de las listas son pisos del simulador y pueden no corresponder a los de un equipo real.

El botón «Qué es real y qué no» separa lo que sale de la cabecera DICOM, lo que se deduce de los datos y lo que es ilustrativo.

## Datos

Los archivos se leen en el navegador y no salen del equipo. Este repositorio no contiene imágenes ni datos de pacientes. Lee DICOM sin comprimir de PET y CT axiales.

El caso de prueba es público: paciente MSB-00556 de la colección CMB-LCA de The Cancer Imaging Archive, PET/CT con FDG en un Biograph Horizon.

## Archivos

- `index.html`, `consola.css`, `consola.js`: la página completa, sin compilación.
- `tutorial.js`, `tutorial.css`: el tutorial guiado y su informe.
- `vendor/dicomParser.min.js`: dicom-parser 1.8.12, licencia MIT.
- `volumina/`: copia adaptada del visor Volumina (repositorio `visor_dicom`), sin opciones de carga y con textos y escalas para PET. `consola-puente.js` recibe el estudio desde la consola.
- `BITACORA.md`: decisiones de cada ronda de trabajo.

Uso docente. No es una consola real ni un visor validado para diagnóstico, y no está afiliado a ningún fabricante.
