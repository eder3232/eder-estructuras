# Flujo de trabajo con Git

Este documento define cómo se versiona este proyecto.

## Fase actual: en producción, todo pasa por un pull request

Desde el **2026-10-17** la app está publicada en **https://tesis.eder3232.com**, y cada push a `main` despliega a producción (Vercel, proyecto `eder-estructuras`, conectado a [`eder3232/eder-estructuras`](https://github.com/eder3232/eder-estructuras)). Por eso **ya no se hace push directo a `main`**, aunque la v1 todavía no esté tageada: el disparador del cambio de flujo iba a ser el tag `v1.0.0`, y resultó ser estar publicado.

Hasta el 2026-10-17 el trabajo fue **directo sobre `main`** (pre-producción, un solo desarrollador, nada que romper). Ese historial queda como está.

### El ciclo de un cambio

1. **Una rama desde `main`**, con prefijo según el tipo de cambio (el mismo de Conventional Commits, abajo):
   - `feat/nombre-corto` — funcionalidad nueva
   - `fix/nombre-corto` — corrección de un bug
   - `docs/nombre-corto` — solo documentación
   - `refactor/`, `test/`, `chore/` — según corresponda
2. **Commits atómicos en la rama**, uno por paso, como se hizo siempre: un paso del cierre de un sistema es un commit.
3. **Push de la rama y pull request a `main`** (`gh pr create`), incluso trabajando solo: el PR deja escrito por qué se hizo el cambio y es el punto de revisión propia.
4. **Mirar el preview**: Vercel despliega cada rama con su propia URL y la publica en el PR. Se verifica ahí —tests, y la app mirada (`docs/estado-actual.md`, sección 6)— antes de integrar. El check **«Vercel»** del PR tiene que estar en verde: si el build falla, el PR no se puede mergear.
5. **Merge por rebase** (`gh pr merge --rebase --delete-branch`): los commits de la rama entran a `main` uno por uno y en línea, sin commit de merge. No se usa *squash* porque colapsaría los pasos en un solo commit, y el historial del proyecto se lee justamente por pasos.
6. **El merge despliega a producción.** Después, mirar https://tesis.eder3232.com: el «Ready» de Vercel no dice que la app se vea bien.

### Lo que impone GitHub

`main` está **protegida** (branch protection):

- no se puede hacer push directo: todo entra por PR;
- el check «Vercel» tiene que pasar antes del merge;
- sin force push ni borrado de la rama;
- historial lineal: el repo **solo permite merge por rebase** (squash y merge commit están apagados) y borra la rama al mergear;
- **aplica también a los administradores** (`enforce_admins`): un push directo a `main` lo rechaza GitHub, no la memoria de nadie.

No se exigen aprobaciones (0 reviews): con un solo desarrollador, nadie podría aprobar.

### Reglas que siguen igual

- **Commits atómicos**: cada commit es un cambio completo y coherente.
- **`main` siempre desplegable**: lo que entra a `main` sale a producción en minutos.
- **No commitear secretos** (`.env`, credenciales, tokens). El repo es **público**: verificar `git status` antes de un `git add` amplio. `.env*` y `.vercel` están en el `.gitignore`.

## Mensajes de commit: Conventional Commits

Se usa el estándar [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), en español. Formato:

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
feat(frame2d): diagramas N, V y M
fix(armaduras-2d): la tabla rotulada K_ff⁻¹ mostraba K_ff
docs: el despliegue en Vercel y la home
chore: actualizar dependencias de shadcn
```

El título del PR sigue el mismo formato.

**Por qué**: un historial consistente permite generar changelog automáticamente más adelante y hace que `git log` sea útil para entender la evolución del proyecto, no solo para revertir cambios.

## Versionado: SemVer y tags

Se usa [Semantic Versioning](https://semver.org/lang/es/) (`MAJOR.MINOR.PATCH`):

- **`0.x.y`**: mientras la v1 no esté completa (quedan las fases 6 a 8 del roadmap). Se puede tagear hitos relevantes; no es obligatorio tagear cada cambio.
- **`v1.0.0`**: cuando el usuario dé por completa la v1. Ya no cambia el flujo (eso pasó al publicar), solo marca la versión.
- **`1.x.y`** en adelante: `MINOR` para funcionalidad nueva compatible, `PATCH` para fixes, `MAJOR` para cambios que rompen compatibilidad.

Un tag se crea sobre `main` ya mergeado:

```bash
git switch main && git pull
git tag -a v0.1.0 -m "Los cinco sistemas cerrados para la v1"
git push origin v0.1.0
```

## Resumen rápido

| Fase | Dónde se trabaja | Cómo entra a `main` | Tags |
| --- | --- | --- | --- |
| Pre-producción (hasta el 2026-10-17) | `main` directo | push | — |
| **En producción (ahora)** | ramas `feat/`, `fix/`, `docs/`… | PR con preview de Vercel en verde, merge por rebase | `v0.x.y` en hitos, `v1.0.0` al completar la v1 |
