# Consola PET

Simulador docente que presenta un PET/CT ya reconstruido como si se acabara de adquirir en la consola del equipo. Se abre en https://lucianotejadac.github.io/consola-pet/ desde un computador.

## Qué hace

1. **Load** carga el estudio: la carpeta con las series, los DICOM sueltos o los ZIP tal como se descargan. Basta la serie PET; con el CT se agregan el topograma, la etapa del CT y la fusión.
2. La consola parte solo con el **topograma**. El estudiante define el rango arrastrando sus bordes: cada borde salta de cama en cama, así que el rango nunca queda a la mitad de una.
3. **Start** adquiere el CT sobre ese rango, con la duración que resulta de su largo y la velocidad de mesa. Al terminar, la consola queda en pausa con el CT a la vista.
4. **Start** de nuevo adquiere el PET: las camas elegidas se recorren en el orden y con los tiempos de la cabecera, y los cortes aparecen a medida que termina la última cama que los cubre. **Suspend** lo detiene y **Skip** salta la etapa en curso.
5. La ventana derecha muestra el MIP corregido, el MIP sin corregir o el corte axial sin corregir, en el mismo corte que la ventana central, para comparar con y sin corrección de atenuación. Necesita que se haya cargado la serie PET sin corregir.
6. Las pestañas **Routine**, **Scan**, **Recon** y **Auto Tasking** muestran los parámetros como controles de consola. Las listas se abren y dejan ver otras opciones, pero el valor no cambia: el estudio ya está reconstruido.
7. **New** vuelve al topograma para planificar otro rango.

El botón «Qué es real y qué no» separa lo que sale de la cabecera DICOM, lo que se deduce de los datos y lo que es ilustrativo.

## Datos

Los archivos se leen en el navegador y no salen del equipo. Este repositorio no contiene imágenes ni datos de pacientes. Lee DICOM sin comprimir de PET y CT axiales.

El caso de prueba es público: paciente MSB-00556 de la colección CMB-LCA de The Cancer Imaging Archive, PET/CT con FDG en un Biograph Horizon.

## Archivos

- `index.html`, `consola.css`, `consola.js`: la página completa, sin compilación.
- `vendor/dicomParser.min.js`: dicom-parser 1.8.12, licencia MIT.
- `BITACORA.md`: decisiones de cada ronda de trabajo.

Uso docente. No es una consola real ni un visor validado para diagnóstico, y no está afiliado a ningún fabricante.
