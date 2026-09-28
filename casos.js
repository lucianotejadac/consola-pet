/* Casos del tutorial. El simulador reconoce el caso por el identificador de paciente que trae
   la entrega (PET-01 a PET-05). Cada caso aporta un antecedente, sus particularidades tecnicas
   y una frase por paso que adapta la pregunta a lo que ese estudio tiene de distinto.
   Todos los datos salen de la cabecera DICOM o de la descripcion publica de la coleccion de
   origen; no hay informes ni hallazgos. No se nombran estudiantes. */
window.PET_CASOS = {
  1: {
    titulo: 'Caso 1 · Tórax, abdomen y pelvis en un equipo con tiempo de vuelo',
    antecedente: 'Hombre de 60 años con adenocarcinoma de pulmón derecho. PET/CT con FDG.',
    particularidades: ['La cabecera no trae el peso del paciente.', 'Ocho camas de 2 minutos con traslape, en sentido craneocaudal.', 'CT de 110 kV con modulación de dosis.'],
    extra: {
      '1.2': 'En tu caso la cabecera no trae el peso del paciente: explica qué cálculo queda imposible sin ese dato y por qué hay que registrarlo antes de inyectar.',
      '1.3': 'Tu estudio es de tórax, abdomen y pelvis en un paciente con cáncer de pulmón: decide si el rango completo disponible basta para esa indicación o si falta anatomía.',
      '2.2': 'Tu CT declara la modulación en la cabecera, con su tipo y el ahorro de dosis: anota ambos.',
      '2.3': 'Tu CT es de 110 kV: relaciona ese valor con la dosis y con el contraste de la imagen.',
      '3.1': 'En tu caso las camas avanzan de craneal a caudal: di en qué momento del examen se adquiere la vejiga y qué consecuencia tiene eso.',
      '3.2': 'Tu reconstrucción usa tiempo de vuelo: explica qué información adicional aprovecha y qué mejora en la imagen.',
      '4.1': 'Fíjate en las unidades de cada serie: una está en Bq/ml y la otra no. Explica por qué la serie sin corregir no se puede cuantificar.',
      '5.1': 'Tu CT y tu PET comparten marco de referencia: di qué significa eso y por qué no garantiza que la anatomía coincida.',
      '5.2': 'Como falta el peso, Volumina no muestra SUV: indica en qué unidades queda la escala y qué limitación tiene para comparar con otro estudio.',
    },
  },
  2: {
    titulo: 'Caso 2 · Cuerpo entero en un equipo de otro fabricante, sin tiempo de vuelo',
    antecedente: 'Hombre de 62 años con cáncer de pulmón de células no pequeñas. PET/CT con FDG, 75 kg y 1,81 m.',
    particularidades: ['Ocho camas de 3 minutos, en sentido caudocraneal.', 'La cabecera no registra iteraciones, subconjuntos ni filtro.', 'CT de 140 kV; la cabecera no trae CTDIvol ni tipo de modulación.'],
    extra: {
      '1.2': 'Tu cabecera trae peso y talla: calcula la actividad por kilo de peso y di si está dentro de lo habitual.',
      '1.3': 'En tu estudio las camas no muestran traslape en la cabecera: explica si eso significa que el equipo no traslapa o que no lo registra.',
      '2.2': 'Tu cabecera no declara la modulación de dosis; el simulador la deduce porque la corriente cambia entre cortes. Di entre qué valores varía y explica la diferencia entre un dato declarado y uno deducido.',
      '2.3': 'Tu CT es de 140 kV y la cabecera no trae CTDIvol, así que no hay DLP: explica qué datos necesitarías para estimar la dosis y dónde los buscarías en el equipo.',
      '3.1': 'En tu caso las camas avanzan de caudal a craneal: explica qué ventaja tiene partir por la pelvis.',
      '3.2': 'Tu cabecera dice solo «3D IR» y no registra iteraciones ni filtro: explica por qué eso dificulta comparar este estudio con uno de otro centro.',
      '4.1': 'Compara también la lista de correcciones de cada serie y nombra las dos que le faltan a la serie sin corregir.',
      '5.1': 'Tu PET tiene píxeles de casi 4 mm y tu CT de menos de 1 mm: explica qué hace el visor para superponerlos y qué detalle es real y cuál es interpolado.',
      '5.2': 'Como tu cabecera trae peso y actividad, la escala aparece también en SUV: anota el SUV al que queda la saturación superior.',
    },
  },
  3: {
    titulo: 'Caso 3 · Paciente con los pies hacia el gantry y PET en cuentas',
    antecedente: 'Mujer con cáncer de pulmón de células no pequeñas, en reetapificación. PET/CT con FDG, 59 kg.',
    particularidades: ['Posición con los pies primero.', 'Nueve camas de 1,5 minutos.', 'El PET viene en cuentas, con un factor de SUV propio del equipo.', 'CT con corriente constante, sin modulación, y cortes de 5 mm.'],
    extra: {
      '1.2': 'Tu cabecera dice que la imagen no tiene corrección de decaimiento: explica qué implica eso para comparar la primera cama con la última.',
      '1.3': 'Tu paciente está con los pies hacia el gantry: revisa la posición en la tarjeta y explica cómo cambia la orientación del topograma y qué hay que verificar al posicionar.',
      '2.2': 'Tu CT se adquirió con corriente constante, sin modulación: describe cómo se ve la curva y di en qué regiones sobra dosis y en cuáles puede faltar.',
      '2.3': 'Tu CT tiene cortes de 5 mm y tu PET de 4 mm: explica cómo se usa un CT de otro grosor para corregir la atenuación.',
      '3.1': 'Tus camas duran 1,5 minutos y son nueve: compara el tiempo total con el de un protocolo de menos camas más largas.',
      '3.2': 'Tu reconstrucción es LOR-RAMLA y la imagen viene en cuentas, no en Bq/ml: explica qué necesita el equipo para pasar de cuentas a SUV.',
      '4.1': 'En tu caso las dos series vienen en cuentas: fíjate en la lista de correcciones para saber cuál es cuál.',
      '5.1': 'Tu CT cubre más anatomía que tu PET: comprueba en el plano coronal dónde termina cada uno y explica por qué el visor limita la fusión.',
      '5.2': 'El SUV de tu caso sale de un factor que el equipo guarda en la cabecera: explica qué riesgo hay si un visor ignora ese factor.',
    },
  },
  4: {
    titulo: 'Caso 4 · Equipo antiguo, con CT de pocos cortes y marcos de referencia distintos',
    antecedente: 'Mujer de 90 años con cáncer de pulmón de células no pequeñas. PET/CT con FDG de base de cráneo a muslos, 63 kg.',
    particularidades: ['Siete camas de 2 minutos, en sentido caudocraneal.', 'OSEM de 2 iteraciones y 8 subconjuntos, sin tiempo de vuelo.', 'La cabecera no nombra el radiofármaco.', 'El CT y el PET no comparten marco de referencia.'],
    extra: {
      '1.2': 'Tu cabecera trae la actividad y la hora de inyección pero no nombra el radiofármaco: explica por qué ese dato debe quedar registrado y qué riesgo hay si falta.',
      '1.3': 'Tu estudio va de la base del cráneo a los muslos: justifica ese rango para un cáncer de pulmón y di qué quedaría fuera.',
      '2.2': 'Tu CT se adquirió con corriente constante: compara la curva con la que esperarías de un equipo con modulación.',
      '2.3': 'Tu CT es de 130 kV y corriente baja, en una paciente de 90 años: discute si la dosis es una prioridad en este caso y por qué.',
      '3.1': 'Tu captación fue de más de 80 minutos: explica cómo afecta eso a las cuentas y al contraste entre lesión y fondo.',
      '3.2': 'Tu reconstrucción es OSEM con 2 iteraciones y 8 subconjuntos, sin tiempo de vuelo ni filtro declarado: compárala con la de un equipo actual.',
      '4.1': 'Fíjate en el ruido que informa la tarjeta para cada serie y explica por qué un equipo antiguo puede mostrar una imagen más suave.',
      '5.1': 'En tu caso Volumina avisa que el CT y el PET no comparten marco de referencia y no fusiona solo. En «Ajuste manual de posición» habilita el ajuste exploratorio con los desplazamientos en cero y revisa si la anatomía coincide. Explica qué es un marco de referencia y por qué el visor pide esa confirmación.',
      '5.2': 'Anota el SUV al que queda la saturación superior y di si una lesión de SUV 3 se vería saturada o no.',
    },
  },
  5: {
    titulo: 'Caso 5 · Extremidades inferiores con camas de 30 segundos',
    antecedente: 'Paciente con melanoma. PET/CT con FDG de extremidades inferiores, 82 kg.',
    particularidades: ['Posición con los pies primero.', 'Siete camas de 30 segundos.', 'PSF con tiempo de vuelo, 2 iteraciones y 21 subconjuntos.', 'CT de 100 kV con modulación de dosis y ahorro alto.'],
    extra: {
      '1.2': 'Calcula la actividad por kilo de peso de tu paciente y relaciónala con el tiempo por cama que se usó.',
      '1.3': 'Tu estudio es solo de extremidades inferiores, en un paciente con melanoma: explica por qué en esta enfermedad se agregan las piernas al cuerpo entero.',
      '2.2': 'La modulación de tu CT ahorra más del 70 % de la dosis: mira la curva y explica por qué en las piernas el ahorro es tan grande.',
      '2.3': 'Tu CT es de 100 kV: explica por qué en extremidades se puede bajar el kV y qué se gana.',
      '3.1': 'Tus camas duran solo 30 segundos: explica por qué en las piernas se acepta un tiempo tan corto y qué pasaría con ese tiempo en el abdomen.',
      '3.2': 'Tu reconstrucción usa PSF y tiempo de vuelo: explica qué corrige cada uno.',
      '4.1': 'En las piernas hay poca atenuación: compara las dos series y di si la diferencia es mayor o menor que la que esperarías en el tórax.',
      '5.1': 'Revisa el registro en rodillas y tobillos, que es donde el paciente se mueve con más facilidad entre el CT y el PET.',
      '5.2': 'El máximo de tu volumen es mucho mayor que el resto de la imagen: ubica a qué corresponde y explica por qué la escala automática de un visor puede dejar la imagen en blanco.',
    },
  },
};
