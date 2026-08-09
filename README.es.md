<div align="center">

# Prism

**Luz doblada en trabajo.**

Un rayo entra, todo el espectro sale. Prism es un banco de trabajo IA local-first
y agnóstico a modelos que refracta tus preguntas a través de agentes, notebooks,
archivos, figuras, informes y revisiones — cada uno un color diferente del mismo
pensamiento.

Construido con Tauri 2, React, MCP, habilidades de agente y artefactos reproducibles.
Funciona en macOS, Windows y Linux.

<p>
  <a href="../README.md"><b>English</b></a> ·
  <a href="./README.zh.md">简体中文</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.fr.md">Français</a> ·
  <a href="./README.ko.md">한국어</a>
</p>

</div>

---

## ¿Qué es Prism?

Prism es un banco de trabajo IA de escritorio. Haces una pregunta. Prism la hace
pasar por todas tus herramientas — agentes, notebooks, archivos, navegadores,
máquinas remotas — y te devuelve no solo una respuesta, sino todo el espectro:
figuras, código, informes, procedencia y la ruta exacta del pensamiento.

**Una entrada. Cada longitud de onda.**

- Una pregunta de investigación se convierte en revisión de literatura, experimento, figura y paper
- Un briefing de diseño se convierte en prototipos, exportaciones y presentaciones
- Una pregunta de datos se convierte en análisis, notebooks, gráficos e informes
- Una tarea de codificación se convierte en agentes, herramientas, tests y documentación

Todo local. Todo tuyo. Todo rastreable.

---

## ¿Por qué "Prism"?

Un prisma toma un haz de luz y revela que siempre estuvo hecho de muchos colores.
Prism toma una pregunta y revela que siempre estuvo hecha de muchas tareas — cada una
una longitud de onda diferente del mismo pensamiento, cada una produciendo algo real.

---

## Características

### Agentes autónomos que producen artefactos reales
No solo chat. Cada acción de agente produce archivos inspeccionables — figuras,
código, informes, notebooks — vinculados a las entradas exactas, entorno y
conversación que los crearon.

### Todo rastrea hacia atrás
El seguimiento de procedencia vincula cada salida con su fuente. Abre cualquier
artefacto y ve el script, los datos, la salida del modelo y la conversación
que lo creó.

### Local-first por defecto
Tus sesiones, datos, procedencia, notebooks y registros de ejecución viven
en tu máquina. Nada sale a menos que quieras.

### Agnóstico a modelos
Trae tu propio modelo. El runtime soporta cualquier proveedor — OpenAI, Anthropic,
modelos locales, endpoints personalizados. Las habilidades y servidores MCP
seguibles siendo enchufables.

### Accésalo desde cualquier puerta
Una puerta de enlace integrada sirve el verdadero UI de escritorio a un navegador
en tu LAN o teléfono. Inicia una ejecución en tu escritorio, revisa los resultados
desde tu teléfono.

### Maneja tu próprio navegador
El agente puede manejar tu Chrome real — perfil y logins intactos — o usar un
navegador privado aislado.

### Planifica antes de actuar
`/plan` establece un plan de ejecución. `/goal` fija el objetivo, restricciones
y criterios de aceptación. Luego el agente ejecuta.

### Trabaja en varias cosas a la vez
Mosaicos de paneles lado a lado. Ejecuta diferentes modelos en cada uno. Arrastra
para acoplar. Pantallas independientes para diferentes proyectos.

---

## Ciclo de investigación

El método científico completo, como cadena de habilidades:

| Etapa | Qué hace | Salida |
| --- | --- | --- |
| Explorar | Convierte una dirección amplia en temas concretos | Matriz de temas, pre-estudio de literatura |
| Revisar | Buscar y sintetizar la literatura | 6–20 pp PDF, 60+ citas reales |
| Experimentar | Diseñar y ejecutar experimentos | Código, resultados, figuras, procedencia |
| Escribir | Redactar una publicación | 8–14 pp PDF, 200+ citas, figuras |

Cada etapa es autónoma. Ejecútalas individualmente o deja que la meta-habilidad
las encadena de extremo a extremo.

---

## Conectores

Integraciones científicas de un clic:

- Literatura: arXiv, PubMed, Crossref, Semantic Scholar, bioRxiv/medRxiv
- Biomédica: ClinicalTrials.gov, MyVariant/ClinVar
- Materiales: Materials Project
- Economía: FRED
- Clima: Open-Meteo
- Clima espacial, datos de agua USGS

Añade cualquier servidor MCP o herramienta local desde Configuración.

---

## Instalar

Descarga desde la [página de Releases](https://github.com/bmo1177/Prism/releases/latest).

| Plataforma | Formato |
| --- | --- |
| macOS | `.dmg` / `.app` (Apple Silicon e Intel) |
| Windows | `.exe` / `.msi` |
| Linux | `.deb` / `.rpm` / AppImage |

```bash
# Linux .deb
sudo apt install ./Prism_*.deb

# Linux .rpm
sudo rpm -i Prism-*.rpm

# AppImage
chmod +x Prism_*.AppImage
./Prism_*.AppImage
```

---

## Compilar desde fuente

Requisitos: Node.js ≥ 20, pnpm 9, toolchain de Rust, dependencias de sistema Tauri.

```bash
git clone https://github.com/bmo1177/Prism
cd Prism
pnpm install

# Obtener sidecars y habilidades empaquetadas
bash scripts/dev/fetch-opencode.sh
bash scripts/dev/fetch-uv.sh
bash scripts/dev/fetch-skills.sh

# Desarrollar
pnpm --filter @ai4s/desktop tauri dev

# Compilar
pnpm --filter @ai4s/desktop tauri build
```

---

## Seguridad

- Los archivos del espacio de trabajo se mantienen locales por defecto.
- La ejecución de comandos, eliminación de archivos y conexiones remotas requieren aprobación.
- Las credenciales del proveedor se almacenan en configuración privada de la aplicación, nunca en git ni procedencia.
- La configuración muestra una vista de flujo de datos en lenguaje plano.

---

## Licencia

[MIT](../LICENSE)

> Prism es software beta. Trata las salidas como borradores — verifica antes de publicar.
