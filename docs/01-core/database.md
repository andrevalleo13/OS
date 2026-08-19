# ValleOS: Esquema de Base de Datos

El sistema nervioso de ValleOS está respaldado por una arquitectura de base de datos relacional de alto rendimiento, optimizada para baja latencia.

## Stack de Persistencia
- **Prisma ORM**: Tipado estricto extremo y migraciones deterministas. Prisma genera un cliente TypeScript que elimina cualquier posibilidad de errores de tipo en tiempo de ejecución.
- **NeonDB (PostgreSQL)**: Servidor de base de datos *Serverless* que garantiza latencia cercana a cero gracias a `@prisma/adapter-pg` configurado directamente en `prisma.config.ts`.

## Topología de Modelos Actual (Fase 5)
1. **Financial Core (`Transaction`)**: Almacena todos los ingresos y gastos (Cash Flow). Conectado directamente a las herramientas (`tools`) de Claude 3.
2. **Biological Core (`WorkoutSession`, `ExerciseLog`)**: Un registro jerárquico de cada sesión de entrenamiento, volumen hipertrófico y PRs (Records Personales).
3. **Nutrition Core (`FoodLog`)**: Registro milimétrico de consumo de proteínas, carbohidratos, grasas y agua, calculado por NLP.
4. **Second Brain (`Note`, `Course`, `Assignment`)**: La bóveda de Obsidian y universidad estructurada.
