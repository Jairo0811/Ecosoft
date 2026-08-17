from pathlib import Path
import re

path = Path("README.md")
text = path.read_text(encoding="utf-8")

section = """## 🧭 Continuidad académica

**EcoSoft** forma parte de una continuidad académica por **compañera recurrente** con [**MediCore**](https://github.com/Jairo0811/MediCore). La relación es **formativa y cronológica**: los proyectos corresponden a asignaturas y equipos diferentes, pero **Emely Marie Castillo Rivera (A00110380)** coincidió con Francis Jairo Matías Rosario en ambos proyectos durante dos períodos consecutivos de 2026.

La primera coincidencia documentada ocurrió en **Enero - Abril de 2026** en **Desarrollo de Software con Tecnología Propietaria 1 (ISO-605)** con MediCore. Posteriormente, en **Mayo - Agosto de 2026**, ambos volvieron a formar parte del mismo equipo académico en **Proyecto de Software 1 (ISO-705)** con EcoSoft.

| Orden | Código | Asignatura | Proyecto | Período | Compañera recurrente |
|---:|---|---|---|---|---|
| 1 | ISO-605 | Desarrollo de Software con Tecnología Propietaria 1 | [**MediCore**](https://github.com/Jairo0811/MediCore) | Enero - Abril 2026 | **Emely Marie Castillo Rivera — A00110380** |
| 2 | ISO-705 | Proyecto de Software 1 | **EcoSoft** | Mayo - Agosto 2026 | **Emely Marie Castillo Rivera — A00110380** |

Vistos en conjunto, ambos proyectos documentan una continuidad real entre compañeros a lo largo de dos cuatrimestres consecutivos. La coincidencia se considera verificada porque se mantiene el **mismo nombre completo y la misma matrícula A00110380**; no se infieren relaciones por similitud de nombres o matrículas aisladas."""

updated = re.sub(
    r"## 🔗 Continuidad académica.*?(?=\n\n## 👨‍💻 Repositorio)",
    section,
    text,
    flags=re.S,
)
if updated == text:
    raise SystemExit("Continuity block not found")
path.write_text(updated, encoding="utf-8")
