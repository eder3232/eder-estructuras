# Flujo de trabajo con Git

Este documento define cómo se versiona este proyecto. Aplica desde el primer commit y se actualiza el día que se marque `v1.0.0` como primera versión de producción.

## Fase actual: desarrollo pre-producción (commits directos a `main`)

Mientras no exista un tag `v1.0.0`, el trabajo se hace **directamente sobre `main`**, sin ramas de feature ni pull requests. El objetivo de esta fase es agilidad: el proyecto tiene un solo desarrollador y aún no hay nada corriendo en producción que se pueda romper.

Esto no significa "sin disciplina". Las reglas mínimas que sí aplican desde ya:

- **Commits atómicos**: cada commit representa un cambio completo y coherente (una funcionalidad, un fix, una refactorización). Evitar commits gigantes que mezclan varias cosas no relacionadas.
- **`main` debe poder ejecutarse** en todo momento razonable. Si un cambio grande necesita varios días y deja el proyecto en un estado roto, usar una rama corta de trabajo (ver más abajo) en vez de forzarlo en `main`.
- **No commitear secretos** (`.env`, credenciales, tokens). Verificar `git status` antes de un `git add` amplio.

### Excepción: ramas cortas para cambios grandes

Aunque se trabaje en `main`, es válido crear una rama temporal para cambios grandes o riesgosos que tomarán más de una sesión de trabajo (ej. una migración de estructura de carpetas, un cambio de librería de estilos). Esto no contradice la agilidad, solo evita dejar `main` en un estado roto por varios días. Al terminar, se mergea a `main` y se borra la rama.

## Mensajes de commit: Conventional Commits

Se usa el estándar [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/). Formato:

```
<tipo>(<alcance opcional>): <descripción corta en imperativo>

[cuerpo opcional explicando el porqué, no el qué]
```

Tipos principales:

| Tipo       | Uso                                                              |
| ---------- | ----------------------------------------------------------------- |
| `feat`     | Nueva funcionalidad visible para el usuario                       |
| `fix`      | Corrección de un bug                                               |
| `refactor` | Cambio de código que no altera comportamiento externo             |
| `docs`     | Cambios solo en documentación                                     |
| `style`    | Formato, espacios, punto y coma — sin cambio de lógica            |
| `test`     | Agregar o corregir tests                                          |
| `chore`    | Tareas de mantenimiento (dependencias, configuración, build)      |

Ejemplos:

```
feat(auth): agregar login con Google
fix(dashboard): corregir cálculo de totales en resumen mensual
refactor(api): extraer lógica de validación a helpers
docs: agregar guía de flujo de git
chore: actualizar dependencias de shadcn
```

**Por qué**: un historial consistente permite generar changelog automáticamente más adelante y hace que `git log` sea útil para entender la evolución del proyecto, no solo para revertir cambios.

## Versionado: SemVer y tags

Se usa [Semantic Versioning](https://semver.org/lang/es/) (`MAJOR.MINOR.PATCH`):

- **`0.x.y`**: todo lo anterior a producción. Se puede tagear hitos relevantes (ej. `v0.1.0` al terminar la base del layout, `v0.2.0` al terminar una sección importante). No es obligatorio tagear cada commit, solo hitos con sentido.
- **`v1.0.0`**: primera versión de producción. Este tag es el punto de quiebre que activa el cambio de flujo descrito abajo.
- **`1.x.y`** en adelante: `MINOR` para funcionalidad nueva compatible, `PATCH` para fixes, `MAJOR` para cambios que rompen compatibilidad (poco común en una app web propia, más relevante si en algún momento se expone una API pública).

Crear un tag:

```bash
git tag -a v0.1.0 -m "Base de layout y configuración de shadcn"
git push origin v0.1.0
```

## A partir de `v1.0.0`: cambio de flujo

En cuanto se taggea `v1.0.0`, el proyecto pasa a considerarse "en producción" y el flujo cambia:

1. **`main` se protege** (branch protection en GitHub: no permitir push directo, requerir pull request).
2. **Todo cambio pasa por una rama** con prefijo según su naturaleza:
   - `feat/nombre-corto` — nueva funcionalidad
   - `fix/nombre-corto` — corrección de bug
   - `chore/nombre-corto` — mantenimiento
3. **Pull request obligatorio** hacia `main`, incluso trabajando solo — sirve como punto de revisión propia y deja registro de por qué se hizo el cambio.
4. **Merge y borrado de rama** al integrar, para mantener el repositorio limpio.

Este documento se actualiza en ese momento para reflejar el flujo real de ramas y PRs.

## Resumen rápido

| Fase                  | Dónde se trabaja        | Commits          | Tags                    |
| ---------------------- | ------------------------ | ----------------- | ------------------------ |
| Pre-producción (ahora) | `main` directo            | Conventional Commits | `v0.x.y` en hitos       |
| Producción (`v1.0.0`+) | Ramas `feat/`, `fix/`, `chore/` + PR | Conventional Commits | `v1.x.y` según SemVer |
