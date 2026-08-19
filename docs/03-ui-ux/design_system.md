# Reglas de Diseño (Estética Stealth / Linear)

El Dashboard de ValleOS está diseñado para sentirse como una terminal de alta gama, secreta y ultra-minimalista para un usuario hiper-productivo.

## Principios Centrales
1. **El Contenido es la Interfaz**: Los datos deben hablar por sí mismos. No envuelvas los datos en contenedores voluminosos o encabezados gigantes.
2. **Dominancia Monocromática**: El 95% de la interfaz de usuario debe estar en escala de grises. Usa color ÚNICAMENTE para un significado semántico explícito (ej. `#ff5500` para la marca de ValleOS, verde para flujo de caja positivo, degradados sutiles para biometría).
3. **Escala Tipográfica**:
   - `text-[9px]`/`text-[10px]`: Datos secundarios, etiquetas, estados inactivos.
   - `text-[11px]`/`text-xs`: Etiquetas principales, elementos de lista.
   - `text-sm`: Encabezados de componentes, texto normal.
   - `text-2xl`/`text-3xl`: ÚNICAMENTE para puntos de datos masivos (ej. Valor Neto Total, Frecuencia Cardíaca), NO para títulos de página.
4. **Espaciado y Bordes**:
   - Empaqueta los datos relacionados de forma ajustada.
   - Los bordes nunca deben ser más gruesos que `1px` o `2px`.
   - Los colores de los bordes deben ser sutiles (`border-white/10`, `border-[#222]`, `border-[#333]`).

## Convenciones de Diseño
- **Títulos de Página**: NO LOS USES. Si el usuario hace clic en "Gimnasio" en la barra lateral, ya sabe que está en la página del Gimnasio. Un gran `<h1>Gimnasio</h1>` es redundante y rompe la estética. Deja que las migas de pan (breadcrumbs) en la Topbar hagan el trabajo.
- **Glassmorfismo**: Usa `backdrop-blur` intensamente en elementos superpuestos como menús desplegables, barras laterales y paletas de comandos para crear profundidad sin depender de sombras duras.
- **Micro-interacciones**: Todo lo interactivo debe tener un estado de hover (generalmente `text-white` o `bg-[#1a1a1a]`) y un estado de clic (`active:scale-95`).

## Iconografía
- Debes usar `lucide-react`.
- El grosor de trazo por defecto es 2px, pero reduce la escala para íconos pequeños si es necesario.
- Los tamaños de los íconos rara vez deben exceder `w-5 h-5` a menos que sean decorativos.
