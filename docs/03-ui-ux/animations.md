# Framer Motion y WebGL 3D

El sistema utiliza técnicas avanzadas de animación para garantizar una fluidez ininterrumpida sin sacrificar el rendimiento (mantenimiento estricto de 60fps).

## Layout Transitions (Framer Motion)
El "Grid Mutante" (Bento Grid) de ValleOS no utiliza CSS Grid clásico para cambiar sus proporciones, ya que esto causaría cortes bruscos en la UI.
- Se utiliza la prop `layout` de Framer Motion en componentes `WidgetCard`.
- Cuando el store global (`useUIStore`) detecta un cambio de estado en `focusMode` (ej. activando modo Deep Work), los módulos distractores se desmontan con `<AnimatePresence>`, y los módulos restantes (como Notas) calculan matemáticamente su nuevo ancho completo de pantalla utilizando animaciones de resorte (`spring`, `stiffness: 300`, `damping: 30`).

## GSAP & React Three Fiber (Gimnasio)
El ecosistema 3D del módulo Gym utiliza un pipeline de control de cámara mixto.
- En lugar de forzar a React a renderizar cada frame de una animación de zoom en el modelo 3D del cuerpo humano (lo cual hundiría el rendimiento), pasamos referencias limpias (`useRef`) del la cámara WebGL a GSAP.
- GSAP ejecuta interpolaciones de curvas Bézier para mover fluidamente la cámara a partes específicas del cuerpo (ej. Hombros) sin bloquear el hilo principal de React.
